#!/usr/bin/env python3
import argparse, hashlib, json, os, shutil, stat, tarfile
from pathlib import Path


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def sha256_file(p: Path) -> str:
    h=hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024), b''): h.update(chunk)
    return h.hexdigest()

def scan_workspace(root: Path):
    out={}
    for p in sorted(root.rglob('*')):
        rel=p.relative_to(root).as_posix()
        if p.is_symlink():
            out[rel]={'type':'symlink','target':os.readlink(p)}
        elif p.is_file():
            st=p.stat()
            out[rel]={'type':'file','size':st.st_size,'mode':oct(stat.S_IMODE(st.st_mode)),'sha256':sha256_file(p)}
        elif p.is_dir():
            st=p.stat()
            out[rel]={'type':'dir','mode':oct(stat.S_IMODE(st.st_mode))}
    return out

def pack(src: Path, outdir: Path, chunk_size: int):
    src=src.resolve(); outdir.mkdir(parents=True,exist_ok=True)
    archive=outdir/'workspace.tar.gz'
    with tarfile.open(archive,'w:gz',format=tarfile.PAX_FORMAT) as tf:
        tf.add(src, arcname='workspace', recursive=True)
    data=archive.read_bytes(); chunks=[]
    cdir=outdir/'chunks'; shutil.rmtree(cdir,ignore_errors=True); cdir.mkdir()
    for idx, start in enumerate(range(0,len(data),chunk_size)):
        part=data[start:start+chunk_size]
        name=f'part-{idx:04d}.bin'; (cdir/name).write_bytes(part)
        chunks.append({'index':idx,'name':name,'size':len(part),'sha256':sha256_bytes(part)})
    manifest={
        'schema':'free_fabric_capsule_v3',
        'archive':{'format':'tar.gz','size':len(data),'sha256':sha256_bytes(data),'chunk_size':chunk_size,'chunk_count':len(chunks)},
        'chunks':chunks,
        'workspace':scan_workspace(src),
    }
    (outdir/'manifest.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
    print(json.dumps(manifest,indent=2,sort_keys=True))

def safe_extract(tf: tarfile.TarFile, dest: Path):
    base=dest.resolve()
    for m in tf.getmembers():
        target=(dest/m.name).resolve()
        if os.path.commonpath([str(base),str(target)]) != str(base):
            raise RuntimeError(f'unsafe archive path: {m.name}')
    tf.extractall(dest)

def restore(manifest_path: Path, chunks_dir: Path, dest: Path):
    m=json.loads(manifest_path.read_text())
    if m.get('schema')!='free_fabric_capsule_v3': raise RuntimeError('bad schema')
    data=bytearray()
    for exp in m['chunks']:
        p=chunks_dir/exp['name']; b=p.read_bytes()
        if len(b)!=exp['size']: raise RuntimeError(f"size mismatch {exp['name']}")
        if sha256_bytes(b)!=exp['sha256']: raise RuntimeError(f"sha mismatch {exp['name']}")
        data.extend(b)
    if len(data)!=m['archive']['size']: raise RuntimeError('archive size mismatch')
    if sha256_bytes(bytes(data))!=m['archive']['sha256']: raise RuntimeError('archive sha mismatch')
    tmp=dest.parent/'_capsule_restore.tar.gz'; tmp.write_bytes(data)
    shutil.rmtree(dest,ignore_errors=True); dest.mkdir(parents=True)
    with tarfile.open(tmp,'r:gz') as tf: safe_extract(tf,dest)
    root=dest/'workspace'
    actual=scan_workspace(root)
    if actual!=m['workspace']:
        keys=sorted(set(actual)|set(m['workspace']))
        for k in keys:
            if actual.get(k)!=m['workspace'].get(k):
                raise RuntimeError(f'workspace mismatch {k}: expected={m["workspace"].get(k)} actual={actual.get(k)}')
        raise RuntimeError('workspace mismatch')
    print(json.dumps({'verdict':'PASS','archive_sha256':m['archive']['sha256'],'chunk_count':len(m['chunks']),'workspace_entries':len(actual)},indent=2))

if __name__=='__main__':
    ap=argparse.ArgumentParser(); sp=ap.add_subparsers(dest='cmd',required=True)
    p=sp.add_parser('pack'); p.add_argument('src'); p.add_argument('outdir'); p.add_argument('--chunk-size',type=int,default=32768)
    r=sp.add_parser('restore'); r.add_argument('manifest'); r.add_argument('chunks'); r.add_argument('dest')
    a=ap.parse_args()
    if a.cmd=='pack': pack(Path(a.src),Path(a.outdir),a.chunk_size)
    else: restore(Path(a.manifest),Path(a.chunks),Path(a.dest))
