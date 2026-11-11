"""Exercise the real Windows helper with a synthetic provider and no hotkeys."""
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
import time

helper, backend = map(Path, sys.argv[1:3])
checks = 0
with tempfile.TemporaryDirectory(prefix='relay-protocol-') as temp:
    env = {**os.environ, 'RELAY_DATA_DIR': temp, 'RELAY_BACKEND_EXECUTABLE': str(backend.resolve()), 'RELAY_NO_SHORTCUTS': '1'}
    child = subprocess.Popen([str(helper.resolve())], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', env=env)
    events = queue.Queue()
    def read():
        for line in child.stdout:
            events.put(json.loads(line))
    threading.Thread(target=read, daemon=True).start()
    def wait(predicate, timeout=15):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            value = events.get(timeout=max(.01, deadline-time.monotonic()))
            if predicate(value): return value
        raise AssertionError('Protocol timed out')
    def send(command, id, **fields):
        child.stdin.write(json.dumps({'id': id, 'command': command, **fields}) + '\n')
        child.stdin.flush()
    def response(id): return wait(lambda event: event.get('event') == 'response' and event.get('id') == id)
    def check(condition):
        global checks
        assert condition, f'Check {checks+1} failed'
        checks += 1
    try:
        ready = wait(lambda event: event.get('event') == 'ready')
        check(ready['protocol'] == 'relay-helper/1')
        check(not ready['permissions']['shortcut'])
        check(not ready['draft_writes'])
        check(ready['permissions']['backend'])
        send('ping', 'ping'); check(response('ping')['state'] == 'idle')
        send('history_get', 'empty'); check(response('empty')['entries'] == [])
        send('settings_set', 'settings', settings={'account': 'work', 'model': '', 'voice_mode': 'auto'}); check(response('settings')['ok'])
        send('settings_get', 'get'); check(response('get')['settings']['account'] == 'work')
        send('settings_set', 'invalid', settings={'account': 'unknown', 'model': ''}); check(not response('invalid')['ok'])
        for command in ['send', 'draft', 'record_start']:
            send(command, command); check(not response(command)['ok'])
        send('status', 'status'); check(response('status')['result']['status']['fixture'])
        wait(lambda event: event.get('event') == 'state' and event.get('state') == 'idle')
        send('ask', 'ask', text='Relay café 🟢')
        check(response('ask')['accepted'])
        result = wait(lambda event: event.get('event') == 'result')
        check(result['result']['text'] == 'fixture: Relay café 🟢')
        check(result['insertion'] == 'answered')
        entry = wait(lambda event: event.get('event') == 'history_entry')['entry']
        check(entry['request'] == 'Relay café 🟢')
        wait(lambda event: event.get('event') == 'state' and event.get('state') == 'idle')
        send('history_get', 'history'); check(len(response('history')['entries']) == 1)
        send('ask', 'slow', text='slow'); check(response('slow')['accepted'])
        send('ask', 'busy', text='second'); check(not response('busy')['ok'])
        send('cancel', 'cancel'); check(response('cancel')['ok'])
        time.sleep(1)
        send('ping', 'after-cancel'); check(response('after-cancel')['state'] == 'idle')
        send('ask', 'fresh', text='fresh request'); check(response('fresh')['accepted'])
        check(wait(lambda event: event.get('event') == 'result')['result']['text'] == 'fixture: fresh request')
        wait(lambda event: event.get('event') == 'state' and event.get('state') == 'idle')
        send('history_clear', 'clear'); check(response('clear')['ok'])
        send('history_get', 'cleared'); check(response('cleared')['entries'] == [])
        check(not list(Path(temp).rglob('*.wav')))
        send('shutdown', 'shutdown'); check(response('shutdown')['ok'])
        child.wait(timeout=10); check(child.returncode == 0)
        print(json.dumps({'passed': checks, 'physical_microphone_tested': False, 'physical_insertion_tested': False}))
    finally:
        if child.poll() is None: child.kill()
