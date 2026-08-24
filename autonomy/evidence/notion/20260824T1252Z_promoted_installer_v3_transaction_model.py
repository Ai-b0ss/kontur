from __future__ import annotations
import hashlib, json, tempfile
from pathlib import Path, PurePosixPath

V2_SCHEMA='ncm25-integrated-outer-transaction-v2'
V3_SCHEMA='ncm25-integrated-outer-transaction-v3'
LEGACY_V2_NAMES=(
    'server.py','account_pool.py','diagnostics.py','auth_contract.py','migration_contract.py',
    'stable_identity.py','stable_runtime_state.py','thread_state_registry.py','transport_evidence.py',
    'conversation_segments.py',
)
V3_TARGETS=(
    ('server.py','server.py'),('account_pool.py','account_pool.py'),('diagnostics.py','diagnostics.py'),
    ('auth_contract.py','auth_contract.py'),('migration_contract.py','migration_contract.py'),
    ('stable_identity.py','stable_identity.py'),('stable_runtime_state.py','stable_runtime_state.py'),
    ('thread_state_registry.py','thread_state_registry.py'),('transport_evidence.py','transport_evidence.py'),
    ('conversation_segments.py','conversation_segments.py'),('turn_affinity.py','turn_affinity.py'),
    ('prompt_modes.py','prompt_modes.py'),('server_subagent_lifecycle.py','server_subagent_lifecycle.py'),
    ('reservation_aware_lease.py','reservation_aware_lease.py'),
    ('payload/delegated_tool_loop.py','payload/delegated_tool_loop.py'),
    ('payload/delegation_dispatcher.py','payload/delegation_dispatcher.py'),
    ('payload/delegation_policy.py','payload/delegation_policy.py'),
    ('payload/notion_delegated_model_step.py','payload/notion_delegated_model_step.py'),
    ('payload/notion_delegation_adapter.py','payload/notion_delegation_adapter.py'),
    ('payload/notion_subagent_runtime.py','payload/notion_subagent_runtime.py'),
    ('payload/reservation_aware_lease.py','payload/reservation_aware_lease.py'),
    ('payload/server_subagent_runtime.py','payload/server_subagent_runtime.py'),
    ('payload/subagent_entrypoint.py','payload/subagent_entrypoint.py'),
    ('payload/subagent_lifecycle.py','payload/subagent_lifecycle.py'),
    ('payload/subagent_tombstone_store.py','payload/subagent_tombstone_store.py'),
)

def safe_rel(s:str)->str:
    p=PurePosixPath(s)
    if not s or p.is_absolute() or any(x in {'','.', '..'} for x in p.parts):
        raise ValueError('unsafe rel')
    if '\\' in s or ':' in s:
        raise ValueError('unsafe rel')
    return p.as_posix()

def flat_backup_name(index:int,key:str)->str:
    key=safe_rel(key)
    slug=key.replace('/','__').replace('.','_')
    digest=hashlib.sha256(key.encode()).hexdigest()[:12]
    return f'{index:03d}-{slug[:72]}-{digest}.before'

def v2_expected_paths(project_root:Path,state_path:Path):
    b=project_root/'bridge'
    return {n:b/n for n in LEGACY_V2_NAMES}|{'installed.json':state_path}

def v3_target_plan(project_root:Path,state_path:Path):
    b=project_root/'bridge'; out={}; seen_cf={}
    for key,rel in V3_TARGETS:
        key=safe_rel(key); rel=safe_rel(rel); cf=rel.casefold()
        if cf in seen_cf and seen_cf[cf]!=rel: raise ValueError('case collision')
        seen_cf[cf]=rel; out[key]=b/Path(*PurePosixPath(rel).parts)
    out['installed.json']=state_path
    return out

def journal_expected_paths(journal:dict,project_root:Path,state_path:Path):
    schema=journal.get('schema')
    if schema==V2_SCHEMA: return v2_expected_paths(project_root,state_path)
    if schema!=V3_SCHEMA: raise ValueError('unsupported schema')
    targets=journal.get('managed_targets')
    if not isinstance(targets,dict): raise ValueError('missing managed targets')
    canonical=v3_target_plan(project_root,state_path)
    if set(targets)!=set(canonical): raise ValueError('target keyset mismatch')
    resolved={}; bridge=project_root/'bridge'
    for key,desc in targets.items():
        if not isinstance(desc,dict): raise ValueError('bad desc')
        rel=desc.get('bridge_rel')
        if key=='installed.json':
            if rel is not None: raise ValueError('installed rel forbidden')
            resolved[key]=state_path
        else:
            rel=safe_rel(rel); want=canonical[key]; got=bridge/Path(*PurePosixPath(rel).parts)
            if got!=want: raise ValueError('target mapping drift')
            resolved[key]=got
    return resolved

def make_v3_manifest(project_root:Path,state_path:Path):
    plan=v3_target_plan(project_root,state_path); targets={}
    for key,path in plan.items():
        targets[key]={'bridge_rel':None if key=='installed.json' else path.relative_to(project_root/'bridge').as_posix()}
    return {'schema':V3_SCHEMA,'managed_targets':targets,'managed_directories':{'bridge/payload':{'rel':'payload','before':'UNKNOWN_UNCAPTURED'}}}

def dir_rollback_allowed(payload_dir:Path,before_exists:bool)->bool:
    if before_exists: return True
    if not payload_dir.exists(): return True
    if payload_dir.is_symlink() or not payload_dir.is_dir(): return False
    return not any(payload_dir.iterdir())

def run():
    with tempfile.TemporaryDirectory() as td:
        root=Path(td)/'proj'; root.mkdir(); (root/'bridge').mkdir(); state=Path(td)/'home/installed.json'; state.parent.mkdir()
        keys=list(v3_target_plan(root,state)); names=[flat_backup_name(i,k) for i,k in enumerate(sorted(keys))]
        assert len(names)==len(set(names))
        assert all(Path(n).name==n and '/' not in n and '\\' not in n for n in names)
        assert flat_backup_name(1,'payload/a.b')!=flat_backup_name(1,'payload/a/b')
        v2={'schema':V2_SCHEMA}
        assert set(journal_expected_paths(v2,root,state))==set(LEGACY_V2_NAMES)|{'installed.json'}
        assert 'turn_affinity.py' not in journal_expected_paths(v2,root,state)
        v3=make_v3_manifest(root,state); got=journal_expected_paths(v3,root,state)
        assert got['payload/delegation_dispatcher.py']==root/'bridge/payload/delegation_dispatcher.py'
        assert got['turn_affinity.py']==root/'bridge/turn_affinity.py'
        bad=json.loads(json.dumps(v3)); bad['managed_targets']['server.py']['bridge_rel']='payload/server.py'
        try: journal_expected_paths(bad,root,state); raise AssertionError('mapping drift accepted')
        except ValueError: pass
        bad=json.loads(json.dumps(v3)); bad['managed_targets']['server.py']['bridge_rel']='../server.py'
        try: journal_expected_paths(bad,root,state); raise AssertionError('traversal accepted')
        except ValueError: pass
        pd=root/'bridge/payload'; pd.mkdir(); assert dir_rollback_allowed(pd,False)
        (pd/'FOREIGN').write_text('x'); assert not dir_rollback_allowed(pd,False)
        (pd/'FOREIGN').unlink(); assert dir_rollback_allowed(pd,False)
        marker={'managed_sha256':{k:'0'*64 for k in got}}; assert set(marker['managed_sha256'])==set(got)
    print('PROMOTED_INSTALLER_V3_TRANSACTION_MODEL_PASS cases=12 targets=%d' % len(V3_TARGETS))

if __name__=='__main__': run()
