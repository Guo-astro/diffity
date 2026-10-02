// Builds the diffity-mcp and diffity-cli binaries (src-tauri/src/bin, with only the `mcp` and `cli`
// features so they skip Tauri and the rest of the app) and copies them to
// src-tauri/binaries/<name>-<target-triple> so Tauri can bundle them as `externalBin` sidecars.
// `--target universal-apple-darwin` builds both macOS architectures and lipos them into
// <name>-universal-apple-darwin.
import { execFileSync } from 'node:child_process';
import { copyFileSync, chmodSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const crateDir = resolve(here, '../src-tauri');
const invokedByTauri = process.env.TAURI_ENV_PLATFORM !== undefined;
const release = process.argv.includes('--release') || (invokedByTauri && process.env.TAURI_ENV_DEBUG !== 'true');

function hostTriple() {
  const out = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
  const line = out.split('\n').find((l) => l.startsWith('host:'));
  if (!line) {
    throw new Error('could not determine rustc host triple');
  }
  return line.slice('host:'.length).trim();
}

const UNIVERSAL = 'universal-apple-darwin';
const UNIVERSAL_PARTS = ['aarch64-apple-darwin', 'x86_64-apple-darwin'];

const host = hostTriple();
const triple = process.env.TAURI_ENV_TARGET_TRIPLE || host;
const targetDir = process.env.CARGO_TARGET_DIR ? resolve(process.env.CARGO_TARGET_DIR) : join(crateDir, 'target');
const destDir = join(crateDir, 'binaries');
mkdirSync(destDir, { recursive: true });

const SIDECARS = ['diffity-mcp', 'diffity-cli'];

function build(target) {
  const cross = target !== host;
  const args = ['build', ...SIDECARS.flatMap((name) => ['--bin', name]), '--no-default-features', '--features', 'mcp,cli'];
  if (cross) {
    args.push('--target', target);
  }
  if (release) {
    args.push('--release');
  }
  execFileSync('cargo', args, { cwd: crateDir, stdio: 'inherit' });
  const ext = target.includes('windows') ? '.exe' : '';
  return Object.fromEntries(SIDECARS.map((name) => {
    const built = join(targetDir, ...(cross ? [target] : []), release ? 'release' : 'debug', `${name}${ext}`);
    const dest = join(destDir, `${name}-${target}${ext}`);
    copyFileSync(built, dest);
    chmodSync(dest, 0o755);
    console.log(`${name} sidecar -> ${dest}`);
    return [name, dest];
  }));
}

// A universal build compiles the app once per architecture (each needs its own sidecar for
// tauri-build) and then bundles `<name>-universal-apple-darwin`, the lipo of both.
function main() {
  if (triple !== UNIVERSAL) {
    build(triple);
    return;
  }
  const parts = UNIVERSAL_PARTS.map(build);
  for (const name of SIDECARS) {
    const dest = join(destDir, `${name}-${UNIVERSAL}`);
    execFileSync('lipo', ['-create', '-output', dest, ...parts.map((built) => built[name])], { stdio: 'inherit' });
    chmodSync(dest, 0o755);
    console.log(`${name} sidecar -> ${dest}`);
  }
}

main();
