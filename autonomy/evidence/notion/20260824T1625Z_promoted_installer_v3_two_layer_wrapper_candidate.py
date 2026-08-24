from __future__ import annotations

import hashlib, json, os, tempfile, uuid
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Callable, Protocol

V3_SCHEMA = 'ncm25-promoted-overlay-v3'
V3_JOURNAL_REL = Path('.notionagents') / 'ncm25-promoted-overlay-v3.json'
V3_BACKUP_REL = Path('.notionagents') / 'ncm25-promoted-overlay-v3-backups'
OWNER_NAME = '.ncm25-promoted-owner.json'
OWNER_SCHEMA = 'ncm25-promoted-managed-directory-owner-v1'
PROMOTED_MARKER = 'ncm25_promoted_agent_core_v3'

V3_TARGETS = (
    ('server.py','server.py'),('account_pool.py','account_pool.py'),
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

class Blocked(RuntimeError):
    pass

class Lifecycle(Protocol):
    def status(self) -> str: ...
    def start(self) -> bool: ...
    def stop(self) -> bool: ...

@dataclass(frozen=True)
class Target:
    key: str
    rel: str
    path: Path

@dataclass(frozen=True)
class Backup:
    existed: bool
    data: bytes | None


def _json_bytes(obj: object) -> bytes:
    return (json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode()


def _safe_rel(text: str) -> str:
    p = PurePosixPath(text)
    if not text or p.is_absolute() or '\\' in text or ':' in text or any(x in {'', '.', '..'} for x in p.parts):
        raise Blocked('unsafe-rel')
    return p.as_posix()


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _git_blob_sha(data: bytes) -> str:
    h = hashlib.sha1()
    h.update(f'blob {len(data)}\0'.encode())
    h.update(data)
    return h.hexdigest()


def target_plan(project_root: Path, state_path: Path | None = None) -> dict[str, Target]:
    bridge = Path(project_root) / 'bridge'
    out = {}
    for key, rel in V3_TARGETS:
        key = _safe_rel(key); rel = _safe_rel(rel)
        if key in out:
            raise Blocked('duplicate-key')
        out[key] = Target(key, rel, bridge / PurePosixPath(rel))
    if state_path is not None:
        out['installed.json'] = Target('installed.json', 'installed.json', Path(state_path))
    return out


def _flat_backup_name(index: int, key: str) -> str:
    key = _safe_rel(key)
    slug = key.replace('/', '__').replace('.', '_')
    digest = hashlib.sha256(key.encode()).hexdigest()[:12]
    name = f'{index:03d}-{slug[:72]}-{digest}.before'
    if Path(name).name != name or '/' in name or '\\' in name:
        raise Blocked('backup-name')
    return name


def _plain_file(path: Path) -> bytes | None:
    if not os.path.lexists(path):
        return None
    if path.is_symlink() or not path.is_file():
        raise Blocked('target-not-plain-file')
    return path.read_bytes()


def _payload_dir_state(payload_dir: Path) -> str:
    if not os.path.lexists(payload_dir):
        return 'absent'
    if payload_dir.is_symlink() or not payload_dir.is_dir():
        raise Blocked('payload-dir-unsafe')
    return 'preexisting'


def _marker_bytes(txid: str) -> bytes:
    return _json_bytes({'schema': OWNER_SCHEMA, 'transaction_id': txid})


def _require_marker(payload_dir: Path, txid: str) -> None:
    if payload_dir.is_symlink() or not payload_dir.is_dir():
        raise Blocked('payload-dir-unsafe')
    marker = payload_dir / OWNER_NAME
    if marker.is_symlink() or not marker.is_file() or marker.read_bytes() != _marker_bytes(txid):
        raise Blocked('owner-marker-drift')


def _atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + f'.tmp-{os.getpid()}-{uuid.uuid4().hex}')
    try:
        with open(tmp, 'xb') as f:
            f.write(data); f.flush(); os.fsync(f.fileno())
        os.replace(tmp, path)
        if os.name != 'nt':
            fd = os.open(path.parent, os.O_RDONLY)
            try: os.fsync(fd)
            finally: os.close(fd)
    finally:
        try: tmp.unlink()
        except FileNotFoundError: pass


def _write_journal(path: Path, journal: dict) -> None:
    _atomic(path, _json_bytes(journal))


def _read_journal(path: Path) -> dict:
    raw = _plain_file(path)
    if raw is None:
        raise Blocked('journal-missing')
    obj = json.loads(raw)
    if _json_bytes(obj) != raw or obj.get('schema') != V3_SCHEMA:
        raise Blocked('journal-invalid')
    return obj


def _capture_backups(plan: dict[str, Target], payload_dir_state: str) -> dict[str, Backup]:
    out = {}
    for key, target in plan.items():
        if target.rel.startswith('payload/') and payload_dir_state == 'absent':
            out[key] = Backup(False, None)
        else:
            data = _plain_file(target.path)
            out[key] = Backup(data is not None, data)
    return out


def _descriptors(backups: dict[str, Backup]) -> dict[str, dict]:
    out = {}
    for index, key in enumerate(sorted(backups)):
        b = backups[key]
        out[key] = {
            'exists': b.existed,
            'backup': _flat_backup_name(index, key) if b.existed else None,
            'sha256': _sha(b.data or b'') if b.existed else None,
            'size': len(b.data or b'') if b.existed else 0,
        }
    return out


def _materialize_backups(root: Path, desc: dict[str, dict], backups: dict[str, Backup]) -> None:
    if os.path.lexists(root):
        raise Blocked('backup-root-preexists')
    root.mkdir(parents=True)
    for key, d in desc.items():
        if not d['exists']:
            continue
        b = backups[key]
        assert b.data is not None
        p = root / d['backup']
        _atomic(p, b.data)
        if p.read_bytes() != b.data:
            raise Blocked('backup-readback')


def _load_backups(root: Path, desc: dict[str, dict]) -> dict[str, Backup]:
    if root.is_symlink() or not root.is_dir():
        raise Blocked('backup-root-unsafe')
    out = {}
    allowed = set()
    for key, d in desc.items():
        if not isinstance(d, dict) or not isinstance(d.get('exists'), bool):
            raise Blocked('backup-desc')
        if not d['exists']:
            out[key] = Backup(False, None); continue
        name = d.get('backup')
        if not isinstance(name, str) or Path(name).name != name or name in allowed:
            raise Blocked('backup-name')
        allowed.add(name)
        p = root / name
        data = _plain_file(p)
        if data is None or len(data) != d.get('size') or _sha(data) != d.get('sha256'):
            raise Blocked('backup-integrity')
        out[key] = Backup(True, data)
    actual = {p.name for p in root.iterdir()}
    if actual != allowed:
        raise Blocked('backup-foreign-entry')
    return out


def _validate_payloads(payload_root: Path, plan: dict[str, Target]) -> tuple[dict[str, bytes], dict[str, dict]]:
    payloads = {}; manifest = {}
    for key in sorted(plan):
        if key == 'installed.json':
            continue
        p = Path(payload_root) / PurePosixPath(key)
        if p.is_symlink() or not p.is_file():
            raise Blocked(f'payload-missing:{key}')
        data = p.read_bytes()
        compile(data.decode('utf-8'), key, 'exec')
        payloads[key] = data
        manifest[key] = {'sha256': _sha(data), 'git_blob': _git_blob_sha(data), 'size': len(data)}
    return payloads, manifest


def _promoted_state_bytes(before: bytes, manifest: dict[str, dict]) -> bytes:
    try:
        obj = json.loads(before.decode('utf-8'))
    except Exception as exc:
        raise Blocked('installed-preimage-invalid') from exc
    if not isinstance(obj, dict):
        raise Blocked('installed-preimage-invalid')
    obj[PROMOTED_MARKER] = {
        'status': 'COMMITTED',
        'schema': V3_SCHEMA,
        'files': manifest,
    }
    return (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _expected_outputs(payloads: dict[str, bytes], backups: dict[str, Backup], manifest: dict[str, dict]) -> dict[str, bytes]:
    installed = backups.get('installed.json')
    if installed is None or not installed.existed or installed.data is None:
        raise Blocked('installed-preimage-missing')
    return dict(payloads) | {'installed.json': _promoted_state_bytes(installed.data, manifest)}


def _create_payload_dir(payload_dir: Path, txid: str) -> None:
    if os.path.lexists(payload_dir):
        raise Blocked('payload-dir-preexists-race')
    payload_dir.mkdir()
    _atomic(payload_dir / OWNER_NAME, _marker_bytes(txid))
    _require_marker(payload_dir, txid)


def _ensure_inner_integrated(inner_upgrade: Callable[[], object], inner_integrated: Callable[[], bool]) -> None:
    # One legacy call may only recover/rollback an interrupted v2 transaction.
    # Bounded second call performs the actual integration if recovery left Core old.
    for _ in range(2):
        result = inner_upgrade()
        if getattr(result, 'status', None) not in {None, 'PASS'} and result != 'PASS':
            raise Blocked('inner-not-pass')
        if inner_integrated():
            return
    raise Blocked('inner-not-integrated-after-bounded-recovery')


def _rollback_overlay(plan: dict[str, Target], backups: dict[str, Backup], payload_dir_state: str, txid: str) -> None:
    payload_dir = next(iter(plan.values())).path.parent / 'payload'
    if payload_dir_state == 'absent':
        _require_marker(payload_dir, txid)
    for key in sorted(plan, reverse=True):
        target = plan[key]
        cur = _plain_file(target.path)
        before = backups[key].data if backups[key].existed else None
        if cur == before:
            continue
        if backups[key].existed:
            assert backups[key].data is not None
            _atomic(target.path, backups[key].data)
        elif cur is not None:
            target.path.unlink()
    if payload_dir_state == 'absent':
        _require_marker(payload_dir, txid)
        marker = payload_dir / OWNER_NAME
        marker.unlink()
        if any(payload_dir.iterdir()):
            raise Blocked('payload-dir-residue')
        payload_dir.rmdir()


def run_overlay(*, home: Path, project_root: Path, payload_root: Path, lifecycle: Lifecycle,
                inner_upgrade: Callable[[], object], inner_integrated: Callable[[], bool], injection: str | None = None) -> dict:
    home = Path(home); project_root = Path(project_root); payload_root = Path(payload_root)
    journal_path = home / V3_JOURNAL_REL
    state_path = home / '.notionagents/ncm10-core-sol/installed.json'
    plan = target_plan(project_root, state_path)
    payloads, manifest = _validate_payloads(payload_root, plan)
    payload_dir = project_root / 'bridge' / 'payload'

    if os.path.lexists(journal_path):
        return recover_overlay(home=home, project_root=project_root, payload_root=payload_root,
                               lifecycle=lifecycle, inner_upgrade=inner_upgrade, inner_integrated=inner_integrated)

    original = lifecycle.status()
    if original not in {'STOPPED', 'RUNNING_OWNED_HEALTHY'}:
        raise Blocked('lifecycle-unsafe')
    txid = str(uuid.uuid4())
    journal = {'schema': V3_SCHEMA, 'transaction_id': txid, 'phase': 'prepared',
               'original_lifecycle': original, 'target_map': {k:t.rel for k,t in plan.items()},
               'payload_manifest': manifest}
    _write_journal(journal_path, journal)
    if injection == 'after_journal': raise RuntimeError('crash')

    if original == 'RUNNING_OWNED_HEALTHY' and not lifecycle.stop():
        raise Blocked('stop-failed')
    journal['phase'] = 'core_mutating'; _write_journal(journal_path, journal)
    _ensure_inner_integrated(inner_upgrade, inner_integrated)
    if lifecycle.status() != 'STOPPED':
        raise Blocked('inner-did-not-return-stopped')
    journal['phase'] = 'core_complete'; _write_journal(journal_path, journal)
    if injection == 'after_core': raise RuntimeError('crash')

    pstate = _payload_dir_state(payload_dir)
    backups = _capture_backups(plan, pstate)
    outputs = _expected_outputs(payloads, backups, manifest)
    desc = _descriptors(backups)
    backup_root = home / V3_BACKUP_REL / txid
    journal.update({'phase':'backup_materializing', 'payload_dir_state':pstate, 'file_backups':desc})
    _write_journal(journal_path, journal)
    _materialize_backups(backup_root, desc, backups)
    journal['phase'] = 'overlay_prepared'; _write_journal(journal_path, journal)
    if injection == 'after_backups': raise RuntimeError('crash')

    if pstate == 'absent':
        _create_payload_dir(payload_dir, txid)
    journal['phase'] = 'overlay_writing'; _write_journal(journal_path, journal)
    for key in sorted(plan):
        target = plan[key]
        if target.rel.startswith('payload/') and pstate == 'absent':
            _require_marker(payload_dir, txid)
        cur = _plain_file(target.path)
        expected_before = backups[key].data if backups[key].existed else None
        if cur != expected_before:
            raise Blocked(f'preimage-drift:{key}')
        _atomic(target.path, _expected_outputs(payloads, backups, manifest)[key])
        if injection == f'after_write:{key}': raise RuntimeError('crash')
    outputs = _expected_outputs(payloads, backups, manifest)
    for key, target in plan.items():
        if target.path.read_bytes() != outputs[key]:
            raise Blocked(f'post-hash:{key}')
    journal['phase'] = 'overlay_complete'; _write_journal(journal_path, journal)

    if original == 'RUNNING_OWNED_HEALTHY' and not lifecycle.start():
        raise Blocked('start-failed')
    if original == 'STOPPED' and lifecycle.status() != 'STOPPED':
        raise Blocked('stopped-not-preserved')
    journal['phase'] = 'verified'; _write_journal(journal_path, journal)
    if injection == 'after_verified': raise RuntimeError('crash')
    if pstate == 'absent':
        _require_marker(payload_dir, txid); (payload_dir / OWNER_NAME).unlink()
    for p in backup_root.iterdir(): p.unlink()
    backup_root.rmdir()
    journal_path.unlink()
    return {'status':'PASS','classification':'PROMOTED_OVERLAY_V3_PASS','manifest':manifest}


def recover_overlay(*, home: Path, project_root: Path, payload_root: Path, lifecycle: Lifecycle,
                    inner_upgrade: Callable[[], object], inner_integrated: Callable[[], bool]) -> dict:
    home = Path(home); project_root = Path(project_root); payload_root = Path(payload_root)
    journal_path = home / V3_JOURNAL_REL
    j = _read_journal(journal_path)
    txid = j['transaction_id']; phase = j['phase']; state_path = home / '.notionagents/ncm10-core-sol/installed.json'; plan = target_plan(project_root, state_path)
    if j.get('target_map') != {k:t.rel for k,t in plan.items()}:
        raise Blocked('target-map-drift')
    payloads, manifest = _validate_payloads(payload_root, plan)
    if j.get('payload_manifest') != manifest:
        raise Blocked('payload-manifest-drift')
    original = j.get('original_lifecycle')
    if original not in {'STOPPED','RUNNING_OWNED_HEALTHY'}:
        raise Blocked('lifecycle-invalid')

    if phase in {'prepared','core_mutating'}:
        if lifecycle.status() == 'RUNNING_OWNED_HEALTHY' and not lifecycle.stop():
            raise Blocked('recovery-stop-failed')
        _ensure_inner_integrated(inner_upgrade, inner_integrated)
        j['phase']='core_complete'; _write_journal(journal_path,j); phase='core_complete'

    if phase == 'core_complete':
        if original == 'RUNNING_OWNED_HEALTHY' and lifecycle.status() == 'STOPPED': lifecycle.start()
        journal_path.unlink()
        return {'status':'RETRY','classification':'PROMOTED_OVERLAY_V3_RETRY_AFTER_CORE_RECOVERY'}

    if phase in {'backup_materializing','overlay_prepared','overlay_writing','overlay_complete'}:
        pstate = j.get('payload_dir_state')
        desc = j.get('file_backups')
        if pstate not in {'absent','preexisting'} or not isinstance(desc,dict):
            raise Blocked('journal-overlay-desc')
        backup_root = home / V3_BACKUP_REL / txid
        backups = _load_backups(backup_root, desc)
        outputs = _expected_outputs(payloads, backups, manifest)
        for key,target in plan.items():
            cur = _plain_file(target.path)
            before = backups[key].data if backups[key].existed else None
            if cur not in {before, outputs[key]}:
                raise Blocked(f'foreign-target:{key}')
        if phase in {'backup_materializing','overlay_prepared'}:
            if pstate == 'absent' and os.path.lexists(project_root/'bridge'/'payload'):
                raise Blocked('payload-dir-appeared-before-write')
        else:
            _rollback_overlay(plan, backups, pstate, txid)
        if original == 'RUNNING_OWNED_HEALTHY' and lifecycle.status() == 'STOPPED': lifecycle.start()
        for p in backup_root.iterdir(): p.unlink()
        backup_root.rmdir(); journal_path.unlink()
        return {'status':'PASS','classification':'PROMOTED_OVERLAY_V3_ROLLED_BACK'}

    if phase == 'verified':
        pstate = j.get('payload_dir_state'); backup_root = home / V3_BACKUP_REL / txid
        desc = j.get('file_backups')
        if not isinstance(desc, dict): raise Blocked('journal-overlay-desc')
        backups = _load_backups(backup_root, desc)
        outputs = _expected_outputs(payloads, backups, manifest)
        for key,target in plan.items():
            if _plain_file(target.path) != outputs[key]: raise Blocked(f'verified-drift:{key}')
        if original == 'RUNNING_OWNED_HEALTHY' and lifecycle.status() != 'RUNNING_OWNED_HEALTHY':
            raise Blocked('verified-lifecycle-drift')
        if original == 'STOPPED' and lifecycle.status() != 'STOPPED':
            raise Blocked('verified-lifecycle-drift')
        if pstate == 'absent' and (project_root/'bridge'/'payload'/OWNER_NAME).exists():
            _require_marker(project_root/'bridge'/'payload',txid); (project_root/'bridge'/'payload'/OWNER_NAME).unlink()
        if backup_root.exists():
            for p in backup_root.iterdir(): p.unlink()
            backup_root.rmdir()
        journal_path.unlink()
        return {'status':'PASS','classification':'PROMOTED_OVERLAY_V3_COMMIT_RECOVERED'}
    raise Blocked('phase')


def self_test() -> None:
    cases = 0
    class L:
        def __init__(self,s='RUNNING_OWNED_HEALTHY'): self.s=s
        def status(self): return self.s
        def stop(self): self.s='STOPPED'; return True
        def start(self): self.s='RUNNING_OWNED_HEALTHY'; return True
    class R: status='PASS'
    class Inner:
        def __init__(self, recover_first=False): self.integrated=False; self.calls=0; self.recover_first=recover_first
        def run(self):
            self.calls += 1
            if self.recover_first and self.calls == 1:
                return R()
            self.integrated=True; return R()
        def is_integrated(self): return self.integrated
    def mk(root: Path):
        home=root/'home'; project=root/'project'; payload=root/'kit';
        (home/'.notionagents/ncm10-core-sol').mkdir(parents=True); (project/'bridge').mkdir(parents=True); payload.mkdir()
        state=home/'.notionagents/ncm10-core-sol/installed.json'; state.write_text('{"project_root": "x"}\n')
        plan=target_plan(project,state)
        for k,t in plan.items():
            if k == 'installed.json':
                continue
            p=payload/PurePosixPath(k); p.parent.mkdir(parents=True,exist_ok=True); p.write_text('x=1\n')
            if not t.rel.startswith('payload/'):
                t.path.write_text('old=1\n')
        return home,project,payload,plan
    with tempfile.TemporaryDirectory() as td:
        root=Path(td); home,project,payload,plan=mk(root); l=L(); inner=Inner()
        out=run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated)
        assert out['status']=='PASS' and l.status()=='RUNNING_OWNED_HEALTHY'; cases+=1
        assert all(t.path.read_text()=='x=1\n' for k,t in plan.items() if k!='installed.json'); cases+=1
        assert json.loads(plan['installed.json'].path.read_text())[PROMOTED_MARKER]['status']=='COMMITTED'; cases+=1
    for point in ['after_journal','after_core','after_backups','after_write:payload/delegation_policy.py','after_verified']:
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); home,project,payload,plan=mk(root); l=L(); inner=Inner()
            try: run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated,injection=point)
            except RuntimeError: pass
            r=recover_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated)
            if r['status']=='RETRY':
                r=run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated)
            assert r['status']=='PASS' and l.status()=='RUNNING_OWNED_HEALTHY'; cases+=1
    with tempfile.TemporaryDirectory() as td:
        root=Path(td); home,project,payload,plan=mk(root); l=L(); inner=Inner()
        try: run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated,injection='after_write:payload/delegation_policy.py')
        except RuntimeError: pass
        target=plan['payload/delegation_policy.py'].path; target.write_text('FOREIGN\n')
        try: recover_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated); raise AssertionError
        except Blocked as e: assert 'foreign-target' in str(e)
        cases+=1
    with tempfile.TemporaryDirectory() as td:
        root=Path(td); home,project,payload,plan=mk(root); l=L(); inner=Inner()
        try: run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated,injection='after_backups')
        except RuntimeError: pass
        (payload/'server.py').write_text('x=2\n')
        try: recover_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated); raise AssertionError
        except Blocked as e: assert 'payload-manifest-drift' in str(e)
        cases+=1
    with tempfile.TemporaryDirectory() as td:
        root=Path(td); home,project,payload,plan=mk(root); pdir=project/'bridge'/'payload'; pdir.mkdir(); (pdir/'foreign.txt').write_text('keep')
        l=L(); inner=Inner()
        try: run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated,injection='after_write:payload/delegation_policy.py')
        except RuntimeError: pass
        r=recover_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated)
        assert r['status']=='PASS' and (pdir/'foreign.txt').read_text()=='keep'; cases+=1
    with tempfile.TemporaryDirectory() as td:
        root=Path(td); home,project,payload,plan=mk(root); l=L(); inner=Inner(recover_first=True)
        out=run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated)
        assert out['status']=='PASS' and inner.calls==2 and inner.integrated; cases+=1
    with tempfile.TemporaryDirectory() as td:
        root=Path(td); home,project,payload,plan=mk(root); l=L('STOPPED'); inner=Inner()
        try: run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated,injection='after_verified')
        except RuntimeError: pass
        r=recover_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated)
        assert r['status']=='PASS' and l.status()=='STOPPED'; cases+=1
    with tempfile.TemporaryDirectory() as td:
        root=Path(td); home,project,payload,plan=mk(root); l=L('STOPPED'); inner=Inner()
        try: run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated,injection='after_verified')
        except RuntimeError: pass
        l.s='RUNNING_OWNED_HEALTHY'
        try: recover_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated); raise AssertionError
        except Blocked as e: assert 'verified-lifecycle-drift' in str(e)
        cases+=1
    with tempfile.TemporaryDirectory() as td:
        root=Path(td); home,project,payload,plan=mk(root); l=L(); inner=Inner()
        try: run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated,injection='after_write:payload/delegation_policy.py')
        except RuntimeError: pass
        pdir=project/'bridge'/'payload'; (pdir/OWNER_NAME).write_bytes(_marker_bytes('foreign-tx'))
        try: recover_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated); raise AssertionError
        except Blocked as e: assert 'owner-marker-drift' in str(e)
        cases+=1
    with tempfile.TemporaryDirectory() as td:
        root=Path(td); home,project,payload,plan=mk(root); l=L(); inner=Inner()
        try: run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated,injection='after_backups')
        except RuntimeError: pass
        j=_read_journal(home/V3_JOURNAL_REL); broot=home/V3_BACKUP_REL/j['transaction_id']; (broot/'FOREIGN').write_text('x')
        try: recover_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated); raise AssertionError
        except Blocked as e: assert 'backup-foreign-entry' in str(e)
        cases+=1
    with tempfile.TemporaryDirectory() as td:
        root=Path(td); home,project,payload,plan=mk(root); l=L(); inner=Inner()
        try: run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated,injection='after_backups')
        except RuntimeError: pass
        jp=home/V3_JOURNAL_REL; j=_read_journal(jp); j['target_map']['server.py']='evil.py'; _write_journal(jp,j)
        try: recover_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated); raise AssertionError
        except Blocked as e: assert 'target-map-drift' in str(e)
        cases+=1
    if hasattr(os, 'symlink'):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); home,project,payload,plan=mk(root); target=root/'foreign'; target.mkdir(); os.symlink(target, project/'bridge'/'payload', target_is_directory=True)
            l=L(); inner=Inner()
            try: run_overlay(home=home,project_root=project,payload_root=payload,lifecycle=l,inner_upgrade=inner.run,inner_integrated=inner.is_integrated); raise AssertionError
            except Blocked as e: assert 'payload-dir-unsafe' in str(e)
            cases+=1
    print(f'PROMOTED_INSTALLER_V3_WRAPPER_CANDIDATE_PASS cases={cases}')

if __name__ == '__main__': self_test()
