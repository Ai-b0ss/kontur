from __future__ import annotations
import json, os, tempfile
from pathlib import Path

class CurrentStoreModel:
    """Exact missing-file semantics of current SubagentTombstoneStore._load_or_initialize."""
    def __init__(self,path: Path):
        self.path=path; self.uncertain=set(); self.inflight=set(); self.state_uncertain=False; self._load_or_initialize()
    def _payload(self):
        return {'version':2,'uncertain_task_ids':sorted(self.uncertain),'inflight_calls':[{'task_id':t,'call_id':c} for t,c in sorted(self.inflight)]}
    def _persist(self):
        self.path.parent.mkdir(parents=True,exist_ok=True)
        tmp=self.path.with_name(self.path.name+'.tmp')
        tmp.write_text(json.dumps(self._payload(),sort_keys=True,separators=(',',':'))+'\n')
        os.replace(tmp,self.path)
    def _load_or_initialize(self):
        try:
            p=json.loads(self.path.read_text())
            self.uncertain=set(p['uncertain_task_ids']); self.inflight={(x['task_id'],x['call_id']) for x in p['inflight_calls']}
        except FileNotFoundError:
            self._persist()
        except Exception:
            self.state_uncertain=True
    def begin_call(self,task,call):
        self.inflight.add((task,call)); self._persist()
    def contains(self,task): return task in self.uncertain or any(t==task for t,_ in self.inflight)

class StrictRestartCandidate(CurrentStoreModel):
    def __init__(self,path: Path, *, first_install: bool):
        self.first_install=first_install
        super().__init__(path)
    def _load_or_initialize(self):
        try:
            p=json.loads(self.path.read_text())
            self.uncertain=set(p['uncertain_task_ids']); self.inflight={(x['task_id'],x['call_id']) for x in p['inflight_calls']}
        except FileNotFoundError:
            if self.first_install:
                self._persist()
            else:
                self.state_uncertain=True
        except Exception:
            self.state_uncertain=True

def current_case():
    with tempfile.TemporaryDirectory() as td:
        path=Path(td)/'subagent-uncertain-tasks.json'
        first=CurrentStoreModel(path); first.begin_call('child-A','call-A'); assert first.contains('child-A')
        path.unlink()  # simulates accidental rollback/cleanup/deletion between process generations
        restarted=CurrentStoreModel(path)
        assert restarted.state_uncertain is False and restarted.contains('child-A') is False
        return {'after_missing_restart_state_uncertain':False,'child_A_blocked':False,'silent_empty_reinitialized':True}

def candidate_case():
    with tempfile.TemporaryDirectory() as td:
        path=Path(td)/'subagent-uncertain-tasks.json'
        install=StrictRestartCandidate(path,first_install=True); install.begin_call('child-A','call-A'); path.unlink()
        restarted=StrictRestartCandidate(path,first_install=False)
        assert restarted.state_uncertain is True
        return {'after_missing_restart_state_uncertain':True,'child_A_blocked':True,'runtime_did_not_reinitialize':True}

if __name__=='__main__':
    out={'verdict':'NOTION_TOMBSTONE_MISSING_RESTART_FAIL_OPEN_REPRODUCED_AND_STRICT_INSTALL_CONTRACT_PASS','current':current_case(),'candidate':candidate_case(),'integration_requirement':'establish the initial empty tombstone generation in the durable install/upgrade transaction; runtime restart must treat later absence as uncertain instead of first-use initialization'}
    print(json.dumps(out,sort_keys=True))
