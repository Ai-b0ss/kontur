#!/usr/bin/env python3
import hashlib
import json


def extract_session_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for part in content:
            if isinstance(part, str):
                out.append(part)
            elif isinstance(part, dict) and isinstance(part.get("text"), str):
                out.append(part["text"])
        return "".join(out)
    if isinstance(content, dict):
        if isinstance(content.get("text"), str):
            return content["text"]
        if isinstance(content.get("content"), str):
            return content["content"]
    return ""


def current_derived_key(body):
    messages = body.get("messages") if isinstance(body.get("messages"), list) else []
    first_user = next((m for m in messages if m.get("role") == "user"), None)
    first_content = extract_session_text(first_user.get("content") if first_user else None)
    metadata = body.get("metadata") if isinstance(body.get("metadata"), dict) else {}
    user_key = body.get("user") or metadata.get("user_id") or metadata.get("userId") or ""
    seed = json.dumps(
        {
            "model": body.get("model") or "",
            "user": user_key or "default",
            "firstUser": first_content,
        },
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return "derived-v2-" + hashlib.sha256(seed.encode("utf-8")).hexdigest()[:32]


def candidate_durable_identity(explicit_session_id):
    value = str(explicit_session_id or "").strip()
    if not value:
        return {"durable": False, "key": None}
    return {"durable": True, "key": value}


def main():
    a = {
        "model": "qwen3",
        "messages": [{"role": "user", "content": "Fix the failing test"}],
    }
    b = {
        "model": "qwen3",
        "messages": [{"role": "user", "content": "Fix the failing test"}],
    }

    current_a = current_derived_key(a)
    current_b = current_derived_key(b)
    assert current_a == current_b

    # The same prompt is content, not conversation identity. Two unrelated clients
    # without an explicit session id must not share durable thread/account state.
    assert candidate_durable_identity(None) == {"durable": False, "key": None}
    assert candidate_durable_identity("") == {"durable": False, "key": None}
    assert candidate_durable_identity("conv-A") != candidate_durable_identity("conv-B")

    print(
        json.dumps(
            {
                "verdict": "QWEN_IMPLICIT_SESSION_IDENTITY_COLLISION_REPRODUCED",
                "current_same_derived_key": current_a,
                "independent_identical_prompts_alias": True,
                "candidate_contract": "durable provider-thread/account/session reuse requires explicit client conversation identity; content-derived keys are request-local only",
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
