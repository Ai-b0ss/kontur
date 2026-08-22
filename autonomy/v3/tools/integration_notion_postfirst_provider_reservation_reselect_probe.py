#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json


class ReservationConflict(RuntimeError):
    pass


class FakeLease:
    def __init__(self, account_id: str, calls: list[str]) -> None:
        self.account_id = account_id
        self.calls = calls

    async def run(self, operation, *, retry_operation=None, allow_failover=True):
        del retry_operation, allow_failover
        self.calls.append(self.account_id)
        return await operation(self)


class CurrentDynamicSession:
    """Semantic model of current DynamicReservationLeaseSession._run/_reselect."""

    def __init__(self, reserved) -> None:
        self.reserved = reserved
        self.calls: list[str] = []
        self.account_id = "A"
        self.lease = FakeLease("A", self.calls)

    async def _refresh(self) -> set[str]:
        return set(self.reserved())

    async def _reselect(self) -> None:
        avoided = await self._refresh()
        for account_id in ("A", "B"):
            if account_id not in avoided:
                self.account_id = account_id
                self.lease = FakeLease(account_id, self.calls)
                return
        raise RuntimeError("no route")

    async def run(self, operation, *, allow_failover=False):
        while True:
            avoided = await self._refresh()
            if self.account_id in avoided:
                await self._reselect()
                continue
            return await self.lease.run(operation, allow_failover=allow_failover)


class CandidateDynamicSession(CurrentDynamicSession):
    """Allow pre-first-call routing, then freeze the account for one durable intent."""

    def __init__(self, reserved) -> None:
        super().__init__(reserved)
        self.provider_started = False

    async def run(self, operation, *, allow_failover=False):
        while True:
            avoided = await self._refresh()
            if self.account_id in avoided:
                if self.provider_started:
                    raise ReservationConflict(
                        "selected account became reserved after provider entry"
                    )
                await self._reselect()
                continue
            result = await self.lease.run(operation, allow_failover=allow_failover)
            self.provider_started = True
            return result


async def scenario(session_type):
    reserved_ids: set[str] = set()
    session = session_type(lambda: set(reserved_ids))
    first = await session.run(
        lambda lease: asyncio.sleep(0, result=f"first:{lease.account_id}"),
        allow_failover=False,
    )
    # A reservation appears only after the first canonical provider step succeeds.
    reserved_ids.add("A")
    correction = None
    error = None
    try:
        correction = await session.run(
            lambda lease: asyncio.sleep(0, result=f"correction:{lease.account_id}"),
            allow_failover=False,
        )
    except Exception as exc:  # noqa: BLE001 - probe records the boundary type
        error = type(exc).__name__
    return {
        "first": first,
        "correction": correction,
        "error": error,
        "provider_accounts": session.calls,
    }


async def prefirst_candidate():
    reserved_ids = {"A"}
    session = CandidateDynamicSession(lambda: set(reserved_ids))
    result = await session.run(
        lambda lease: asyncio.sleep(0, result=f"first:{lease.account_id}"),
        allow_failover=False,
    )
    return {"result": result, "provider_accounts": session.calls}


async def main() -> None:
    current = await scenario(CurrentDynamicSession)
    candidate = await scenario(CandidateDynamicSession)
    prefirst = await prefirst_candidate()

    assert current["provider_accounts"] == ["A", "B"], current
    assert current["correction"] == "correction:B", current
    assert candidate["provider_accounts"] == ["A"], candidate
    assert candidate["error"] == "ReservationConflict", candidate
    assert prefirst["provider_accounts"] == ["B"], prefirst

    print(
        json.dumps(
            {
                "verdict": "NOTION_POSTFIRST_PROVIDER_RESERVATION_RESELECT_REPRODUCED_CANDIDATE_PASS",
                "current": current,
                "candidate": candidate,
                "candidate_prefirst_reselection_preserved": prefirst,
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
