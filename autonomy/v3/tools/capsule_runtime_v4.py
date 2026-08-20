#!/usr/bin/env python3
import argparse, base64, hashlib, json, os, shutil, stat, tarfile, tempfile, time, uuid
from pathlib import Path

SCHEMA='free_fabric_worker_capsule_v4'


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def sha256_file(p: Path) -> str:
    h=hashlib.sha256()
    with p.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024), b''): h.update(c)
    return h.hexdigest()

def atomic_write_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp=path.with_name(path.name+f'.tmp-{os.getpid()}-{uuid.uuid4().hex[:8]}')
    tmp.write_text(text)
    os.replace(tmp, path)

def scan_workspace(root: Path):
    out={}
    for p in sorted(root.rglob('*')):
        rel=p.relative_to(root).as_posix()
        if p.is_symlink(): out[rel]={'type':'symlink','target':os.readlink(p)}
        elif p.is_file():
            st=p.stat(); out[rel]={'type':'file','size':st.st_size,'mode':oct(stat.S_IMODE(st.st_mode)),'sha256':sha256_file(p)}
        elif p.is_dir():
            st=p.stat(); out[rel]={'type':'dir','mode':oct(stat.S_IMODE(st.st_mode))}
    return out

def safe_extract(tf: tarfile.TarFile, dest: Path):
    base=dest.resolve()
    members=tf.getmembers()
    symlink_paths=set()
    for m in members:
        if m.ischr() or m.isblk() or m.isfifo() or m.isdev() or m.islnk():
            raise RuntimeError(f'unsupported archive member: {m.name}')
        target=(base/m.name).resolve()
        if os.path.commonpath([str(base),str(target)]) != str(base):
            raise RuntimeError(f'unsafe archive path: {m.name}')
        rel=Path(m.name)
        for parent in rel.parents:
            if parent.as_posix() in symlink_paths:
                raise RuntimeError(f'archive path descends through symlink: {m.name}')
        if m.issym():
            link_target=((base/m.name).parent/m.linkname).resolve()
            if os.path.commonpath([str(base),str(link_target)]) != str(base):
                raise RuntimeError(f'unsafe symlink target: {m.name} -> {m.linkname}')
            symlink_paths.add(rel.as_posix())
    tf.extractall(dest, filter='fully_trusted')

def pack(workspace: Path, outdir: Path, worker: str, source_ref: str='', chunk_chars: int=2048):
    workspace=workspace.resolve(); outdir.mkdir(parents=True, exist_ok=True)
    capsule_id=time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())+'-'+uuid.uuid4().hex[:10]
    croot=outdir/capsule_id; croot.mkdir(parents=True)
    archive=croot/'workspace.tar.gz'
    with tarfile.open(archive,'w:gz',format=tarfile.PAX_FORMAT) as tf:
        tf.add(workspace, arcname='workspace', recursive=True)
    raw=archive.read_bytes(); b64=base64.b64encode(raw).decode('ascii')
    parts=[]; pdir=croot/'parts'; pdir.mkdir()
    for idx,start in enumerate(range(0,len(b64),chunk_chars)):
        text=b64[start:start+chunk_chars]
        name=f'part-{idx:04d}.b64'; (pdir/name).write_text(text)
        parts.append({'index':idx,'name':name,'chars':len(text),'sha256_text':sha256_bytes(text.encode())})
    manifest={
      'schema':SCHEMA,'worker':worker,'capsule_id':capsule_id,'created_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
      'source_ref':source_ref,'archive':{'size':len(raw),'sha256':sha256_bytes(raw),'parts':len(parts)},
      'parts':parts,'workspace':scan_workspace(workspace)
    }
    atomic_write_text(croot/'manifest.json',json.dumps(manifest,indent=2,sort_keys=True)+'\n')
    latest={'schema':'free_fabric_latest_v1','worker':worker,'capsule_id':capsule_id,'manifest':f'{capsule_id}/manifest.json','archive_sha256':manifest['archive']['sha256'],'updated_at_utc':manifest['created_at_utc']}
    atomic_write_text(outdir/'LATEST.json.pending',json.dumps(latest,indent=2,sort_keys=True)+'\n')
    print(json.dumps({'capsule_id':capsule_id,'manifest':str(croot/'manifest.json'),'latest_pending':str(outdir/'LATEST.json.pending'),'parts':len(parts),'archive_sha256':manifest['archive']['sha256']},indent=2))

def verify_capsule(croot: Path):
    m=json.loads((croot/'manifest.json').read_text())
    if m.get('schema')!=SCHEMA: raise RuntimeError('bad schema')
    b64_parts=[]
    for exp in m['parts']:
        text=(croot/'parts'/exp['name']).read_text()
        if len(text)!=exp['chars']: raise RuntimeError(f"part length mismatch {exp['name']}")
        if sha256_bytes(text.encode())!=exp['sha256_text']: raise RuntimeError(f"part sha mismatch {exp['name']}")
        b64_parts.append(text)
    raw=base64.b64decode(''.join(b64_parts), validate=True)
    if len(raw)!=m['archive']['size']: raise RuntimeError('archive size mismatch')
    if sha256_bytes(raw)!=m['archive']['sha256']: raise RuntimeError('archive sha mismatch')
    return m, raw

def restore(croot: Path, dest: Path):
    m, raw=verify_capsule(croot)
    tmp=Path(tempfile.mkdtemp(prefix='capsule-restore-', dir=str(dest.parent)))
    try:
        archive=tmp/'workspace.tar.gz'; archive.write_bytes(raw)
        with tarfile.open(archive,'r:gz') as tf: safe_extract(tf,tmp)
        restored=tmp/'workspace'
        actual=scan_workspace(restored)
        if actual!=m['workspace']:
            for k in sorted(set(actual)|set(m['workspace'])):
                if actual.get(k)!=m['workspace'].get(k): raise RuntimeError(f'workspace mismatch {k}')
            raise RuntimeError('workspace mismatch')
        backup=None
        if dest.exists():
            backup=dest.with_name(dest.name+'.previous')
            shutil.rmtree(backup,ignore_errors=True); os.replace(dest,backup)
        os.replace(restored,dest)
        if backup: shutil.rmtree(backup,ignore_errors=True)
    finally:
        shutil.rmtree(tmp,ignore_errors=True)
    print(json.dumps({'verdict':'PASS','capsule_id':m['capsule_id'],'dest':str(dest),'archive_sha256':m['archive']['sha256']},indent=2))

def commit_latest(root: Path):
    pending=root/'LATEST.json.pending'
    if not pending.exists(): raise RuntimeError('no pending latest')
    latest=json.loads(pending.read_text())
    croot=root/latest['capsule_id']
    m,_=verify_capsule(croot)
    if m['archive']['sha256']!=latest['archive_sha256']: raise RuntimeError('pending latest sha mismatch')
    prev=root/'LATEST.json'
    if prev.exists(): atomic_write_text(root/'PREVIOUS.json', prev.read_text())
    os.replace(pending, prev)
    print(json.dumps({'verdict':'PASS','latest':latest['capsule_id']},indent=2))

def resolve(root: Path):
    for ptrname in ('LATEST.json','PREVIOUS.json'):
        ptr=root/ptrname
        if not ptr.exists(): continue
        try:
            info=json.loads(ptr.read_text()); croot=root/info['capsule_id']; m,_=verify_capsule(croot)
            if m['archive']['sha256']!=info['archive_sha256']: raise RuntimeError('pointer sha mismatch')
            print(json.dumps({'verdict':'PASS','pointer':ptrname,'capsule_id':info['capsule_id'],'manifest':str(croot/'manifest.json')},indent=2)); return
        except Exception as e:
            err=f'{type(e).__name__}: {e}'
    raise RuntimeError('no valid latest or previous capsule')

if __name__=='__main__':
    ap=argparse.ArgumentParser(); sp=ap.add_subparsers(dest='cmd',required=True)
    p=sp.add_parser('pack'); p.add_argument('workspace'); p.add_argument('root'); p.add_argument('--worker',required=True); p.add_argument('--source-ref',default=''); p.add_argument('--chunk-chars',type=int,default=2048)
    v=sp.add_parser('verify'); v.add_argument('capsule_root')
    r=sp.add_parser('restore'); r.add_argument('capsule_root'); r.add_argument('dest')
    c=sp.add_parser('commit-latest'); c.add_argument('root')
    rs=sp.add_parser('resolve'); rs.add_argument('root')
    a=ap.parse_args()
    if a.cmd=='pack': pack(Path(a.workspace),Path(a.root),a.worker,a.source_ref,a.chunk_chars)
    elif a.cmd=='verify':
        m,_=verify_capsule(Path(a.capsule_root)); print(json.dumps({'verdict':'PASS','capsule_id':m['capsule_id']},indent=2))
    elif a.cmd=='restore': restore(Path(a.capsule_root),Path(a.dest))
    elif a.cmd=='commit-latest': commit_latest(Path(a.root))
    else: resolve(Path(a.root))
