from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

BASE_ACCOUNT_POOL_BLOB = "11cea792a2f5aaa40ee1515faddfd44e76cbb23f"
BASE_SERVER_BLOB = "f02cef6a0ffc202c75fbe71c520c72ac19ff876d"
BASE_RESERVATION_LEASE_BLOB = "c77b4d5214911def1729243516aec73e43f8d425"


def git_blob_sha(text: str) -> str:
    raw = text.encode("utf-8")
    return hashlib.sha1(f"blob {len(raw)}\0".encode("ascii") + raw).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}_PREIMAGE_MISMATCH:{count}")
    return text.replace(old, new, 1)


def apply_v41_after_agent(account_pool_text: str) -> str:
    old_sig = '''    async def run(\n        self,\n        operation: Callable[[NotionAgentClient], Awaitable[T]],\n        *,\n        retry_operation: Callable[[NotionAgentClient], Awaitable[T]] | None = None,\n    ) -> T:\n'''
    new_sig = '''    async def run(\n        self,\n        operation: Callable[[NotionAgentClient], Awaitable[T]],\n        *,\n        retry_operation: Callable[[NotionAgentClient], Awaitable[T]] | None = None,\n        allow_failover: bool = True,\n    ) -> T:\n'''
    text = replace_once(account_pool_text, old_sig, new_sig, "V41_RUN_SIGNATURE")
    old_body = '''                duration_ms = round((time.monotonic() - started_at) * 1000)\n                if isinstance(error, NotionAgentError) and error.code == ErrorCode.TRANSPORT:\n                    if self._pending_transport_failure is not None:\n                        self._record_transport_outcome(final_success=False, retry_scheduled=True)\n                    self._record_transport_failure(error, duration_ms=duration_ms)\n                try:\n                    await self._switch_account(error, duration_ms=duration_ms)\n'''
    new_body = '''                duration_ms = round((time.monotonic() - started_at) * 1000)\n                if isinstance(error, NotionAgentError) and error.code == ErrorCode.TRANSPORT:\n                    if self._pending_transport_failure is not None:\n                        self._record_transport_outcome(\n                            final_success=False,\n                            retry_scheduled=allow_failover,\n                        )\n                    self._record_transport_failure(error, duration_ms=duration_ms)\n                if not allow_failover:\n                    if self._slot is not None:\n                        await self._pool._record_failure(self._slot, error, duration_ms)\n                    if self._pending_transport_failure is not None:\n                        self._record_transport_outcome(\n                            final_success=False,\n                            retry_scheduled=False,\n                        )\n                    log_event(\n                        log,\n                        "account_failover_suppressed",\n                        level=logging.WARNING,\n                        account_number=(self._slot.number if self._slot is not None else None),\n                        account_id=(self._slot.account_id if self._slot is not None else None),\n                        account_file=(self._pool._account_file(self._slot) if self._slot is not None else None),\n                        reason="caller_disabled_failover",\n                    )\n                    raise\n                try:\n                    await self._switch_account(error, duration_ms=duration_ms)\n'''
    text = replace_once(text, old_body, new_body, "V41_FAILOVER_BODY")
    compile(text, "payload/account_pool.py", "exec")
    return text


def apply_v45_wrapper(text: str) -> str:
    text = replace_once(
        text,
        '''    async def run(\n        self,\n        operation: Callable[[Any], Awaitable[T]],\n        *,\n        retry_operation: Callable[[Any], Awaitable[T]] | None = None,\n    ) -> T: ...\n''',
        '''    async def run(\n        self,\n        operation: Callable[[Any], Awaitable[T]],\n        *,\n        retry_operation: Callable[[Any], Awaitable[T]] | None = None,\n        allow_failover: bool = True,\n    ) -> T: ...\n''',
        "V45_PROTOCOL",
    )
    text = replace_once(
        text,
        '''    async def _run(\n        self,\n        operation_for_lease: LeaseOperationFactory[T],\n        *,\n        retry_operation: Callable[[Any], Awaitable[T]] | None,\n        account_sensitive: bool,\n    ) -> T:\n''',
        '''    async def _run(\n        self,\n        operation_for_lease: LeaseOperationFactory[T],\n        *,\n        retry_operation: Callable[[Any], Awaitable[T]] | None,\n        account_sensitive: bool,\n        allow_failover: bool,\n    ) -> T:\n''',
        "V45_INTERNAL_SIGNATURE",
    )
    text = replace_once(
        text,
        '''            try:\n                if guarded_retry is None:\n                    return await lease.run(guarded_operation)\n                return await lease.run(\n                    guarded_operation,\n                    retry_operation=guarded_retry,\n                )\n''',
        '''            try:\n                if guarded_retry is None:\n                    if allow_failover:\n                        return await lease.run(guarded_operation)\n                    return await lease.run(\n                        guarded_operation,\n                        allow_failover=False,\n                    )\n                if allow_failover:\n                    return await lease.run(\n                        guarded_operation,\n                        retry_operation=guarded_retry,\n                    )\n                return await lease.run(\n                    guarded_operation,\n                    retry_operation=guarded_retry,\n                    allow_failover=False,\n                )\n''',
        "V45_FORWARDING",
    )
    text = replace_once(
        text,
        '''    async def run_selected(\n        self,\n        operation_for_lease: LeaseOperationFactory[T],\n        *,\n        retry_operation: Callable[[Any], Awaitable[T]] | None = None,\n    ) -> T:\n''',
        '''    async def run_selected(\n        self,\n        operation_for_lease: LeaseOperationFactory[T],\n        *,\n        retry_operation: Callable[[Any], Awaitable[T]] | None = None,\n        allow_failover: bool = True,\n    ) -> T:\n''',
        "V45_RUN_SELECTED_SIGNATURE",
    )
    text = replace_once(
        text,
        '''            operation_for_lease,\n            retry_operation=retry_operation,\n            account_sensitive=True,\n        )\n''',
        '''            operation_for_lease,\n            retry_operation=retry_operation,\n            account_sensitive=True,\n            allow_failover=allow_failover,\n        )\n''',
        "V45_RUN_SELECTED_FORWARD",
    )
    text = replace_once(
        text,
        '''    async def run(\n        self,\n        operation: Callable[[Any], Awaitable[T]],\n        *,\n        retry_operation: Callable[[Any], Awaitable[T]] | None = None,\n    ) -> T:\n        """Run a later round without replaying earlier successful rounds."""\n''',
        '''    async def run(\n        self,\n        operation: Callable[[Any], Awaitable[T]],\n        *,\n        retry_operation: Callable[[Any], Awaitable[T]] | None = None,\n        allow_failover: bool = True,\n    ) -> T:\n        """Run a later round without replaying earlier successful rounds."""\n''',
        "V45_RUN_SIGNATURE",
    )
    text = replace_once(
        text,
        '''            lambda _lease: operation,\n            retry_operation=retry_operation,\n            account_sensitive=False,\n        )\n''',
        '''            lambda _lease: operation,\n            retry_operation=retry_operation,\n            account_sensitive=False,\n            allow_failover=allow_failover,\n        )\n''',
        "V45_RUN_FORWARD",
    )
    text = replace_once(
        text,
        '''    retry_operation: Callable[[Any], Awaitable[T]] | None = None,\n    lease_kwargs: dict[str, Any] | None = None,\n) -> tuple[str, T]:\n''',
        '''    retry_operation: Callable[[Any], Awaitable[T]] | None = None,\n    lease_kwargs: dict[str, Any] | None = None,\n    allow_failover: bool = True,\n) -> tuple[str, T]:\n''',
        "V45_ON_LEASE_SIGNATURE",
    )
    text = replace_once(
        text,
        '''        result = await session.run_selected(\n            operation_for_lease,\n            retry_operation=retry_operation,\n        )\n''',
        '''        result = await session.run_selected(\n            operation_for_lease,\n            retry_operation=retry_operation,\n            allow_failover=allow_failover,\n        )\n''',
        "V45_ON_LEASE_FORWARD",
    )
    text = replace_once(
        text,
        '''    retry_operation: Callable[[Any], Awaitable[T]] | None = None,\n    lease_kwargs: dict[str, Any] | None = None,\n) -> T:\n''',
        '''    retry_operation: Callable[[Any], Awaitable[T]] | None = None,\n    lease_kwargs: dict[str, Any] | None = None,\n    allow_failover: bool = True,\n) -> T:\n''',
        "V45_ONE_SHOT_SIGNATURE",
    )
    text = replace_once(
        text,
        '''        retry_operation=retry_operation,\n        lease_kwargs=lease_kwargs,\n    )\n''',
        '''        retry_operation=retry_operation,\n        lease_kwargs=lease_kwargs,\n        allow_failover=allow_failover,\n    )\n''',
        "V45_ONE_SHOT_FORWARD",
    )
    compile(text, "payload/reservation_aware_lease.py", "exec")
    return text


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = args.root
    account_path = root / "payload/account_pool.py"
    server_path = root / "payload/server.py"
    wrapper_path = root / "payload/reservation_aware_lease.py"
    base_account = account_path.read_text(encoding="utf-8")
    base_server = server_path.read_text(encoding="utf-8")
    base_wrapper = wrapper_path.read_text(encoding="utf-8")
    expected = {
        account_path: BASE_ACCOUNT_POOL_BLOB,
        server_path: BASE_SERVER_BLOB,
        wrapper_path: BASE_RESERVATION_LEASE_BLOB,
    }
    for path, text in (
        (account_path, base_account),
        (server_path, base_server),
        (wrapper_path, base_wrapper),
    ):
        actual = git_blob_sha(text)
        if actual != expected[path]:
            raise RuntimeError(f"{path.name}_SOURCE_BLOB_MISMATCH:{actual}")

    import sys
    sys.path.insert(0, str(root))
    from tools.apply_account_pool_dynamic_reservation import apply as agent_account_apply
    from tools.apply_startup_status_cleanup import apply as agent_server_apply

    account_after_agent = agent_account_apply(base_account)
    server_after_agent = agent_server_apply(base_server)
    account_composed = apply_v41_after_agent(account_after_agent)
    wrapper_composed = apply_v45_wrapper(base_wrapper)
    compile(server_after_agent, "payload/server.py", "exec")

    print("V46_COMPOSED_ACCOUNT_BLOB=" + git_blob_sha(account_composed))
    print("V46_COMPOSED_SERVER_BLOB=" + git_blob_sha(server_after_agent))
    print("V46_COMPOSED_WRAPPER_BLOB=" + git_blob_sha(wrapper_composed))
    if not args.apply:
        print("V46_AGENT_CORE_COMPOSITION_PREIMAGE_CHECK_PASS")
        return 0
    account_path.write_text(account_composed, encoding="utf-8")
    server_path.write_text(server_after_agent, encoding="utf-8")
    wrapper_path.write_text(wrapper_composed, encoding="utf-8")
    print("V46_AGENT_CORE_COMPOSITION_APPLY_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
