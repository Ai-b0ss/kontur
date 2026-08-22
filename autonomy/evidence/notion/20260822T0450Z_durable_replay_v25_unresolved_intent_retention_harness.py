from __future__ import annotations

from dataclasses import dataclass
import copy

CONVERSATION_TTL = 30 * 24 * 60 * 60
MAX_CONVERSATIONS = 500
MAX_UNRESOLVED_PROVIDER_INTENTS = 128


class PersistenceCapacityError(RuntimeError):
    pass


@dataclass
class Segment:
    updated_at: float
    inflight_fp: str | None = None
    inflight_started_at: float = 0.0


def current_cleanup(
    items: dict[str, Segment],
    *,
    now: float,
    ttl: int = CONVERSATION_TTL,
    maximum: int = MAX_CONVERSATIONS,
) -> dict[str, Segment]:
    cutoff = now - ttl
    kept = {key: item for key, item in items.items() if item.updated_at >= cutoff}
    if len(kept) > maximum:
        kept = dict(
            sorted(
                kept.items(),
                key=lambda pair: pair[1].updated_at,
                reverse=True,
            )[:maximum]
        )
    return kept


def v25_cleanup(
    items: dict[str, Segment],
    *,
    now: float,
    ttl: int = CONVERSATION_TTL,
    maximum: int = MAX_CONVERSATIONS,
    max_unresolved: int = MAX_UNRESOLVED_PROVIDER_INTENTS,
) -> dict[str, Segment]:
    staged = copy.deepcopy(items)
    unresolved = {
        key: item for key, item in staged.items() if item.inflight_fp is not None
    }
    if len(unresolved) > max_unresolved:
        raise PersistenceCapacityError("unresolved provider-intent capacity exhausted")

    cutoff = now - ttl
    ordinary = {
        key: item
        for key, item in staged.items()
        if item.inflight_fp is None and item.updated_at >= cutoff
    }
    ordinary_budget = max(0, maximum - len(unresolved))
    if len(ordinary) > ordinary_budget:
        ordinary = dict(
            sorted(
                ordinary.items(),
                key=lambda pair: pair[1].updated_at,
                reverse=True,
            )[:ordinary_budget]
        )
    return {**ordinary, **unresolved}


# 1. The ordinary 30-day conversation TTL would silently delete an unresolved
# provider-intent tombstone if V22 stored it inside ConversationSegment without
# changing the V12 cleanup rules.
now = CONVERSATION_TTL + 10
items = {
    "ambiguous": Segment(updated_at=0, inflight_fp="req-A", inflight_started_at=1)
}
assert "ambiguous" not in current_cleanup(items, now=now)
print("CURRENT_GENERAL_TTL_DROPS_UNRESOLVED_INTENT_REPRODUCED")

# 2. The ordinary 500-conversation bound can also evict the older unresolved
# intent before its TTL has elapsed.
items = {
    "ambiguous": Segment(updated_at=1, inflight_fp="req-A", inflight_started_at=1)
}
for index in range(MAX_CONVERSATIONS):
    items[f"normal-{index}"] = Segment(updated_at=1000 + index)
assert "ambiguous" not in current_cleanup(items, now=1000)
print("CURRENT_MAX_CONVERSATIONS_DROPS_UNRESOLVED_INTENT_REPRODUCED")

# 3. V25 preserves unresolved intent across both ordinary TTL and ordinary
# capacity pressure.
kept = v25_cleanup(items, now=CONVERSATION_TTL + 10000)
assert kept["ambiguous"].inflight_fp == "req-A"
assert len(kept) <= MAX_CONVERSATIONS
print("V25_UNRESOLVED_INTENT_SURVIVES_TTL_AND_ORDINARY_CAPACITY_PASS")

# 4. Unresolved-intent state remains bounded. Exhaustion is fail-closed instead
# of silently evicting the oldest ambiguous provider outcome.
overflow = {
    f"amb-{index}": Segment(
        updated_at=index,
        inflight_fp=f"req-{index}",
        inflight_started_at=index,
    )
    for index in range(MAX_UNRESOLVED_PROVIDER_INTENTS + 1)
}
try:
    v25_cleanup(overflow, now=999999)
except PersistenceCapacityError:
    print("V25_UNRESOLVED_INTENT_CAPACITY_FAIL_CLOSED_PASS")
else:
    raise AssertionError("capacity overflow was silently accepted")

# 5. Under ordinary pressure, replayable/finished conversations are evicted
# before an unresolved provider-intent tombstone.
items = {
    "ambiguous": Segment(updated_at=1, inflight_fp="req-A", inflight_started_at=1),
    **{
        f"normal-{index}": Segment(updated_at=1000 + index)
        for index in range(MAX_CONVERSATIONS + 100)
    },
}
kept = v25_cleanup(items, now=1000)
assert "ambiguous" in kept
assert len(kept) == MAX_CONVERSATIONS
assert sum(item.inflight_fp is not None for item in kept.values()) == 1
print("V25_ORDINARY_EVICTION_PRECEDES_UNRESOLVED_INTENT_PASS")
