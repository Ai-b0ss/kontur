from __future__ import annotations

import json


def old_wrapper_run(*, allow_failover=None):
    """Model current Agent wrapper: protected V45 kwarg is not accepted."""
    if allow_failover is not None:
        raise TypeError("run() got an unexpected keyword argument 'allow_failover'")
    return "DEFAULT_FAILOVER_PATH"


def v45_wrapper_run(*, allow_failover=True):
    """Model V45 compatibility: default behavior unchanged, protected opt-out explicit."""
    return "DEFAULT_FAILOVER_PATH" if allow_failover else "PROTECTED_NO_FAILOVER_PATH"


def staged_publish(order):
    state = {"account_pool": "old", "server": "old", "wrapper": "old"}
    snapshots = []
    for step in order:
        state[step] = "new"
        snapshots.append(dict(state))
    return snapshots


def protected_call(state):
    if state["server"] == "new":
        if state["wrapper"] != "new":
            try:
                old_wrapper_run(allow_failover=False)
            except TypeError:
                return "INCOMPATIBLE"
            return "UNEXPECTED"
        return v45_wrapper_run(allow_failover=False)
    return "NOT_YET_PROTECTED"


def main() -> None:
    # Current V47 disposable --apply order is account_pool -> server -> wrapper.
    unsafe = staged_publish(["account_pool", "server", "wrapper"])
    unsafe_mid = unsafe[1]
    assert unsafe_mid == {
        "account_pool": "new",
        "server": "new",
        "wrapper": "old",
    }
    assert protected_call(unsafe_mid) == "INCOMPATIBLE"

    # Compatibility-safe publication contract for a real installer:
    # 1) install/read-back V45 wrapper first; it preserves old default behavior;
    # 2) then atomically publish the account_pool + server pair under the existing
    #    pair journal. A crash after the shim leaves the old server usable; a pair
    #    commit cannot expose protected Stage-B without wrapper support.
    safe_pre = {"account_pool": "old", "server": "old", "wrapper": "new"}
    assert protected_call(safe_pre) == "NOT_YET_PROTECTED"
    assert v45_wrapper_run() == "DEFAULT_FAILOVER_PATH"

    safe_post = {"account_pool": "new", "server": "new", "wrapper": "new"}
    assert protected_call(safe_post) == "PROTECTED_NO_FAILOVER_PATH"

    print(json.dumps({
        "verdict": "REPRODUCED_UNSAFE_THREE_FILE_PUBLICATION_GAP_AND_SAFE_STAGING_CONTRACT_PASS",
        "unsafe_mid_state": unsafe_mid,
        "unsafe_mid_result": protected_call(unsafe_mid),
        "safe_pre_state": safe_pre,
        "safe_pre_default_behavior": v45_wrapper_run(),
        "safe_post_state": safe_post,
        "safe_post_result": protected_call(safe_post),
        "required_contract": [
            "publish backward-compatible V45 wrapper before any Stage-B server that can request allow_failover=False",
            "read back and compile wrapper before pair commit",
            "then atomically publish account_pool+server under the existing pair journal",
            "never finalize pair-new while wrapper-old",
            "recovery must distinguish wrapper-prepared from pair-committed",
        ],
    }, sort_keys=True))


if __name__ == "__main__":
    main()
