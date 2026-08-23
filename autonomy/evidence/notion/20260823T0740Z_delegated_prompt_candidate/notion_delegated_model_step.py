from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from payload.delegated_tool_loop import (
    DelegatedHistoryItem,
    DelegatedModelReply,
    DelegatedToolCall,
)
from payload.delegation_dispatcher import DelegationContext


class NotionDelegatedModelStepError(RuntimeError):
    pass


@dataclass(slots=True)
class _RemoteThreadState:
    client: Any
    thread_id: str
    history_count: int


class _NotionDelegatedModelSession:
    def __init__(
        self,
        *,
        context: DelegationContext,
        tools: Sequence[Mapping[str, Any]],
        model: str,
        web_search: bool,
    ) -> None:
        self._context = context
        self._tools = tuple(dict(tool) for tool in tools)
        self._model = model
        self._web_search = web_search
        self._synthetic_call_sequence = 0
        # Only the currently active provider client may resume its remote thread.
        # If a child fails over A -> B and later A becomes eligible again, A's old
        # thread is stale: it never saw B's assistant tool calls or their results.
        # Reusing that stale thread with an incremental delta would hand A orphaned
        # tool results and could make it repeat or misinterpret local side effects.
        # A provider-client switch therefore always rebases complete local history
        # onto a fresh remote thread; only consecutive turns on the same exact client
        # use incremental continuation.
        self._active_remote_client: Any | None = None
        # Keep the exact client object together with its thread state. Using only
        # id(client) is not enough for a long-lived child session: after an old
        # provider client is collected, Python may reuse that integer id for a new
        # client. Without the retained identity guard, a replacement account could
        # accidentally receive the previous account's Notion thread_id.
        self._remote_threads: dict[int, _RemoteThreadState] = {}

    def _tool_catalog(self) -> list[dict[str, Any]]:
        return [dict(tool) for tool in self._tools]

    def _history_text(
        self,
        history: Sequence[DelegatedHistoryItem],
        *,
        include_assistant_calls: bool,
    ) -> str:
        parts: list[str] = []
        for item in history:
            kind = str(item.get("type", ""))
            if kind == "message":
                parts.append(f"[user]\n{item.get('content', '')}")
                continue
            if kind == "assistant_tool_calls":
                if not include_assistant_calls:
                    continue
                calls = item.get("calls", ())
                parts.append(
                    "[assistant]\n"
                    + json.dumps(
                        {"tool_calls": list(calls) if isinstance(calls, Sequence) else []},
                        ensure_ascii=False,
                        sort_keys=True,
                    )
                )
                continue
            if kind == "function_call_output":
                parts.append(
                    "[user]\nTool result for "
                    f"{item.get('name', '')} ({item.get('call_id', '')}):\n"
                    f"{item.get('output', '')}"
                )
        return "\n\n".join(part for part in parts if part)

    def _full_prompt(
        self,
        history: Sequence[DelegatedHistoryItem],
    ) -> str:
        catalog = json.dumps(self._tool_catalog(), ensure_ascii=False, sort_keys=True)
        transcript = self._history_text(history, include_assistant_calls=True)
        runtime_context = f"""Use the local operator tools when needed. When a tool is needed, respond with ONLY one JSON object and no markdown:
{{"tool":"<exact tool name>","arguments":{{...}}}}
Never claim a tool ran until its result appears in the transcript. Do not repeat a tool action whose result is already present. When the task is complete, return only the final text result for the parent agent.

Tool catalog:
{catalog}

Local delegated transcript:
{transcript}

Task identity: {self._context.conversation_key}"""
        if self._context.prompt_mode == "owner":
            owner_prompt = self._context.owner_system_prompt
            if not isinstance(owner_prompt, str) or not owner_prompt.strip():
                raise NotionDelegatedModelStepError(
                    "owner delegated mode requires owner_system_prompt"
                )
            return owner_prompt + "\n\n--- Delegated runtime context ---\n" + runtime_context
        return (
            "You are an autonomous coding subagent working on one isolated delegated task.\n"
            + runtime_context
        )

    def _incremental_prompt(
        self,
        history: Sequence[DelegatedHistoryItem],
    ) -> str:
        transcript = self._history_text(history, include_assistant_calls=False)
        return f"""Continue the same delegated coding task from the existing Notion thread.
The local operator has advanced the task since your previous response. Use the new tool results/events below. Never repeat an action whose result is already present. If another tool is needed, return only the same JSON tool-call object format; otherwise return only the final text result.

New local events:
{transcript}"""

    def _next_synthetic_call_id(self) -> str:
        # The compact delegated prompt intentionally does not require the model to
        # invent call ids. Missing ids therefore belong to the local transport, not
        # to the semantic tool request. A content hash is unsafe here: after a real
        # failed tool result the model may legitimately retry the exact same call,
        # and a deterministic content id would make the loop reject that retry as
        # an already-used call id. Keep generated ids unique within this isolated
        # child session instead; explicit provider ids remain untouched and retain
        # the normal duplicate-call protection in DelegatedToolLoopSession.
        self._synthetic_call_sequence += 1
        return f"delegated-auto-{self._synthetic_call_sequence}"

    def _extract_reply(self, text: str) -> DelegatedModelReply:
        stripped = text.strip()
        if not stripped:
            raise NotionDelegatedModelStepError("delegated Notion model returned empty output")

        candidates = [stripped]
        if "```" in stripped:
            candidates.extend(
                part.strip().removeprefix("json").strip()
                for part in stripped.split("```")
                if part.strip()
            )
        for candidate in candidates:
            try:
                value = json.loads(candidate)
            except json.JSONDecodeError:
                continue
            if not isinstance(value, dict):
                continue

            has_tool_intent = "tool" in value or (
                "name" in value and ("arguments" in value or "input" in value)
            )
            if not has_tool_intent:
                continue

            name = value.get("tool") or value.get("name")
            arguments = value.get("arguments", value.get("input", {}))
            if not isinstance(name, str) or not name.strip() or not isinstance(arguments, dict):
                raise NotionDelegatedModelStepError(
                    "delegated Notion model returned malformed tool call"
                )

            # Preserve tool intent even when the model misspells or invents a tool
            # name. The local executor owns the authoritative allowlist and will
            # return an explicit unsupported_tool result. Feeding that result back
            # into the same child thread lets the model correct itself instead of
            # silently treating a JSON-shaped failed tool attempt as final output.
            call_id = value.get("call_id")
            if not isinstance(call_id, str) or not call_id.strip():
                call_id = self._next_synthetic_call_id()
            return DelegatedModelReply(
                tool_calls=(
                    DelegatedToolCall(
                        call_id=call_id,
                        name=name.strip(),
                        arguments=dict(arguments),
                    ),
                )
            )
        return DelegatedModelReply(text=stripped)

    async def __call__(
        self,
        context: DelegationContext,
        history: Sequence[DelegatedHistoryItem],
        client: Any,
    ) -> DelegatedModelReply:
        if context.conversation_key != self._context.conversation_key:
            raise NotionDelegatedModelStepError(
                "delegated model session received a different conversation"
            )

        key = id(client)
        state = self._remote_threads.get(key)
        if state is not None and state.client is not client:
            # Defensive identity check for integer-id reuse. Treat a collision as
            # a fresh provider client so the old account's remote thread can never
            # cross into a replacement account.
            state = None
        if state is not None and self._active_remote_client is not client:
            # This exact client has been used before, but another client advanced
            # the local child conversation after that. Its old remote thread is now
            # stale and cannot safely consume a delta that omits assistant tool calls.
            state = None
        if state is None:
            prompt = self._full_prompt(history)
            kwargs: dict[str, Any] = {}
        else:
            delta = history[state.history_count :]
            prompt = self._incremental_prompt(delta)
            kwargs = {"thread_id": state.thread_id}

        completion = await client.complete(
            prompt=prompt,
            model=self._model,
            web_search=self._web_search,
            workspace_search=False,
            ask_mode=True,
            **kwargs,
        )
        text = str(getattr(completion, "text", "") or "")
        thread_id = str(getattr(completion, "thread_id", "") or "").strip()
        if not thread_id:
            raise NotionDelegatedModelStepError(
                "delegated Notion completion did not provide a thread id"
            )

        reply = self._extract_reply(text)
        # Advance provider-thread state only after a structurally valid response.
        # If transport/provider work raises above, the old current client/state
        # remain intact. Once a different client succeeds, discard every stale
        # remote thread so any future return to an old account is forced through a
        # full-history rebase rather than a partial incremental continuation.
        new_state = _RemoteThreadState(
            client=client,
            thread_id=thread_id,
            history_count=len(history),
        )
        self._active_remote_client = client
        self._remote_threads = {key: new_state}
        return reply


class NotionDelegatedModelStep:
    """Factory for child-scoped Notion model-step sessions.

    The factory itself stores no remote Notion thread ids. Each call to
    ``start_session`` creates an isolated remote-thread map, so even reusing a
    task id later cannot resurrect a completed child session's provider thread.
    """

    def __init__(
        self,
        *,
        tools: Sequence[Mapping[str, Any]],
        model: str = "gpt-5.6-sol",
        web_search: bool = False,
    ) -> None:
        self._tools = tuple(dict(tool) for tool in tools)
        self._model = model
        self._web_search = web_search

    def start_session(self, context: DelegationContext) -> _NotionDelegatedModelSession:
        return _NotionDelegatedModelSession(
            context=context,
            tools=self._tools,
            model=self._model,
            web_search=self._web_search,
        )

    async def __call__(
        self,
        context: DelegationContext,
        history: Sequence[DelegatedHistoryItem],
        client: Any,
    ) -> DelegatedModelReply:
        # Compatibility for direct callers. DelegatedToolLoopRunner detects
        # ``start_session`` and uses the child-scoped callable for real loops.
        return await self.start_session(context)(context, history, client)
