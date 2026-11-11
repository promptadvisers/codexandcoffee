'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ProviderVault, helperEnvironment } = require('../lib/config.cjs');
const storage = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from(value.split('').reverse().join('')), decryptString: value => value.toString().split('').reverse().join('') };
test('provider storage persists keys without returning them to the renderer', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-config-test-'));
  try {
    const vault = new ProviderVault(path.join(dir, 'providers.json'), storage);
    assert.deepEqual(await vault.read(), {});
    const result = await vault.save({ gemini: 'fictional-gemini-value', firecrawl: 'fictional-firecrawl-value' });
    assert.deepEqual(result, { gemini: true, firecrawl: true });
    assert.equal((await vault.read()).gemini, 'fictional-gemini-value');
    assert.ok(!(await fs.readFile(vault.file, 'utf8')).includes('fictional-gemini-value'));
    await vault.save({ gemini: '' });
    assert.equal((await vault.read()).gemini, 'fictional-gemini-value');
    await assert.rejects(vault.save({ gemini: '             ' }));
    await assert.rejects(vault.save({ unexpected: 'fictional-key' }));
    await assert.rejects(vault.save({ gemini: 'bad\nfictional-key' }));
    const locked = new ProviderVault(vault.file, { ...storage, isEncryptionAvailable: () => false });
    await assert.rejects(locked.read());
    await assert.rejects(locked.save({ gemini: 'fictional-key' }));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('packaged helper receives only its own provider keys and isolated paths', () => {
  const env = helperEnvironment({ HOME: '/fictional-home', PATH: '/bin', GOOGLE_API_KEY: 'old-key', GEMINI_API_KEY: 'old-key', FIRECRAWL_API_KEY: 'old-key', RELAY_DATA_DIR: '/old-data', RELAY_ENV_FILE: '/old-env', GOOGLE_WORKSPACE_CLI_TOKEN: 'old-token', NODE_OPTIONS: '--inspect' }, { gemini: 'new-key' }, '/new-data', '/app/native', 'win32');
  assert.equal(env.GOOGLE_API_KEY, 'new-key');
  for (const key of ['GEMINI_API_KEY', 'FIRECRAWL_API_KEY', 'GOOGLE_WORKSPACE_CLI_TOKEN', 'NODE_OPTIONS']) assert.equal(env[key], undefined);
  assert.equal(env.RELAY_DATA_DIR, path.join('/new-data', 'voice'));
  assert.equal(env.RELAY_ENV_FILE, path.join('/new-data', 'provider-file-not-used'));
  assert.ok(env.RELAY_BACKEND_EXECUTABLE.endsWith('relay-backend.exe'));
});
