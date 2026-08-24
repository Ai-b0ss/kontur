from __future__ import annotations

import hashlib, json, os
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Callable

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

@dataclass(frozen=True)
class Preimage:
    exists: bool
    data: bytes | None
    synthetic_absent_parent: bool = False

@dataclass(frozen=True)
class Target:
    key: str
    rel: str
    path: Path


def safe_rel(s:str)->str:
    p=PurePosixPath(s)
    if not s or p.is_absolute() or any(x in {'','.', '..'} for x in p.parts): raise Blocked('unsafe-rel')
    if '\\' in s or ':' in s: raise Blocked('unsafe-rel')
    return p.as_posix()


def target_plan(project_root:Path, state_path:Path, schema:str)->dict[str,Target]:
    bridge=Path(project_root)/'bridge'
    if schema==V2_SCHEMA:
        pairs=tuple((n,n) for n in LEGACY_V2_NAMES)
    elif schema==V3_SCHEMA:
        pairs=V3_TARGETS
    else: raise Blocked('schema')
    out={}
    for key,rel in pairs:
        key=safe_rel(key); rel=safe_rel(rel)
        if key in out: raise Blocked('duplicate-key')
        out[key]=Target(key,rel,bridge/PurePosixPath(rel))
    out['installed.json']=Target('installed.json','installed.json',Path(state_path))
    return out


def flat_backup_name(index:int,key:str)->str:
    key=safe_rel(key) if key!='installed.json' else key
    slug=key.replace('/','__').replace('.','_')
    digest=hashlib.sha256(key.encode()).hexdigest()[:12]
    name=f'{index:03d}-{slug[:72]}-{digest}.before'
    if Path(name).name!=name or '/' in name or '\\' in name: raise Blocked('backup-name')
    return name


def marker_bytes(txid:str)->bytes:
    if not txid: raise Blocked('txid')
    return (json.dumps({'schema':OWNER_SCHEMA,'transaction_id':txid},sort_keys=True,separators=(',',':'))+'\n').encode()


def classify_payload_dir(payload_dir:Path)->str:
    if not os.path.lexists(payload_dir): return 'absent'
    if payload_dir.is_symlink() or not payload_dir.is_dir(): raise Blocked('payload-dir-unsafe')
    return 'preexisting'


def capture_preimages(plan:dict[str,Target], payload_dir_state:str, capture:Callable[[Path],Preimage])->dict[str,Preimage]:
    out={}
    for k,t in plan.items():
        if t.rel.startswith('payload/') and payload_dir_state=='absent':
            out[k]=Preimage(False,None,True)
        else:
            out[k]=capture(t.path)
    return out


def begin_payload_dir(payload_dir:Path, txid:str, create_guarded:Callable[[Path],None], write_guarded:Callable[[Path,bytes],None])->None:
    if os.path.lexists(payload_dir): raise Blocked('payload-dir-preexists-race')
    create_guarded(payload_dir)
    if payload_dir.is_symlink() or not payload_dir.is_dir(): raise Blocked('payload-dir-create-drift')
    names=list(payload_dir.iterdir())
    if names: raise Blocked('payload-dir-not-empty-after-create')
    write_guarded(payload_dir/OWNER_NAME,marker_bytes(txid))
    require_marker(payload_dir,txid)


def require_marker(payload_dir:Path,txid:str)->None:
    if payload_dir.is_symlink() or not payload_dir.is_dir(): raise Blocked('payload-dir-unsafe')
    m=payload_dir/OWNER_NAME
    if m.is_symlink() or not m.is_file() or m.read_bytes()!=marker_bytes(txid): raise Blocked('owner-marker-drift')


def validate_nested_absent_before_write(target:Target, pre:Preimage, payload_dir:Path, txid:str)->None:
    if not pre.synthetic_absent_parent: return
    require_marker(payload_dir,txid)
    if os.path.lexists(target.path): raise Blocked('nested-target-appeared')


def rollback_created_payload_dir(payload_dir:Path,txid:str,managed_paths:set[Path],unlink_guarded:Callable[[Path],None],delete_guarded:Callable[[Path],None])->None:
    require_marker(payload_dir,txid)
    allowed={p.name for p in managed_paths if p.parent==payload_dir}|{OWNER_NAME}
    actual={p.name for p in payload_dir.iterdir()}
    if not actual.issubset(allowed): raise Blocked('foreign-child')
    remaining=actual-{OWNER_NAME}
    if remaining: raise Blocked('managed-child-remains')
    unlink_guarded(payload_dir/OWNER_NAME)
    if any(payload_dir.iterdir()): raise Blocked('payload-dir-not-empty')
    delete_guarded(payload_dir)
    if os.path.lexists(payload_dir): raise Blocked('payload-dir-delete-failed')


def finalize_verified_payload_dir(payload_dir:Path,txid:str,was_absent:bool,phase:str,unlink_guarded:Callable[[Path],None])->None:
    if not was_absent: return
    if phase!='verified': raise Blocked('premature-owner-marker-cleanup')
    require_marker(payload_dir,txid)
    unlink_guarded(payload_dir/OWNER_NAME)
    if not payload_dir.is_dir() or payload_dir.is_symlink(): raise Blocked('payload-dir-postcommit-drift')


def validate_v2_journal_keyset(descs:dict[str,object],project_root:Path,state_path:Path)->None:
    expected=set(target_plan(project_root,state_path,V2_SCHEMA))
    if set(descs)!=expected: raise Blocked('v2-keyset')


def validate_v3_journal_map(raw:dict[str,str],project_root:Path,state_path:Path)->dict[str,Target]:
    expected=target_plan(project_root,state_path,V3_SCHEMA)
    canon={k:t.rel for k,t in expected.items()}
    if raw!=canon: raise Blocked('v3-target-map-drift')
    return expected


def self_test()->None:
    import tempfile
    cases=0
    with tempfile.TemporaryDirectory() as td:
        root=Path(td); bridge=root/'bridge'; bridge.mkdir(); state=root/'installed.json'
        v2=target_plan(root,state,V2_SCHEMA); v3=target_plan(root,state,V3_SCHEMA)
        assert len(v2)==11 and len(v3)==26; cases+=1
        assert 'turn_affinity.py' not in v2 and 'turn_affinity.py' in v3; cases+=1
        names=[flat_backup_name(i,k) for i,k in enumerate(sorted(v3))]
        assert len(names)==len(set(names)) and all(Path(n).name==n for n in names); cases+=1
        for bad in ('../x','payload\\x.py','/abs','a:b'):
            try: safe_rel(bad); raise AssertionError
            except Blocked: pass
        cases+=1
        pdir=bridge/'payload'; assert classify_payload_dir(pdir)=='absent'; cases+=1
        pre=capture_preimages(v3,'absent',lambda p: Preimage(os.path.lexists(p),p.read_bytes() if p.is_file() else None))
        assert all(pre[k].synthetic_absent_parent for k in pre if k.startswith('payload/')); cases+=1
        created=[]; writes=[]
        def cd(p): p.mkdir(); created.append(p)
        def wg(p,b): p.write_bytes(b); writes.append(p)
        begin_payload_dir(pdir,'tx-1',cd,wg); cases+=1
        t=v3['payload/delegation_policy.py']; validate_nested_absent_before_write(t,pre[t.key],pdir,'tx-1'); cases+=1
        t.path.write_text('new')
        try: rollback_created_payload_dir(pdir,'tx-1',{x.path for x in v3.values() if x.rel.startswith('payload/')},lambda p:p.unlink(),lambda p:p.rmdir()); raise AssertionError
        except Blocked: pass
        cases+=1
        t.path.unlink(); rollback_created_payload_dir(pdir,'tx-1',{x.path for x in v3.values() if x.rel.startswith('payload/')},lambda p:p.unlink(),lambda p:p.rmdir()); assert not pdir.exists(); cases+=1
        begin_payload_dir(pdir,'tx-2',cd,wg); (pdir/'FOREIGN').write_text('x')
        try: rollback_created_payload_dir(pdir,'tx-2',set(),lambda p:p.unlink(),lambda p:p.rmdir()); raise AssertionError
        except Blocked: pass
        assert (pdir/'FOREIGN').exists(); cases+=1
        (pdir/'FOREIGN').unlink(); (pdir/OWNER_NAME).write_bytes(marker_bytes('other'))
        try: rollback_created_payload_dir(pdir,'tx-2',set(),lambda p:p.unlink(),lambda p:p.rmdir()); raise AssertionError
        except Blocked: pass
        cases+=1
        (pdir/OWNER_NAME).write_bytes(marker_bytes('tx-2')); finalize_verified_payload_dir(pdir,'tx-2',True,'verified',lambda p:p.unlink()); assert pdir.exists() and not (pdir/OWNER_NAME).exists(); cases+=1
        pdir.rmdir()
        validate_v2_journal_keyset({k:{} for k in v2},root,state); cases+=1
        try: validate_v2_journal_keyset({k:{} for k in v3},root,state); raise AssertionError
        except Blocked: pass
        cases+=1
        raw={k:t.rel for k,t in v3.items()}; validate_v3_journal_map(raw,root,state); cases+=1
        raw['server.py']='evil.py'
        try: validate_v3_journal_map(raw,root,state); raise AssertionError
        except Blocked: pass
        cases+=1
    print(f'PROMOTED_INSTALLER_V3_ENGINE_CANDIDATE_PASS cases={cases}')

if __name__=='__main__': self_test()
