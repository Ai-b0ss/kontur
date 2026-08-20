#!/usr/bin/env python3
import json

MUTATING = {'bash','write_file','edit_file','append_file'}

class CurrentLikeAgent:
    def __init__(self):
        self.side_effects=[]
        self.events=[]
    def execute(self, name, attempt):
        self.events.append({'type':'tool','name':name})
        self.side_effects.append(f'{name}:effect:{attempt}')
        output='Error: command failed after process start'
        self.events.append({'type':'tool_result','name':name,'output':output,'isError':True})
        return output
    def run(self):
        self.execute('bash', 1)
        self.execute('bash', 2)
        return {'side_effects':len(self.side_effects),'duplicate':len(self.side_effects)==2}

class CandidateContractAgent:
    def __init__(self): self.side_effects=[]
    def execute(self, name, attempt, failure_stage):
        self.side_effects.append(f'{name}:effect:{attempt}')
        if name in MUTATING and failure_stage=='after_start':
            return {'status':'uncertain','retryable':False,'output':'tool outcome ambiguous after possible side effect'}
        return {'status':'error','retryable':True,'output':'deterministic precondition failure'}
    def run(self):
        first=self.execute('bash',1,'after_start')
        retried=False
        if first['retryable']:
            self.execute('bash',2,'after_start'); retried=True
        return {'side_effects':len(self.side_effects),'automatic_retry':retried,'uncertain':first['status']=='uncertain'}

current=CurrentLikeAgent().run()
safe=CandidateContractAgent().run()
assert current=={'side_effects':2,'duplicate':True}
assert safe=={'side_effects':1,'automatic_retry':False,'uncertain':True}
print(json.dumps({'verdict':'QWEN_ERROR_RESULT_DUPLICATE_REPRODUCED_AND_CONTRACT_PASS','current':current,'candidate_contract':safe},sort_keys=True))
