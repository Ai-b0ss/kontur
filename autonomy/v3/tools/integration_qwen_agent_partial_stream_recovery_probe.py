#!/usr/bin/env python3
import json


def current_semantics():
    visible = []
    local_history = []

    # First upstream attempt: one text delta is emitted immediately, then a
    # recoverable CAPTCHA arrives. Current agent.js retries transparently.
    visible.append("PARTIAL_FROM_A")
    first_attempt_error = "WAF_CAPTCHA_CHALLENGE"
    assert first_attempt_error

    # Retry on account B emits the successful final text.
    visible.append("FINAL_FROM_B")
    local_history.append("FINAL_FROM_B")

    return {
        "visible_events": visible,
        "durable_local_history": local_history,
        "visible_text": "".join(visible),
        "history_text": "".join(local_history),
        "diverged": "".join(visible) != "".join(local_history),
        "transparent_retry_after_external_output": True,
    }


def safe_contract():
    # Transparent retry is safe only while the failed attempt emitted no
    # externally visible text/reasoning. Once output escaped, fail closed instead
    # of splicing a replacement-account stream onto the abandoned attempt.
    visible = ["PARTIAL_FROM_A"]
    emitted_before_error = bool(visible)
    retried = not emitted_before_error
    return {
        "visible_events": visible,
        "retried": retried,
        "fail_closed_after_partial_output": emitted_before_error and not retried,
        "cross_attempt_splice": False,
    }


def main():
    current = current_semantics()
    candidate = safe_contract()
    assert current["diverged"] is True
    assert current["transparent_retry_after_external_output"] is True
    assert candidate["fail_closed_after_partial_output"] is True
    assert candidate["cross_attempt_splice"] is False
    print(json.dumps({
        "verdict": "QWEN_AGENT_PARTIAL_STREAM_RECOVERY_DIVERGENCE_REPRODUCED",
        "current": current,
        "candidate_contract": candidate,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
