from dataclasses import dataclass
from enum import Enum


class Progress(Enum):
    UNKNOWN = "UNKNOWN"
    PROVEN_NO_REMOTE_PROGRESS = "PROVEN_NO_REMOTE_PROGRESS"


@dataclass(frozen=True)
class TransportObservation:
    provider_call_entered: bool
    response_progress_observation_complete: bool
    response_metadata_observed: bool = False
    first_stream_event_observed: bool = False
    any_response_bytes_observed: bool = False
    curl_code: int | None = None


def current_exact_observation(curl_code: int | None = 28) -> TransportObservation:
    # payload/account_pool.py::_record_transport_failure currently hard-codes these.
    return TransportObservation(
        provider_call_entered=True,
        response_progress_observation_complete=False,
        curl_code=curl_code,
    )


def retry_progress_proof(obs: TransportObservation) -> Progress:
    # Safe sibling retry is allowed only when the system has positive proof that
    # the provider call was never entered. Timing/curl-code hypotheses are not proof.
    if obs.provider_call_entered is False:
        return Progress.PROVEN_NO_REMOTE_PROGRESS
    return Progress.UNKNOWN


def main() -> None:
    for code in (None, 5, 6, 7, 28, 35, 52, 56, 92):
        obs = current_exact_observation(code)
        assert retry_progress_proof(obs) is Progress.UNKNOWN, code
    print("V24_CURRENT_TRANSPORT_EVIDENCE_NEVER_PROVES_SAFE_RETRY_PASS")

    early = TransportObservation(True, True, curl_code=6)
    assert retry_progress_proof(early) is Progress.UNKNOWN
    print("V24_CURL_TIMING_NOT_PROMOTED_TO_REMOTE_ABSENCE_PASS")

    pre = TransportObservation(False, True, curl_code=6)
    assert retry_progress_proof(pre) is Progress.PROVEN_NO_REMOTE_PROGRESS
    print("V24_EXPLICIT_PRE_PROVIDER_PROOF_CAN_ENABLE_RETRY_PASS")

    progress = TransportObservation(
        True, True, first_stream_event_observed=True, curl_code=28
    )
    assert retry_progress_proof(progress) is Progress.UNKNOWN
    print("V24_RESPONSE_PROGRESS_REMAINS_FAIL_CLOSED_PASS")


if __name__ == "__main__":
    main()
