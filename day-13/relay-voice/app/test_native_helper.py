#!/usr/bin/env python3
"""Headless protocol checks only. No keyboard injection, microphone, AX writes or real providers."""
import json
import os
from pathlib import Path
import queue
import subprocess
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parent


def main():
    with tempfile.TemporaryDirectory(prefix='relay-helper-test-') as directory:
        root = Path(directory)
        backend = root / 'fixture.py'
        backend.write_text('''import json, sys, time
r = json.load(sys.stdin)
if r['action'] == 'ask':
    if r['text'] == 'slow': time.sleep(5)
    e = {'type':'tool','id':'fixture','tool':'web_search','provider':'Fixture','label':'Fixture only','status':'completed'}
    print(json.dumps(e), file=sys.stderr, flush=True)
    print(json.dumps({'ok': True, 'text': 'fixture: ' + r['text'], 'sources': [], 'draft': None, 'tool_events': [e]}))
elif r['action'] == 'status':
    print(json.dumps({'ok': True, 'status': {'fixture': True}}))
else:
    raise RuntimeError('Test attempted forbidden backend action')
''')
        env = {**os.environ, 'RELAY_BACKEND_PATH': str(backend), 'RELAY_DATA_DIR': str(root / 'data')}
        process = subprocess.Popen([str(ROOT / 'dist/helper/relay-voice-helper'), '--no-shortcuts'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
        events = queue.Queue()
        seen = []
        def reader():
            for line in process.stdout:
                try: events.put(json.loads(line))
                except Exception as exc: events.put({'parse_error': str(exc)})
        threading.Thread(target=reader, daemon=True).start()
        def wait(predicate, timeout=10):
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                value = events.get(timeout=max(.01, deadline-time.monotonic()))
                seen.append(value)
                assert 'parse_error' not in value, value
                if predicate(value): return value
            raise AssertionError('Timed out waiting for event')
        def event(name): return wait(lambda e: e.get('event') == name)
        def send(command, id, **fields):
            process.stdin.write(json.dumps({'id': id, 'command': command, **fields}) + '\n'); process.stdin.flush()
        def response(id): return wait(lambda e: e.get('event') == 'response' and e.get('id') == id)
        try:
            ready = event('ready')
            assert ready['protocol'] == 'relay-helper/1'
            assert ready['permissions']['shortcut'] is False
            assert ready['draft_writes'] is False
            send('settings_set', 'settings', settings={'account':'primary', 'model':'', 'voice_mode':'dictate'})
            assert response('settings')['ok']
            assert oct((root / 'data/settings.json').stat().st_mode & 0o777) == '0o600'
            send('settings_set', 'invalid', settings={'account':'other', 'model':'', 'voice_mode':'dictate'})
            assert not response('invalid')['ok']
            send('draft', 'draft')
            assert not response('draft')['ok']
            send('send', 'send')
            assert not response('send')['ok']
            send('record_start', 'record')
            assert not response('record')['ok'], 'IPC must never arm insertion'
            send('ask', 'ask', text='Relay is literal text')
            assert response('ask')['accepted']
            result = event('result')
            assert result['result']['text'] == 'fixture: Relay is literal text'
            assert result['insertion'] == 'not_requested'
            entry = event('history_entry')['entry']
            assert entry['tools'][0]['provider'] == 'Fixture'
            event('state')
            send('ask', 'slow', text='slow')
            assert response('slow')['accepted']
            send('ask', 'busy', text='must not run')
            assert not response('busy')['ok']
            send('cancel', 'cancel')
            assert event('cancelled')['request_id'] == 'slow'
            assert response('cancel')['ok']
            send('status', 'status')
            assert response('status')['result']['status']['fixture']
            send('history_get', 'history')
            entries = response('history')['entries']
            assert len(entries) == 2 and entries[0]['outcome'] == 'cancelled'
            send('history_clear', 'clear')
            assert response('clear')['ok']
            send('history_get', 'empty')
            assert response('empty')['entries'] == []
            process.stdin.write('not-json\n'); process.stdin.flush()
            assert event('error')['code'] == 'invalid_command'
            process.stdin.write('x' * (1024 * 1024 + 1) + '\n'); process.stdin.flush()
            assert event('error')['code'] == 'command_too_large'
            send('ping', 'ping')
            assert response('ping')['state'] == 'idle'
            send('shutdown', 'shutdown')
            assert response('shutdown')['ok']
            process.wait(timeout=5)
            assert process.returncode == 0
            assert not any(e.get('event') == 'result' and e.get('request_id') == 'slow' for e in seen)
            print('Helper protocol passed: NDJSON, settings, fixture Ask/progress/history, busy, cancel, status, write/record rejection, malformed command, shutdown. No live providers or insertion.')
        finally:
            if process.poll() is None: process.kill(); process.wait()
        for ending in ('eof', 'sigterm'):
            child = subprocess.Popen([str(ROOT / 'dist/helper/relay-voice-helper'), '--no-shortcuts'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
            try:
                assert json.loads(child.stdout.readline())['event'] == 'ready'
                if ending == 'eof': child.stdin.close()
                else: child.terminate()
                child.wait(timeout=5)
                assert child.returncode == 0, (ending, child.returncode)
            finally:
                if child.poll() is None: child.kill(); child.wait()
        print('Helper lifecycle passed: EOF and SIGTERM terminate cleanly.')


if __name__ == '__main__': main()
