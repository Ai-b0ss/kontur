#!/usr/bin/env python3
import json, os, sys, time, urllib.error, urllib.parse, urllib.request

API = "https://circleci.com/api/v2"
API_V1 = "https://circleci.com/api/v1.1"
TARGET_ORG = "Ai-b0ss"
TARGET_REPO = "kontur"
TARGET_BRANCH = "ci/kontur-circle-vite-20260821"
OUT = ".free-fabric/circle-control-result.json"


def request_json(token, method, url, body=None, timeout=30, auth="bearer"):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method)
    if auth == "bearer":
        req.add_header("Authorization", f"Bearer {token}")
    else:
        req.add_header("Circle-Token", token)
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            payload = {"message": raw[:500]}
        return e.code, payload


def call(token, method, path, body=None, timeout=30):
    return request_json(token, method, API + path, body, timeout, "bearer")


def safe_err(payload):
    if not isinstance(payload, dict):
        return str(payload)[:500]
    return str(payload.get("message") or payload.get("error") or payload)[:500]


def probe(label, token):
    result = {"label": label}
    st, me = call(token, "GET", "/me")
    result["me_status"] = st
    if st == 200:
        result["login"] = me.get("login")
        result["user_id"] = me.get("id")
    else:
        result["error"] = safe_err(me)
        return result
    st, collab = call(token, "GET", "/me/collaborations")
    result["collaborations_status"] = st
    if st == 200 and isinstance(collab, list):
        result["collaborations"] = [
            {"id": x.get("id"), "name": x.get("name"), "slug": x.get("slug"), "vcs_type": x.get("vcs-type")}
            for x in collab
        ]
    else:
        result["collaborations_error"] = safe_err(collab)
    return result


def ensure_project_v1(token, trace):
    # Legacy OAuth projects can still be followed via v1.1. This is a bounded
    # compatibility fallback only; it never mutates repository contents.
    url = f"{API_V1}/project/github/{TARGET_ORG}/{TARGET_REPO}/follow"
    st, payload = request_json(token, "POST", url, None, 30, "circle-token")
    trace.append({"op": "follow_project_v1", "status": st, "error": None if st in (200, 201, 400) else safe_err(payload)})
    # 400 is often "already followed"; caller re-probes v2 project state.
    return st in (200, 201, 400)


def try_oauth_project(token, trace):
    slug = f"gh/{TARGET_ORG}/{TARGET_REPO}"
    path = "/project/" + urllib.parse.quote(slug, safe="/")
    st, proj = call(token, "GET", path)
    trace.append({"op": "get_project", "status": st, "slug": slug, "error": None if st == 200 else safe_err(proj)})
    if st == 404:
        ensure_project_v1(token, trace)
        time.sleep(2)
        st, proj = call(token, "GET", path)
        trace.append({"op": "get_project_after_follow", "status": st, "slug": slug, "error": None if st == 200 else safe_err(proj)})
    if st != 200:
        return None
    project_slug = proj.get("slug") or slug
    st, pipe = call(token, "POST", "/project/" + urllib.parse.quote(project_slug, safe="/") + "/pipeline", {"branch": TARGET_BRANCH})
    trace.append({"op": "trigger_oauth_pipeline", "status": st, "project_slug": project_slug, "error": None if st in (200, 201) else safe_err(pipe)})
    if st not in (200, 201):
        return None
    return {"project_slug": project_slug, "pipeline_id": pipe.get("id"), "pipeline_number": pipe.get("number")}


def poll(token, started, trace, deadline_s=1500):
    pid = started.get("pipeline_id")
    if not pid:
        return {"status": "unknown", **started}
    deadline = time.time() + deadline_s
    workflow_ids = []
    while time.time() < deadline:
        st, wf = call(token, "GET", f"/pipeline/{pid}/workflow")
        if st == 200:
            items = wf.get("items", [])
            workflow_ids = [x.get("id") for x in items if x.get("id")]
            if items:
                statuses = [x.get("status") for x in items]
                trace.append({"op": "poll_workflows", "statuses": statuses})
                terminal = {"success", "failed", "error", "canceled", "unauthorized"}
                if all(s in terminal for s in statuses):
                    jobs = []
                    for wid in workflow_ids:
                        js, jp = call(token, "GET", f"/workflow/{wid}/job")
                        if js == 200:
                            for j in jp.get("items", []):
                                jobs.append({"name": j.get("name"), "status": j.get("status"), "job_number": j.get("job_number"), "project_slug": j.get("project_slug")})
                    overall = "success" if all(s == "success" for s in statuses) else "failed"
                    return {"status": overall, "workflow_statuses": statuses, "jobs": jobs, **started}
        time.sleep(8)
    return {"status": "timeout", "workflow_ids": workflow_ids, **started}


def main():
    tokens = [("A", os.environ.get("CIRCLE_TOKEN_A")), ("B", os.environ.get("CIRCLE_TOKEN_B"))]
    report = {"target_branch": TARGET_BRANCH, "probes": [], "attempts": [], "selected": None, "result": None}
    valid = []
    for label, tok in tokens:
        if not tok:
            report["probes"].append({"label": label, "error": "secret missing"})
            continue
        p = probe(label, tok)
        report["probes"].append(p)
        if p.get("me_status") == 200:
            score = 0
            for c in p.get("collaborations", []):
                if c.get("name") == TARGET_ORG or c.get("slug") in (f"gh/{TARGET_ORG}", f"github/{TARGET_ORG}"):
                    score += 10
            # Prefer A on ties because user identified B as the new account.
            tie = 1 if label == "A" else 0
            valid.append((score, tie, label, tok))
    valid.sort(reverse=True)
    for score, tie, label, tok in valid:
        trace = []
        started = try_oauth_project(tok, trace)
        report["attempts"].append({"label": label, "score": score, "trace": trace})
        if started:
            report["selected"] = label
            report["result"] = poll(tok, started, trace)
            break
    if report["result"] is None:
        report["result"] = {"status": "no-working-oauth-route"}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["result"].get("status") == "success" else 2

if __name__ == "__main__":
    sys.exit(main())
