from dataclasses import dataclass


@dataclass
class Intent:
    state: str = "none"  # none|pending|uncertain|final
    provider_calls: int = 0
    final_payload: str | None = None


class Sim:
    def __init__(self) -> None:
        self.intent = Intent()

    def publish_intent(self) -> None:
        assert self.intent.state == "none"
        self.intent.state = "pending"

    def provider_transport_failure(
        self,
        *,
        provider_entered: bool,
        progress_observation_complete: bool,
    ) -> str:
        assert self.intent.state == "pending"
        self.intent.provider_calls += 1
        if provider_entered and not progress_observation_complete:
            return "ambiguous"
        if not provider_entered and progress_observation_complete:
            return "proven_absent"
        return "ambiguous"

    def provider_success(self, payload: str) -> None:
        assert self.intent.state == "pending"
        self.intent.provider_calls += 1
        self.intent.state = "final"
        self.intent.final_payload = payload

    def current_retry_after_ambiguous(self) -> None:
        self.provider_success("second-account-result")

    def candidate_after_failure(self, outcome: str) -> str:
        if outcome == "proven_absent":
            return "retry_allowed"
        self.intent.state = "uncertain"
        return "fail_closed"


# Reproduce the unsafe V22 + current AccountLease interaction.
sim = Sim()
sim.publish_intent()
outcome = sim.provider_transport_failure(
    provider_entered=True,
    progress_observation_complete=False,
)
assert outcome == "ambiguous"
sim.current_retry_after_ambiguous()
assert sim.intent.state == "final"
assert sim.intent.provider_calls == 2
print("CURRENT_V22_PLUS_LEASE_AMBIGUOUS_FAILOVER_REPRODUCED")

# Candidate V23: an ambiguous provider attempt keeps durable uncertainty and
# forbids another provider call for the same logical request.
sim = Sim()
sim.publish_intent()
outcome = sim.provider_transport_failure(
    provider_entered=True,
    progress_observation_complete=False,
)
assert sim.candidate_after_failure(outcome) == "fail_closed"
assert sim.intent.state == "uncertain"
assert sim.intent.provider_calls == 1
print("V23_AMBIGUOUS_TRANSPORT_FAIL_CLOSED_PASS")

# A retry is allowed only when the lower layer proves provider work never began.
sim = Sim()
sim.publish_intent()
outcome = sim.provider_transport_failure(
    provider_entered=False,
    progress_observation_complete=True,
)
assert outcome == "proven_absent"
assert sim.candidate_after_failure(outcome) == "retry_allowed"
sim.provider_success("safe-retry-result")
assert sim.intent.state == "final"
assert sim.intent.provider_calls == 2
print("V23_PROVEN_PRE_PROVIDER_RETRY_PASS")
