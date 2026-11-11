'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

class ProviderVault {
  constructor(file, storage) { this.file = file; this.storage = storage; }
  async read() {
    let data;
    try { data = JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('Saved provider settings could not be read.'); }
    if (!this.storage.isEncryptionAvailable()) throw new Error('Your operating system could not unlock saved provider keys.');
    try { return JSON.parse(this.storage.decryptString(Buffer.from(data.encrypted, 'base64'))); }
    catch { throw new Error('Your operating system could not unlock saved provider keys.'); }
  }
  async save(input) {
    if (!this.storage.isEncryptionAvailable()) throw new Error('Secure key storage is unavailable. Check your operating-system login.');
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['gemini', 'firecrawl'].includes(k))) throw new Error('Invalid provider settings.');
    const keys = await this.read();
    for (const name of ['gemini', 'firecrawl']) {
      const value = input[name];
      if (value === undefined || value === '') continue;
      if (typeof value !== 'string' || value.trim().length < 10 || value.length > 512 || /[\r\n\0]/.test(value)) throw new Error('Enter a valid provider key.');
      keys[name] = value.trim();
    }
    const encrypted = this.storage.encryptString(JSON.stringify(keys)).toString('base64');
    await fs.mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    await fs.writeFile(this.file + '.tmp', JSON.stringify({ version: 1, encrypted }), { mode: 0o600 });
    await fs.rename(this.file + '.tmp', this.file);
    return { gemini: !!keys.gemini, firecrawl: !!keys.firecrawl };
  }
}

function helperEnvironment(base, keys, dataDir, nativeDir, platform) {
  const allowed = ['PATH', 'HOME', 'USER', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TMP', 'TEMP', 'TMPDIR', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'ComSpec', 'PATHEXT', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ'];
  const env = Object.fromEntries(allowed.filter(name => base[name] !== undefined).map(name => [name, base[name]]));
  env.RELAY_DATA_DIR = path.join(dataDir, 'voice');
  // A deliberately isolated path disables the legacy ~/.env fallback.
  env.RELAY_ENV_FILE = path.join(dataDir, 'provider-file-not-used');
  env.RELAY_BACKEND_PATH = path.join(nativeDir, 'backend.py');
  env.RELAY_BACKEND_EXECUTABLE = path.join(nativeDir, 'backend', platform === 'win32' ? 'relay-backend.exe' : 'relay-backend');
  if (keys.gemini) env.GOOGLE_API_KEY = keys.gemini;
  if (keys.firecrawl) env.FIRECRAWL_API_KEY = keys.firecrawl;
  return env;
}
module.exports = { ProviderVault, helperEnvironment };
