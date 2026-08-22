#!/usr/bin/env python3
import hashlib
import json


def current_get_session_key(headers, body):
    metadata = body.get("metadata") or {}
    values = [
        headers.get("x-opencode-session"),
        headers.get("x-opencode-session-id"),
        headers.get("x-session-id"),
        headers.get("x-conversation-id"),
        body.get("session_id"),
        body.get("sessionId"),
        body.get("sessionID"),
        body.get("conversation_id"),
        body.get("conversationId"),
        body.get("conversationID"),
        body.get("chat_id"),
        body.get("chatId"),
        metadata.get("session_id"),
        metadata.get("sessionId"),
        metadata.get("sessionID"),
        metadata.get("conversation_id"),
        metadata.get("conversationId"),
        metadata.get("conversationID"),
    ]
    value = next((value for value in values if value), None)
    if value:
        return str(value).strip()
    seed = json.dumps(
        {
            "model": body.get("model") or "",
            "user": body.get("user") or metadata.get("user_id") or metadata.get("userId") or "default",
            "firstUser": "",
        },
        sort_keys=True,
    )
    return "derived-v2-" + hashlib.sha256(seed.encode()).hexdigest()[:32]


def current_has_explicit(headers, body):
    metadata = body.get("metadata") or {}
    return bool(
        headers.get("x-opencode-session")
        or headers.get("x-opencode-session-id")
        or headers.get("x-session-id")
        or headers.get("x-conversation-id")
        or body.get("session_id")
        or body.get("sessionId")
        or body.get("sessionID")
        or body.get("conversation_id")
        or body.get("conversationId")
        or body.get("conversationID")
        or body.get("chat_id")
        or body.get("chatId")
        or metadata.get("session_id")
        or metadata.get("sessionId")
        or metadata.get("sessionID")
        or metadata.get("conversation_id")
        or metadata.get("conversationId")
        or metadata.get("conversationID")
    )


ALIASES = (
    ("header:x-opencode-session", lambda h, b: (h.get("x-opencode-session"), "x-opencode-session" in h)),
    ("header:x-opencode-session-id", lambda h, b: (h.get("x-opencode-session-id"), "x-opencode-session-id" in h)),
    ("header:x-session-id", lambda h, b: (h.get("x-session-id"), "x-session-id" in h)),
    ("header:x-conversation-id", lambda h, b: (h.get("x-conversation-id"), "x-conversation-id" in h)),
    ("body:session_id", lambda h, b: (b.get("session_id"), "session_id" in b)),
    ("body:sessionId", lambda h, b: (b.get("sessionId"), "sessionId" in b)),
    ("body:sessionID", lambda h, b: (b.get("sessionID"), "sessionID" in b)),
    ("body:conversation_id", lambda h, b: (b.get("conversation_id"), "conversation_id" in b)),
    ("body:conversationId", lambda h, b: (b.get("conversationId"), "conversationId" in b)),
    ("body:conversationID", lambda h, b: (b.get("conversationID"), "conversationID" in b)),
    ("body:chat_id", lambda h, b: (b.get("chat_id"), "chat_id" in b)),
    ("body:chatId", lambda h, b: (b.get("chatId"), "chatId" in b)),
)


class SessionIdentityError(ValueError):
    pass


def strict_explicit_session_id(headers, body):
    entries = []
    for name, getter in ALIASES:
        value, present = getter(headers, body)
        if not present:
            continue
        if not isinstance(value, str):
            raise SessionIdentityError(f"invalid:{name}")
        normalized = value.strip()
        if not normalized:
            raise SessionIdentityError(f"blank:{name}")
        entries.append((name, normalized))

    metadata = body.get("metadata")
    if isinstance(metadata, dict):
        for key in (
            "session_id",
            "sessionId",
            "sessionID",
            "conversation_id",
            "conversationId",
            "conversationID",
        ):
            if key not in metadata:
                continue
            value = metadata[key]
            name = "metadata:" + key
            if not isinstance(value, str):
                raise SessionIdentityError(f"invalid:{name}")
            normalized = value.strip()
            if not normalized:
                raise SessionIdentityError(f"blank:{name}")
            entries.append((name, normalized))

    if not entries:
        return None
    unique = {value for _, value in entries}
    if len(unique) != 1:
        raise SessionIdentityError(
            "conflicting:" + ",".join(f"{name}={value}" for name, value in entries)
        )
    return entries[0][1]


def main():
    cases = {}

    headers = {"x-opencode-session": "session-A"}
    body = {"session_id": "session-B"}
    cases["conflict_current"] = {
        "key": current_get_session_key(headers, body),
        "explicit": current_has_explicit(headers, body),
    }
    assert cases["conflict_current"] == {"key": "session-A", "explicit": True}
    try:
        strict_explicit_session_id(headers, body)
    except SessionIdentityError as error:
        cases["conflict_candidate"] = "REJECT:" + str(error)
    else:
        raise AssertionError("conflicting explicit identities must fail")

    headers = {"x-opencode-session": "   "}
    body = {}
    cases["blank_current"] = {
        "key": current_get_session_key(headers, body),
        "explicit": current_has_explicit(headers, body),
    }
    assert cases["blank_current"] == {"key": "", "explicit": True}
    try:
        strict_explicit_session_id(headers, body)
    except SessionIdentityError as error:
        cases["blank_candidate"] = "REJECT:" + str(error)
    else:
        raise AssertionError("blank explicit identity must fail")

    headers = {"x-opencode-session": " session-Z "}
    body = {"conversation_id": "session-Z"}
    assert strict_explicit_session_id(headers, body) == "session-Z"
    cases["equivalent_aliases_candidate"] = "ACCEPT:session-Z"

    assert strict_explicit_session_id({}, {}) is None
    cases["no_explicit_candidate"] = "NONE"

    print(
        json.dumps(
            {
                "verdict": "QWEN_EXPLICIT_SESSION_ALIAS_CONFLICT_REPRODUCED_STRICT_CONTRACT_PASS",
                "cases": cases,
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
