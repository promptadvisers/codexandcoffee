"""Synthetic provider used only by protocol tests."""
import json
import sys
import time
request = json.load(sys.stdin)
if request['action'] == 'status':
    print(json.dumps({'ok': True, 'status': {'fixture': True}}))
elif request['action'] == 'ask':
    if request['text'] == 'slow':
        time.sleep(20)
    event = {'type': 'tool', 'id': 'fixture', 'tool': 'web_search', 'provider': 'Fixture', 'label': 'Fixture only', 'status': 'completed'}
    print(json.dumps(event), file=sys.stderr, flush=True)
    print(json.dumps({'ok': True, 'text': 'fixture: ' + request['text'], 'sources': [], 'tool_events': [event]}))
else:
    print(json.dumps({'ok': False, 'error': 'Forbidden fixture action'}))
