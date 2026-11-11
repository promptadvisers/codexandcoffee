'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const appRoot = path.resolve(root, '..');

async function main() {
  const mac = process.platform === 'darwin';
  if (!mac && process.platform !== 'win32') throw new Error('Build on macOS or Windows for that platform.');
  if (mac) execFileSync(path.join(appRoot, 'build-helper.sh'), [], { stdio: 'inherit' });
  const backend = path.join(appRoot, 'dist/backend/relay-backend');
  await fs.access(path.join(backend, mac ? 'relay-backend' : 'relay-backend.exe'));
  const helper = path.join(appRoot, mac ? 'dist/helper' : 'dist/windows-helper');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-package-'));
  try {
    const source = path.join(temp, 'source'), native = path.join(temp, 'native');
    await fs.mkdir(source); await fs.mkdir(native);
    for (const name of ['main.cjs', 'preload.cjs', 'lib', 'ui']) await fs.cp(path.join(root, name), path.join(source, name), { recursive: true });
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    delete pkg.devDependencies; delete pkg.scripts;
    await fs.writeFile(path.join(source, 'package.json'), JSON.stringify(pkg, null, 2));
    await fs.cp(helper, native, { recursive: true });
    await fs.copyFile(path.join(appRoot, 'backend.py'), path.join(native, 'backend.py'));
    await fs.cp(backend, path.join(native, 'backend'), { recursive: true });
    const { packager } = await import('@electron/packager');
    const outputs = await packager({
      dir: source, name: 'Relay Voice', executableName: 'Relay Voice',
      appBundleId: 'com.relayvoice.community', appVersion: pkg.version, buildVersion: pkg.version,
      platform: process.platform, arch: process.arch, electronVersion: require('electron/package.json').version,
      out: path.join(temp, 'output'), asar: true, asarIntegrityDigest: true, overwrite: false, prune: false,
      icon: path.join(appRoot, mac ? 'assets/relay-voice.icns' : 'assets/relay-voice.ico'),
      extraResource: [native, path.join(appRoot, 'assets/relay-voice-icon.png'), path.join(appRoot, '../licenses')],
      extendInfo: { NSMicrophoneUsageDescription: 'Relay Voice records while you hold Option to transcribe your speech.', LSApplicationCategoryType: 'public.app-category.productivity' }
    });
    const packageRoot = outputs[0];
    const bundle = mac ? path.join(packageRoot, 'Relay Voice.app') : path.join(packageRoot, 'Relay Voice.exe');
    const { flipFuses, FuseVersion, FuseV1Options } = await import('@electron/fuses');
    await flipFuses(bundle, {
      version: FuseVersion.V1, [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true, [FuseV1Options.GrantFileProtocolExtraPrivileges]: false
    });
    if (mac) {
      const { sign } = await import('@electron/osx-sign');
      await sign({ app: bundle, platform: 'darwin', identity: '-', identityValidation: false,
        preAutoEntitlements: false, preEmbedProvisioningProfile: false,
        optionsForFile: file => ({ hardenedRuntime: true, timestamp: 'none', entitlements: file.endsWith('relay-voice-helper') ? ['com.apple.security.device.audio-input'] : ['com.apple.security.cs.allow-jit', 'com.apple.security.cs.disable-library-validation', 'com.apple.security.device.audio-input'] }) });
      execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], { stdio: 'inherit' });
    }
    const destination = path.join(appRoot, mac ? 'dist/electron/Relay Voice.app' : 'dist/electron/Relay-Voice-Windows-x64');
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.rm(destination, { recursive: true, force: true });
    await fs.cp(mac ? bundle : packageRoot, destination, { recursive: true, dereference: false });
    console.log(`Packaged ${pkg.version} for ${process.platform}-${process.arch}`);
    execFileSync(process.execPath, [path.join(__dirname, 'verify-package.cjs')], { stdio: 'inherit' });
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(`Packaging failed: ${error.message}`); process.exitCode = 1; });
