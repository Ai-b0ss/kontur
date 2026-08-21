#!/usr/bin/env python3
import datetime as dt, json, os, sys, time, urllib.error, urllib.parse, urllib.request

API = "https://circleci.com/api/v2"
ORG = "Ai-b0ss"
REPO = "kontur"
BRANCH = "ci/kontur-circle-vite-20260821"
OUT = ".free-fabric/runtime/circle-control-result.json"
RECENT_SECONDS = 3600


def call(token, method, path, body=None, timeout=30):
    url = API + path
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method)
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
    except Exception as e:
        return 599, {"message": f"{type(e).__name__}: {e}"}


def err(payload):
    if isinstance(payload, dict):
        return str(payload.get("message") or payload.get("error") or payload)[:700]
    return str(payload)[:700]


def parse_ts(s):
    if not s:
        return None
    try:
        return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def probe(label, token):
    out = {"label": label}
    st, me = call(token, "GET", "/me")
    out["me_status"] = st
    if st != 200:
        out["error"] = err(me)
        return out
    out["login"] = me.get("login")
    out["user_id"] = me.get("id")
    st, collab = call(token, "GET", "/me/collaborations")
    out["collaborations_status"] = st
    if st == 200 and isinstance(collab, list):
        out["collaborations"] = [
            {"id": x.get("id"), "name": x.get("name"), "slug": x.get("slug"), "vcs_type": x.get("vcs-type") or x.get("vcs_type")}
            for x in collab
        ]
    else:
        out["collaborations_error"] = err(collab)
    return out


def get_or_create_oauth_project(token, trace):
    slug = f"gh/{ORG}/{REPO}"
    st, proj = call(token, "GET", "/project/" + urllib.parse.quote(slug, safe="/"))
    trace.append({"op": "get_project", "status": st, "slug": slug, "error": None if st == 200 else err(proj)})
    if st == 404:
        st, proj = call(token, "POST", f"/organization/gh/{ORG}/project", {"name": REPO})
        trace.append({"op": "create_project", "status": st, "slug": slug, "error": None if st == 200 else err(proj)})
    if st != 200:
        return None
    return proj.get("slug") or slug


def workflows(token, pipeline_id):
    st, wf = call(token, "GET", f"/pipeline/{pipeline_id}/workflow")
    return st, wf


def adopt_recent(token, project_slug, trace):
    q = urllib.parse.urlencode({"branch": BRANCH})
    st, payload = call(token, "GET", "/project/" + urllib.parse.quote(project_slug, safe="/") + f"/pipeline?{q}")
    trace.append({"op": "list_branch_pipelines", "status": st, "error": None if st == 200 else err(payload)})
    if st != 200:
        return None
    now = dt.datetime.now(dt.timezone.utc)
    for p in payload.get("items", []):
        if ((p.get("vcs") or {}).get("branch") or p.get("branch")) != BRANCH:
            continue
        ts = parse_ts(p.get("created_at"))
        if ts and (now - ts).total_seconds() > RECENT_SECONDS:
            continue
        pid = p.get("id")
        if not pid:
            continue
        trace.append({"op": "adopt_recent_pipeline", "pipeline_id": pid, "pipeline_number": p.get("number"), "created_at": p.get("created_at")})
        return {"project_slug": project_slug, "pipeline_id": pid, "pipeline_number": p.get("number"), "adopted": True}
    return None


def trigger(token, project_slug, trace):
    st, p = call(token, "POST", "/project/" + urllib.parse.quote(project_slug, safe="/") + "/pipeline", {"branch": BRANCH})
    trace.append({"op": "trigger_pipeline", "status": st, "error": None if st in (200,201) else err(p)})
    if st not in (200, 201):
        return None
    return {"project_slug": project_slug, "pipeline_id": p.get("id"), "pipeline_number": p.get("number"), "adopted": False}


def poll(token, started, trace, deadline_s=1500):
    pid = started.get("pipeline_id")
    if not pid:
        return {"status": "route-error", **started}
    deadline = time.time() + deadline_s
    last = None
    while time.time() < deadline:
        st, wf = workflows(token, pid)
        if st != 200:
            last = {"workflow_status": st, "error": err(wf)}
            time.sleep(8)
            continue
        items = wf.get("items", [])
        if not items:
            last = {"workflow_status": 200, "workflows": []}
            time.sleep(8)
            continue
        statuses = [x.get("status") for x in items]
        if statuses != last:
            trace.append({"op": "poll", "statuses": statuses})
            last = statuses
        terminal = {"success", "failed", "error", "canceled", "unauthorized", "not_run"}
        if all(s in terminal for s in statuses):
            jobs = []
            for x in items:
                wid = x.get("id")
                if not wid:
                    continue
                js, jp = call(token, "GET", f"/workflow/{wid}/job")
                if js == 200:
                    for j in jp.get("items", []):
                        jobs.append({
                            "name": j.get("name"), "status": j.get("status"),
                            "job_number": j.get("job_number"), "project_slug": j.get("project_slug"),
                            "started_at": j.get("started_at"), "stopped_at": j.get("stopped_at")
                        })
            overall = "success" if all(s == "success" for s in statuses) else "failed"
            return {"status": overall, "workflow_statuses": statuses, "jobs": jobs, **started}
        time.sleep(8)
    return {"status": "timeout", "last": last, **started}


def main():
    report = {"target_branch": BRANCH, "probes": [], "attempts": [], "selected": None, "result": None}
    # Explicit priority: A (old account) first, B (new account) second.
    for label, envname in [("A", "CIRCLE_TOKEN_A"), ("B", "CIRCLE_TOKEN_B")]:
        token = os.environ.get(envname)
        if not token:
            report["probes"].append({"label": label, "error": "secret missing"})
            continue
        p = probe(label, token)
        report["probes"].append(p)
        if p.get("me_status") != 200:
            continue
        trace = []
        slug = get_or_create_oauth_project(token, trace)
        if not slug:
            report["attempts"].append({"label": label, "route": "github-oauth", "trace": trace})
            continue
        started = adopt_recent(token, slug, trace) or trigger(token, slug, trace)
        report["attempts"].append({"label": label, "route": "github-oauth", "trace": trace})
        if not started:
            continue
        report["selected"] = label
        report["result"] = poll(token, started, trace)
        # A started a real pipeline: a build failure is not an account-route failure, so do not duplicate on B.
        break
    if report["result"] is None:
        report["result"] = {"status": "no-working-circle-route"}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["result"].get("status") == "success" else 2

if __name__ == "__main__":
    sys.exit(main())
