from __future__ import annotations

import json


ACCOUNTS = ("A", "B")


def select(avoid: set[str]) -> str | None:
    return next((account for account in ACCOUNTS if account not in avoid), None)


def reproduce_current() -> dict[str, object]:
    """Model the current DynamicReservationLeaseSession avoid-set semantics.

    Current product code performs ``self._avoided.update(current)`` on every
    reservation refresh and also unions reservation-triggered account ids into
    the same set during reselection.  Therefore a transient reservation becomes
    a permanent exclusion for the rest of the logical session.
    """

    avoided: set[str] = set()
    initial = select(avoided)
    assert initial == "A"

    # A becomes reserved before provider work, so the session reselects to B.
    avoided.update({"A"})
    after_a_reserved = select(avoided)
    assert after_a_reserved == "B"

    # A has now been released, while B becomes reserved. A is objectively free,
    # but the historical union still contains A and now adds B too.
    avoided.update({"B"})
    after_release = select(avoided)

    return {
        "initial": initial,
        "after_a_reserved": after_a_reserved,
        "free_account_now": "A",
        "historical_avoided": sorted(avoided),
        "selected_after_a_release_b_reserved": after_release,
        "failed_with_free_account": after_release is None,
    }


def verify_candidate_contract() -> dict[str, object]:
    """Verify the minimum safe state split, not a product implementation.

    The fix must distinguish persistent exclusions from the *current* reservation
    snapshot.  A released transient reservation must not remain banned merely
    because it existed earlier.  Re-entry to an account used by an earlier remote
    round still requires the existing fresh/full-history recovery boundary; this
    probe intentionally does not weaken account/thread affinity.
    """

    persistent_avoid: set[str] = set()
    current_reserved = {"B"}
    avoid_now = persistent_avoid | current_reserved
    selected = select(avoid_now)
    return {
        "persistent_avoid": sorted(persistent_avoid),
        "current_reserved": sorted(current_reserved),
        "selected": selected,
        "released_account_reeligible": selected == "A",
        "thread_safety_requirement": (
            "if A previously entered provider work, reuse must go through the "
            "existing fresh/full-history recovery path rather than stale thread affinity"
        ),
    }


def main() -> None:
    current = reproduce_current()
    candidate = verify_candidate_contract()
    assert current["failed_with_free_account"] is True
    assert current["historical_avoided"] == ["A", "B"]
    assert candidate["released_account_reeligible"] is True
    print(
        json.dumps(
            {
                "verdict": "NOTION_DYNAMIC_RESERVATION_HISTORICAL_AVOID_GAP_REPRODUCED_CANDIDATE_PASS",
                "current": current,
                "candidate_contract": candidate,
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
