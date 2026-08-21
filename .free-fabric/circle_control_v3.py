#!/usr/bin/env python3
import datetime as dt, json, os, sys, time, urllib.error, urllib.parse, urllib.request
API='https://circleci.com/api/v2'
ORG='Ai-b0ss'; REPO='kontur'; BRANCH='ci/kontur-circle-vite-20260821'
STATE='.free-fabric/runtime/circle-control-state.json'
RECENT_SECONDS=3600

def call(tok, method, path, body=None, timeout=30):
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(API+path,data=data,method=method)
    req.add_header('Circle-Token',tok); req.add_header('Accept','application/json')
    if body is not None: req.add_header('Content-Type','application/json')
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:
            raw=r.read().decode('utf-8','replace'); return r.status,(json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw=e.read().decode('utf-8','replace')
        try: p=json.loads(raw) if raw else {}
        except Exception: p={'message':raw[:500]}
        return e.code,p
    except Exception as e: return 599,{'message':f'{type(e).__name__}: {e}'}

def er(p):
    if isinstance(p,dict): return str(p.get('message') or p.get('error') or p)[:700]
    return str(p)[:700]

def ts(s):
    try: return dt.datetime.fromisoformat((s or '').replace('Z','+00:00'))
    except Exception: return None

def save(d):
    os.makedirs(os.path.dirname(STATE),exist_ok=True)
    with open(STATE,'w',encoding='utf-8') as f: json.dump(d,f,ensure_ascii=False,indent=2)
    print(json.dumps(d,ensure_ascii=False,indent=2))

def probe(label,tok):
    o={'label':label}
    st,me=call(tok,'GET','/me'); o['me_status']=st
    if st!=200: o['error']=er(me); return o
    o['login']=me.get('login'); o['user_id']=me.get('id')
    st,c=call(tok,'GET','/me/collaborations'); o['collaborations_status']=st
    if st==200 and isinstance(c,list):
        o['collaborations']=[{'id':x.get('id'),'name':x.get('name'),'slug':x.get('slug'),'vcs_type':x.get('vcs-type') or x.get('vcs_type')} for x in c]
    else: o['collaborations_error']=er(c)
    return o

def project(tok,trace):
    slug=f'gh/{ORG}/{REPO}'
    st,p=call(tok,'GET','/project/'+urllib.parse.quote(slug,safe='/'))
    trace.append({'op':'get_project','status':st,'slug':slug,'error':None if st==200 else er(p)})
    if st==404:
        st,p=call(tok,'POST',f'/organization/gh/{ORG}/project',{'name':REPO})
        trace.append({'op':'create_project','status':st,'slug':slug,'error':None if st==200 else er(p)})
    if st!=200:return None
    return p.get('slug') or slug

def adopt(tok,slug,trace):
    q=urllib.parse.urlencode({'branch':BRANCH}); st,p=call(tok,'GET','/project/'+urllib.parse.quote(slug,safe='/')+f'/pipeline?{q}')
    trace.append({'op':'list_pipelines','status':st,'error':None if st==200 else er(p)})
    if st!=200:return None
    now=dt.datetime.now(dt.timezone.utc)
    for x in p.get('items',[]):
        b=(x.get('vcs') or {}).get('branch') or x.get('branch')
        if b!=BRANCH:continue
        t=ts(x.get('created_at'))
        if t and (now-t).total_seconds()>RECENT_SECONDS:continue
        if x.get('id'):
            trace.append({'op':'adopt','pipeline_id':x.get('id'),'pipeline_number':x.get('number'),'created_at':x.get('created_at')})
            return {'pipeline_id':x.get('id'),'pipeline_number':x.get('number'),'project_slug':slug,'adopted':True}
    return None

def trigger(tok,slug,trace):
    st,p=call(tok,'POST','/project/'+urllib.parse.quote(slug,safe='/')+'/pipeline',{'branch':BRANCH})
    trace.append({'op':'trigger','status':st,'error':None if st in (200,201) else er(p)})
    if st not in (200,201):return None
    return {'pipeline_id':p.get('id'),'pipeline_number':p.get('number'),'project_slug':slug,'adopted':False}

def start():
    d={'phase':'start','target_branch':BRANCH,'probes':[],'attempts':[],'selected':None,'pipeline':None,'result':{'status':'not-started'}}
    for label,key in [('A','CIRCLE_TOKEN_A'),('B','CIRCLE_TOKEN_B')]:
        tok=os.environ.get(key)
        if not tok: d['probes'].append({'label':label,'error':'secret missing'}); continue
        pr=probe(label,tok); d['probes'].append(pr)
        if pr.get('me_status')!=200:continue
        tr=[]; slug=project(tok,tr)
        if not slug: d['attempts'].append({'label':label,'trace':tr}); continue
        s=adopt(tok,slug,tr) or trigger(tok,slug,tr); d['attempts'].append({'label':label,'trace':tr})
        if not s:continue
        d['selected']=label; d['pipeline']=s; d['result']={'status':'running'}; break
    if not d['pipeline']:d['result']={'status':'no-working-circle-route'}
    save(d); return 0 if d['pipeline'] else 2

def poll():
    d=json.load(open(STATE,encoding='utf-8')); label=d.get('selected'); p=d.get('pipeline') or {}
    tok=os.environ.get('CIRCLE_TOKEN_A' if label=='A' else 'CIRCLE_TOKEN_B') if label else None
    pid=p.get('pipeline_id')
    if not tok or not pid: d['phase']='final'; d['result']={'status':'poll-input-missing'}; save(d); return 2
    deadline=time.time()+1500; last=None
    while time.time()<deadline:
        st,w=call(tok,'GET',f'/pipeline/{pid}/workflow')
        if st!=200: last={'http':st,'error':er(w)}; time.sleep(8); continue
        items=w.get('items',[])
        if not items: last={'workflows':[]}; time.sleep(8); continue
        statuses=[x.get('status') for x in items]; last={'statuses':statuses}
        terminal={'success','failed','error','canceled','unauthorized','not_run'}
        if all(s in terminal for s in statuses):
            jobs=[]
            for x in items:
                wid=x.get('id')
                if not wid:continue
                js,jp=call(tok,'GET',f'/workflow/{wid}/job')
                if js==200:
                    for j in jp.get('items',[]): jobs.append({'name':j.get('name'),'status':j.get('status'),'job_number':j.get('job_number'),'project_slug':j.get('project_slug'),'started_at':j.get('started_at'),'stopped_at':j.get('stopped_at')})
            d['phase']='final'; d['result']={'status':'success' if all(s=='success' for s in statuses) else 'failed','workflow_statuses':statuses,'jobs':jobs,**p}; save(d)
            return 0 if d['result']['status']=='success' else 2
        time.sleep(8)
    d['phase']='final'; d['result']={'status':'timeout','last':last,**p}; save(d); return 2

if __name__=='__main__':
    mode=sys.argv[1] if len(sys.argv)>1 else 'start'
    sys.exit(start() if mode=='start' else poll())
