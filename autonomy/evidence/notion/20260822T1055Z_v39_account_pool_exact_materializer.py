from __future__ import annotations
import argparse, hashlib
from pathlib import Path

EXPECTED_BLOB='11cea792a2f5aaa40ee1515faddfd44e76cbb23f'

def git_blob_sha(data: bytes)->str:
    return hashlib.sha1(b'blob '+str(len(data)).encode('ascii')+b'\0'+data).hexdigest()

def replace_once(text,old,new,label):
    n=text.count(old)
    if n!=1: raise RuntimeError(f'{label}: expected one anchor, got {n}')
    return text.replace(old,new,1)

def transform(text:str)->str:
    text=replace_once(text,
'''    async def run(\n        self,\n        operation: Callable[[NotionAgentClient], Awaitable[T]],\n        *,\n        retry_operation: Callable[[NotionAgentClient], Awaitable[T]] | None = None,\n    ) -> T:\n''',
'''    async def run(\n        self,\n        operation: Callable[[NotionAgentClient], Awaitable[T]],\n        *,\n        retry_operation: Callable[[NotionAgentClient], Awaitable[T]] | None = None,\n        allow_failover: bool = True,\n    ) -> T:\n''','run signature')
    old='''                if isinstance(error, NotionAgentError) and error.code == ErrorCode.TRANSPORT:\n                    if self._pending_transport_failure is not None:\n                        self._record_transport_outcome(final_success=False, retry_scheduled=True)\n                    self._record_transport_failure(error, duration_ms=duration_ms)\n                try:\n                    await self._switch_account(error, duration_ms=duration_ms)\n'''
    new='''                if isinstance(error, NotionAgentError) and error.code == ErrorCode.TRANSPORT:\n                    if self._pending_transport_failure is not None:\n                        self._record_transport_outcome(final_success=False, retry_scheduled=True)\n                    self._record_transport_failure(error, duration_ms=duration_ms)\n                if not allow_failover:\n                    if self._slot is not None:\n                        await self._pool._record_failure(self._slot, error, duration_ms)\n                    if self._pending_transport_failure is not None:\n                        self._record_transport_outcome(final_success=False, retry_scheduled=False)\n                    log_event(\n                        log,\n                        "account_failover_suppressed",\n                        level=logging.WARNING,\n                        account_number=(self._slot.number if self._slot is not None else None),\n                        account_id=(self._slot.account_id if self._slot is not None else None),\n                        account_file=(self._pool._account_file(self._slot) if self._slot is not None else None),\n                        reason="durable_provider_intent",\n                    )\n                    raise\n                try:\n                    await self._switch_account(error, duration_ms=duration_ms)\n'''
    text=replace_once(text,old,new,'failover suppression')
    compile(text,'payload/account_pool.py','exec')
    return text

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('root',type=Path); ap.add_argument('--apply',action='store_true'); a=ap.parse_args()
    p=a.root/'payload/account_pool.py'; raw=p.read_bytes(); actual=git_blob_sha(raw)
    if actual!=EXPECTED_BLOB: raise RuntimeError(f'preimage blob mismatch {actual} != {EXPECTED_BLOB}')
    rendered=transform(raw.decode('utf-8')).encode('utf-8')
    if not a.apply:
        print('V39_ACCOUNT_POOL_EXACT_PREIMAGE_CHECK_PASS'); return
    p.write_bytes(rendered); print('V39_ACCOUNT_POOL_EXACT_PREIMAGE_APPLY_PASS')
if __name__=='__main__': main()
