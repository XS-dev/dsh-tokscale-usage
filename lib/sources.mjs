// Bounded metadata-only hints for two known tokscale v4.19.1 source roots.
// Directory existence does not prove the engine read or indexed any records.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function probeSources({ home, env = process.env, stat = fs.stat, timeoutMs = 1500 } = {}) {
  const explicitHome = typeof home === 'string' && home.length > 0;
  const defaultHome = process.platform === 'win32' && env.HOME && path.isAbsolute(env.HOME) ? env.HOME : os.homedir();
  const root = explicitHome ? home : defaultHome;
  const override = (name, fallback) => !explicitHome && typeof env[name] === 'string' && env[name].trim() ? env[name] : fallback;
  const dsh = override('DSH_HOME', path.join(root, '.dsh'));
  const codex = override('CODEX_HOME', path.join(root, '.codex'));
  const candidates = [
    { client: 'dsh', kind: 'sessions', path: path.join(dsh, 'sessions') },
    { client: 'codex', kind: 'sessions', path: path.join(codex, 'sessions') },
    { client: 'codex', kind: 'archived_sessions', path: path.join(codex, 'archived_sessions') },
  ];
  async function probe(candidate) {
    let timer;
    try {
      const result = await Promise.race([
        stat(candidate.path).then(s => s.isDirectory() ? 'directory-present' : 'not-directory'),
        new Promise(resolve => { timer = setTimeout(() => resolve('unknown-timeout'), timeoutMs); timer.unref?.(); }),
      ]);
      return { ...candidate, status: result };
    } catch (e) {
      const code = String(e?.code || 'unknown');
      return { ...candidate, status: code === 'ENOENT' || code === 'ENOTDIR' ? 'not-found' : 'unreadable', error: code };
    } finally { if (timer) clearTimeout(timer); }
  }
  return { candidates: await Promise.all(candidates.map(probe)),
    note: 'Only metadata for three known candidate roots was checked. This does not prove records were scanned, and excludes configured extra paths and other clients.' };
}
