# Qwen Core — explicit `owner_system_prompt` must survive durable session/restart

Status: reproducible contract gap on current PR #6 line. This is a design/implementation handoff, not a claim that product is fixed.

## Evidence

Current public owner-mode contract explicitly supports a generic OpenAI path:

- `src/qwen-v3-capabilities.js::explicitOwnerPrompt()` accepts `owner_system_prompt` / `ownerSystemPrompt`.
- `scripts/system-prompt-mode-test.js` calls that path the **lossless generic OpenAI path**, requires byte-for-byte owner prompt delivery, removes the client persona, and keeps project instructions separately.

Current durable session record in `src/session-store.js::set()` persists only:

- `chatId`
- `accountId`
- `awaitingCompactedHistory`
- `toolPromptHash`
- `history`
- `updatedAt`

It does not persist explicit owner prompt or owner/system mode.

`server.js` checkpoints `restoredMessages`, not the detached `owner_system_prompt` control field. Therefore an explicit owner prompt can reach Qwen on the first turn while being absent from the durable session state used by restart/short-continuation recovery.

Concrete unsafe sequence:

1. Request A: `system_prompt_mode=owner`, `owner_system_prompt=PRIVATE_OWNER`, messages contain only client persona/project/user.
2. `qwen-v3-capabilities.prepareInput()` detaches `PRIVATE_OWNER`, removes the competing persona and applies `PRIVATE_OWNER` to Qwen payload.
3. Qwen response succeeds and session checkpoint persists message history, but not `PRIVATE_OWNER` as a separate authority field.
4. Process restart.
5. Request B is a short continuation and does not repeat `owner_system_prompt` (or only repeats session id/header).
6. `restoreCheckpoint()` can restore message history, but there is no durable explicit owner authority to rehydrate.
7. The next Qwen request can therefore run without the private owner prompt or can fall back to engineer/default semantics, depending on current request markers.

This is separate from the already-fixed large `role=system` checkpoint path.

## Required invariant

A successfully accepted owner-mode turn must never make a later durable continuation weaker in authority merely because the process restarted or the client sent a short incremental turn.

For the explicit owner path:

- exact owner prompt bytes must survive restart;
- owner mode itself must survive short continuation when the client does not explicitly select a different mode;
- a new explicit owner prompt or explicit new system authority must replace the stored owner authority, never concatenate accidentally;
- project/system context remains separate from private owner authority;
- competing client persona removed by owner mode must not become the restored owner authority;
- no provider call may occur if the owner authority cannot be durably represented under the chosen hard bound;
- secrets/prompt text must not be logged.

## Recommended shape

Do **not** synthesize the stored explicit owner prompt back into ordinary `role=system` history. That is ambiguous with OpenCode MCP/project parsing and can duplicate project instructions.

Prefer separate durable record fields, e.g.:

```text
systemPromptMode: "owner" | "engineer"
ownerSystemPrompt: string | null
```

The exact field names are not normative; the separation is.

### `session-store.js`

Extend `set()` metadata with explicit presence semantics:

- when caller supplies `systemPromptMode`, persist it;
- when caller supplies `ownerSystemPrompt`, persist exact string (or null to clear);
- when caller omits a metadata field, preserve previous value exactly as current `toolPromptHash` does;
- account/thread ownership rejection must remain unchanged;
- recovered-backup uncertainty rules must remain unchanged.

Add a bounded explicit-owner validator. A simple safe first version may give the explicit owner authority its own hard per-record limit (for example the same 60k class as checkpoint system authority) rather than silently truncating it. Exceeding the limit must throw `QWEN_SYSTEM_CHECKPOINT_REJECTED` before provider traffic. Do not silently drop or clip owner text.

### `qwen-v3-capabilities.js`

`applyPrepared()` already exposes non-enumerable mode metadata (`__qwenSystemPromptMode`). Expose the exact selected owner authority similarly, e.g. non-enumerable `__qwenOwnerSystemPrompt`, so server persistence does not reverse-engineer the final provider text.

This field is process-local metadata only; do not serialize it into provider payload or logs.

### `server.js`

Before provider preparation:

1. read durable record;
2. determine whether the current request explicitly selects system-prompt mode;
3. if current request does **not** explicitly select a new mode and durable record says `owner`, inherit owner mode for the continuation;
4. if current owner-mode request does not supply a new explicit owner prompt and current incoming request does not supply a new system authority, rehydrate durable `ownerSystemPrompt` into the capability input as `owner_system_prompt`;
5. a new explicit owner field has highest precedence;
6. a new explicit current system authority must not be silently overwritten by stale durable owner text;
7. run durable-owner/system capacity preflight before `preparePublicPayloadGoverned()` / request governor / Qwen I/O.

After `preparePublicPayloadGoverned()` has selected the actual owner authority, pass the non-enumerable prepared mode/owner metadata into every successful `sessionStore.set()` path: primary non-stream, non-stream retry, streaming accepted tool call, streaming assistant text, and final stream route persistence.

Do not update only one branch: otherwise stream/non-stream restart semantics diverge.

## Mandatory regressions

### A. Session-store exact persistence

Extend/add a local store test:

1. `set(..., { systemPromptMode:'owner', ownerSystemPrompt: PRIVATE_20K, history:[...] })`.
2. reload module/process store.
3. `getRecord()` returns exact prompt and owner mode.
4. replacement with NEW_PRIVATE exact prompt replaces old one.
5. explicit null/engineer transition clears owner authority if that is the chosen API contract.
6. over-limit owner authority rejects explicitly; no partial/truncated write.

### B. Server restart/short continuation — explicit generic path

Dynamic server test with mocked provider:

1. First request uses `system_prompt_mode:'owner'` + `owner_system_prompt:'PRIVATE_OWNER'` and explicit session id.
2. First prepared/provider call must begin with exact `PRIVATE_OWNER` and must persist owner metadata.
3. Simulate restart by returning the durable record to a second server/session flow.
4. Second request contains only short user `continue` + same session id, with no owner prompt and no new system authority.
5. Second prepared/provider call must still begin with exact `PRIVATE_OWNER`.
6. Provider call count exactly two total; no extra discovery call.

### C. Replacement precedence

After stored OLD_PRIVATE:

- request with explicit `owner_system_prompt=NEW_PRIVATE` => Qwen sees NEW_PRIVATE only, durable record becomes NEW_PRIVATE;
- request with explicitly selected `engineer` mode => OLD_PRIVATE must not be injected;
- request with a genuinely new current owner system authority (no explicit field) must not be overwritten by OLD_PRIVATE.

### D. Pre-provider hard bound

Use an explicit owner field above the chosen hard limit:

- response code `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- `sendChatRequest` call_count = 0;
- account/provider health untouched;
- session record unchanged.

### E. Stream parity

At least one restart continuation must use `stream=true` and prove the same owner authority restoration as non-stream.

## Important non-solution

Do not merely prepend stored explicit owner text to checkpoint `role=system` messages. On OpenCode owner mode, `<mcp_instructions>` and `Instructions from:` extraction distinguish private owner authority from neutral project context; collapsing them into one generic system history can change authority or duplicate project rules.

## Current adjacent work

`autonomy/v3/candidates/QWEN_CORE_SYSTEM_CHECKPOINT_PREFLIGHT_20260821.patch` handles the simpler oversized `messages` preflight and should still be useful, but it does **not** by itself solve explicit `owner_system_prompt` durability. The implementation should either integrate both in one coherent pass or ensure the preflight also covers the separately persisted explicit owner authority.
