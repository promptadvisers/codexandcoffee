'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const appRoot = path.resolve(__dirname, '../..');
async function main() {
  const mac = process.platform === 'darwin';
  const bundle = path.join(appRoot, mac ? 'dist/electron/Relay Voice.app' : 'dist/electron/Relay-Voice-Windows-x64');
  const resources = path.join(bundle, mac ? 'Contents/Resources' : 'resources');
  const executable = mac ? bundle : path.join(bundle, 'Relay Voice.exe');
  if (mac) {
    const plist = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(bundle, 'Contents/Info.plist')], { encoding: 'utf8' }));
    assert.equal(plist.CFBundleIdentifier, 'com.relayvoice.community');
    assert.ok(plist.NSMicrophoneUsageDescription.includes('Option'));
    assert.ok(plist.ElectronAsarIntegrity);
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle]);
  }
  const helper = path.join(resources, 'native', mac ? 'relay-voice-helper' : 'relay-voice-helper.exe');
  const backend = path.join(resources, 'native/backend', mac ? 'relay-backend' : 'relay-backend.exe');
  fs.accessSync(helper); fs.accessSync(backend);
  const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(hash(path.join(resources, 'native/backend.py')), hash(path.join(appRoot, 'backend.py')));
  const { listPackage, extractFile } = await import('@electron/asar');
  const asarPath = path.join(resources, 'app.asar');
  const files = listPackage(asarPath).map(file => file.replaceAll('\\', '/'));
  for (const required of ['/main.cjs', '/preload.cjs', '/lib/config.cjs', '/lib/bridge.cjs', '/ui/index.html', '/ui/overlay.html', '/ui/vendor/marked.js']) assert.ok(files.includes(required), required);
  assert.equal(createHash('sha256').update(extractFile(asarPath, 'ui/vendor/marked.js')).digest('hex'), hash(path.join(appRoot, 'electron/node_modules/marked/lib/marked.esm.js')));
  for (const asset of JSON.parse(extractFile(asarPath, 'ui/services/PROVENANCE.json').toString())) {
    assert.equal(createHash('sha256').update(extractFile(asarPath, `ui/services/${asset.file}`)).digest('hex'), asset.sha256);
  }
  assert.ok(!files.some(file => /node_modules|tests|fixture|\.env|backend\.py|providers\.json|history\.json/.test(file)));
  const pkg = JSON.parse(extractFile(asarPath, 'package.json').toString());
  assert.ok(!pkg.devDependencies && !pkg.scripts);
  const { getCurrentFuseWire, FuseV1Options, FuseState } = await import('@electron/fuses');
  const fuses = await getCurrentFuseWire(executable);
  for (const option of ['RunAsNode', 'EnableNodeOptionsEnvironmentVariable', 'EnableNodeCliInspectArguments', 'GrantFileProtocolExtraPrivileges']) assert.equal(fuses[FuseV1Options[option]], FuseState.DISABLE, option);
  for (const option of ['EnableEmbeddedAsarIntegrityValidation', 'OnlyLoadAppFromAsar']) assert.equal(fuses[FuseV1Options[option]], FuseState.ENABLE, option);
  console.log(JSON.stringify({ version: pkg.version, platform: process.platform, architecture: process.arch, asarFiles: files.length, bundledBackend: true, bundledHelper: true, signature: mac ? 'ad-hoc verified' : 'unsigned' }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
