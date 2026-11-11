"""Check the distributed Python executable with no keys, Python install or network calls."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import wave

executable = Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory(prefix='relay-bundled-check-') as directory:
    home = Path(directory)
    env = {key: value for key, value in os.environ.items() if key in {'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'COMSPEC', 'PATHEXT'}}
    env.update(HOME=directory, USERPROFILE=directory, APPDATA=directory, LOCALAPPDATA=directory, PATH='', RELAY_ENV_FILE=str(home / 'empty.env'))
    audio = home / 'synthetic.wav'
    with wave.open(str(audio), 'wb') as sound:
        sound.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
        sound.writeframes(b'\0\0' * 8000)
    cases = [({'action': 'unknown'}, 'Unsupported action'), ({'action': 'ask', 'text': 'Fictional test'}, 'Gemini is not configured'), ({'action': 'transcribe', 'audio_path': str(audio), 'smart': True}, 'Gemini is not configured')]
    for request, expected in cases:
        run = subprocess.run([str(executable)], input=json.dumps(request), capture_output=True, text=True, encoding='utf-8', env=env, timeout=15, check=True)
        result = json.loads(run.stdout)
        assert not result['ok'] and expected in result['error'], result
    print(json.dumps({'bundled_backend_checks': len(cases), 'external_calls': 0, 'host_python_required': False}))
