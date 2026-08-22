import asyncio
from dataclasses import dataclass


class TransportError(Exception):
    pass


class HttpError(Exception):
    pass


class RateLimitError(Exception):
    pass


class ProviderOutcomeUncertain(RuntimeError):
    pass


@dataclass(frozen=True)
class Ctx:
    fail_closed_on_ambiguous_transport: bool = False


def ambiguous(error: Exception) -> bool:
    return isinstance(error, (TransportError, HttpError))


class FakeLease:
    def __init__(self, ctx: Ctx, outcomes: list[object]) -> None:
        self.ctx = ctx
        self.outcomes = list(outcomes)
        self.calls = 0
        self.switches = 0
        self.failures = 0

    async def run(self):
        while True:
            self.calls += 1
            outcome = self.outcomes.pop(0)
            if not isinstance(outcome, BaseException):
                return outcome
            error = outcome
            if self.ctx.fail_closed_on_ambiguous_transport and ambiguous(error):
                self.failures += 1
                raise ProviderOutcomeUncertain from error
            self.failures += 1
            self.switches += 1


async def main() -> None:
    lease = FakeLease(Ctx(True), [TransportError(), "second"])
    try:
        await lease.run()
    except ProviderOutcomeUncertain:
        pass
    else:
        raise AssertionError("ambiguous transport did not fail closed")
    assert (lease.calls, lease.switches, lease.failures) == (1, 0, 1)
    print("V23_ACCOUNTLEASE_TRANSPORT_NO_SIBLING_RETRY_PASS")

    lease = FakeLease(Ctx(True), [HttpError(), "second"])
    try:
        await lease.run()
    except ProviderOutcomeUncertain:
        pass
    else:
        raise AssertionError("HTTP ambiguity did not fail closed")
    assert (lease.calls, lease.switches) == (1, 0)
    print("V23_ACCOUNTLEASE_HTTP_NO_SIBLING_RETRY_PASS")

    lease = FakeLease(Ctx(True), [RateLimitError(), "second"])
    assert await lease.run() == "second"
    assert (lease.calls, lease.switches) == (2, 1)
    print("V23_NON_TRANSPORT_FAILOVER_UNCHANGED_PASS")

    lease = FakeLease(Ctx(False), [TransportError(), "second"])
    assert await lease.run() == "second"
    assert (lease.calls, lease.switches) == (2, 1)
    print("V23_DEFAULT_POOL_BEHAVIOR_UNCHANGED_PASS")


asyncio.run(main())
