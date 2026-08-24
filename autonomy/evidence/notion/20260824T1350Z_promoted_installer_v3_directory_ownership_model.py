from __future__ import annotations
import hashlib, json, os, tempfile
from pathlib import Path, PurePosixPath

V2_SCHEMA='ncm25-integrated-outer-transaction-v2'
V3_SCHEMA='ncm25-integrated-outer-transaction-v3'
OWNER_SCHEMA='ncm25-integrated-managed-directory-owner-v1'
OWNER_NAME='.ncm25-outer-owner.json'
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

class Blocked(RuntimeError): pass

def safe_rel(s:str)->str:
    p=PurePosixPath(s)
    if not s or p.is_absolute() or any(x in {'','.', '..'} for x in p.parts): raise Blocked('unsafe-rel')
    if '\\' in s or ':' in s: raise Blocked('unsafe-rel')
    return p.as_posix()

def flat_backup_name(index:int,key:str)->str:
    key=safe_rel(key)
    slug=key.replace('/','__').replace('.','_')
    digest=hashlib.sha256(key.encode()).hexdigest()[:12]
    return f'{index:03d}-{slug[:72]}-{digest}.before'

def payload_names(schema:str):
    if schema==V2_SCHEMA: return LEGACY_V2_NAMES
    if schema==V3_SCHEMA: return tuple(k for k,_ in V3_TARGETS)
    raise Blocked('schema')

def v3_target_map(): return {safe_rel(k):safe_rel(v) for k,v in V3_TARGETS}

def marker_bytes(txid:str)->bytes:
    return (json.dumps({'schema':OWNER_SCHEMA,'transaction_id':txid},sort_keys=True,separators=(',',':'))+'\n').encode()

def ensure_plain_dir(p:Path):
    if p.is_symlink() or not p.is_dir(): raise Blocked('dir-unsafe')

def read_exact_marker(d:Path,txid:str):
    ensure_plain_dir(d); m=d/OWNER_NAME
    if m.is_symlink() or not m.is_file() or m.read_bytes()!=marker_bytes(txid): raise Blocked('owner-marker-missing-or-drift')

def create_owned_dir(d:Path,txid:str):
    if os.path.lexists(d): raise Blocked('preexists')
    d.mkdir()
    (d/OWNER_NAME).write_bytes(marker_bytes(txid))

def synthetic_preimages(plan:dict[str,str], payload_dir_existed:bool):
    out={}
    for key,rel in plan.items():
        if rel.startswith('payload/') and not payload_dir_existed:
            out[key]={'exists':False,'snapshot':'SYNTHETIC_ABSENT_PARENT_NOT_PRESENT'}
        else:
            out[key]={'exists':None,'snapshot':'REAL_CAPTURE_REQUIRED'}
    return out

def rollback_owned_absent_dir(d:Path,txid:str,managed_leafs:set[str]):
    read_exact_marker(d,txid)
    names=set(p.name for p in d.iterdir())
    allowed=set(managed_leafs)|{OWNER_NAME}
    if not names.issubset(allowed): raise Blocked('foreign-child')
    leftovers=names-{OWNER_NAME}
    if leftovers: raise Blocked('managed-files-not-yet-rolled-back')
    (d/OWNER_NAME).unlink(); d.rmdir()

def preserve_preexisting_dir(d:Path):
    ensure_plain_dir(d)
    return d.exists()

def cleanup_verified_marker(d:Path,txid:str,phase:str):
    if phase!='verified': raise Blocked('commit-not-verified')
    read_exact_marker(d,txid)
    (d/OWNER_NAME).unlink()

def run():
    cases=0
    plan=v3_target_map(); assert len(plan)==25; cases+=1
    assert len(payload_names(V2_SCHEMA))==10 and 'turn_affinity.py' not in payload_names(V2_SCHEMA); cases+=1
    assert len(payload_names(V3_SCHEMA))==25 and 'turn_affinity.py' in payload_names(V3_SCHEMA); cases+=1
    names=[flat_backup_name(i,k) for i,k in enumerate(sorted((*plan,'installed.json')))]
    assert len(names)==len(set(names)) and all(Path(n).name==n and '/' not in n and '\\' not in n for n in names); cases+=1
    try: safe_rel('../x'); raise AssertionError
    except Blocked: pass
    try: safe_rel('payload\\x.py'); raise AssertionError
    except Blocked: pass
    cases+=1
    pre=synthetic_preimages(plan,False)
    assert all(v['snapshot'].startswith('SYNTHETIC') for k,v in pre.items() if k.startswith('payload/'))
    assert pre['server.py']['snapshot']=='REAL_CAPTURE_REQUIRED'; cases+=1
    pre2=synthetic_preimages(plan,True)
    assert all(v['snapshot']=='REAL_CAPTURE_REQUIRED' for v in pre2.values()); cases+=1

    with tempfile.TemporaryDirectory() as td:
        root=Path(td); d=root/'bridge'/'payload'; d.parent.mkdir(); tx='tx-1'
        create_owned_dir(d,tx); read_exact_marker(d,tx); cases+=1
        rollback_owned_absent_dir(d,tx,set()); assert not d.exists(); cases+=1

        create_owned_dir(d,tx); (d/'FOREIGN').write_text('x')
        try: rollback_owned_absent_dir(d,tx,set()); raise AssertionError
        except Blocked: pass
        assert d.exists() and (d/'FOREIGN').exists(); cases+=1
        (d/'FOREIGN').unlink(); (d/OWNER_NAME).write_bytes(marker_bytes('other'))
        try: rollback_owned_absent_dir(d,tx,set()); raise AssertionError
        except Blocked: pass
        assert d.exists(); cases+=1
        (d/OWNER_NAME).unlink()
        try: rollback_owned_absent_dir(d,tx,set()); raise AssertionError
        except Blocked: pass
        cases+=1
        d.rmdir()

        d.mkdir()
        try: rollback_owned_absent_dir(d,tx,set()); raise AssertionError
        except Blocked: pass
        assert d.exists(); cases+=1
        d.rmdir()

        d.mkdir(); assert preserve_preexisting_dir(d); cases+=1
        (d/'keep').write_text('foreign'); assert preserve_preexisting_dir(d); cases+=1
        (d/'keep').unlink(); d.rmdir()

        create_owned_dir(d,tx)
        try: cleanup_verified_marker(d,tx,'source_complete'); raise AssertionError
        except Blocked: pass
        assert (d/OWNER_NAME).exists(); cases+=1
        cleanup_verified_marker(d,tx,'verified'); assert d.exists() and not (d/OWNER_NAME).exists(); cases+=1
        d.rmdir()

        create_owned_dir(d,tx); (d/'delegation_policy.py').write_text('new')
        try: rollback_owned_absent_dir(d,tx,{'delegation_policy.py'}); raise AssertionError
        except Blocked: pass
        assert d.exists(); cases+=1
        (d/'delegation_policy.py').unlink(); rollback_owned_absent_dir(d,tx,{'delegation_policy.py'}); cases+=1

        target=root/'foreign'; target.mkdir(); d.symlink_to(target,target_is_directory=True)
        try: read_exact_marker(d,tx); raise AssertionError
        except Blocked: pass
        assert target.exists(); cases+=1

    print(f'PROMOTED_INSTALLER_V3_DIRECTORY_OWNERSHIP_MODEL_PASS cases={cases} targets={len(plan)}')

if __name__=='__main__': run()
