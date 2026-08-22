#!/usr/bin/env python3
import asyncio, json


class TransportError(RuntimeError):
    pass


class FakeLease:
    def __init__(self):
        self.account_id = "A"
        self.provider_calls = []
        self.switches = 0

    async def run(self, operation, *, retry_operation=None, allow_failover=True):
        try:
            self.provider_calls.append(self.account_id)
            return await operation(object())
        except TransportError:
            if not allow_failover:
                raise
            self.switches += 1
            self.account_id = "B"
            delegate = retry_operation or operation
            self.provider_calls.append(self.account_id)
            return await delegate(object())


class CurrentDynamicSession:
    """Semantic model of fresh reservation_aware_lease.py boundary."""

    def __init__(self, lease):
        self._lease = lease

    async def run(self, operation, *, retry_operation=None):
        if retry_operation is None:
            return await self._lease.run(operation)
        return await self._lease.run(operation, retry_operation=retry_operation)


class CandidateDynamicSession:
    """Candidate bridge that preserves Core V41's caller-controlled failover policy."""

    def __init__(self, lease):
        self._lease = lease

    async def run(self, operation, *, retry_operation=None, allow_failover=True):
        if retry_operation is None:
            return await self._lease.run(operation, allow_failover=allow_failover)
        return await self._lease.run(
            operation,
            retry_operation=retry_operation,
            allow_failover=allow_failover,
        )


async def protected_operation(_client):
    raise TransportError("ambiguous post-intent transport")


async def main():
    current_lease = FakeLease()
    current = CurrentDynamicSession(current_lease)
    current_error = None
    try:
        await current.run(protected_operation)
    except Exception as error:
        current_error = type(error).__name__

    candidate_lease = FakeLease()
    candidate = CandidateDynamicSession(candidate_lease)
    candidate_error = None
    try:
        await candidate.run(protected_operation, allow_failover=False)
    except Exception as error:
        candidate_error = type(error).__name__

    default_lease = FakeLease()
    default = CandidateDynamicSession(default_lease)
    default_error = None
    try:
        await default.run(protected_operation)
    except Exception as error:
        default_error = type(error).__name__

    result = {
        "current": {
            "provider_calls": current_lease.provider_calls,
            "switches": current_lease.switches,
            "error": current_error,
        },
        "candidate_protected": {
            "provider_calls": candidate_lease.provider_calls,
            "switches": candidate_lease.switches,
            "error": candidate_error,
        },
        "candidate_default_agent": {
            "provider_calls": default_lease.provider_calls,
            "switches": default_lease.switches,
            "error": default_error,
        },
    }

    assert result["current"]["provider_calls"] == ["A", "B"]
    assert result["current"]["switches"] == 1
    assert result["candidate_protected"]["provider_calls"] == ["A"]
    assert result["candidate_protected"]["switches"] == 0
    assert result["candidate_protected"]["error"] == "TransportError"
    assert result["candidate_default_agent"]["provider_calls"] == ["A", "B"]
    assert result["candidate_default_agent"]["switches"] == 1

    print(json.dumps({
        "verdict": "NOTION_V41_AGENT_DYNAMIC_SESSION_FAILOVER_OPT_OUT_GAP_REPRODUCED_CANDIDATE_PASS",
        **result,
    }, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
