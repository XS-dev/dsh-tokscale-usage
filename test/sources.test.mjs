import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { probeSources } from '../lib/sources.mjs';

test('source probe distinguishes present, missing and unreadable without scanning', async () => {
  const seen = [];
  const stat = async p => {
    seen.push(p);
    if (p.endsWith('archived_sessions')) throw Object.assign(new Error('denied'), { code: 'EACCES' });
    if (p.includes('dsh-root')) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    return { isDirectory: () => true };
  };
  const out = await probeSources({ env: { DSH_HOME: 'dsh-root', CODEX_HOME: 'codex-root' }, stat });
  assert.equal(seen.length, 3);
  assert.deepEqual(out.candidates.map(c => c.status), ['not-found', 'directory-present', 'unreadable']);
  assert.equal(out.candidates[2].error, 'EACCES');
  assert.match(out.note, /does not prove/);
});

test('explicit home ignores source environment overrides', async () => {
  const out = await probeSources({ home: '/fixture', env: { DSH_HOME: 'ignored-dsh', CODEX_HOME: 'ignored-codex' }, stat: async () => ({ isDirectory: () => true }) });
  assert.equal(out.candidates[0].path, path.join('/fixture', '.dsh', 'sessions'));
  assert.equal(out.candidates[1].path, path.join('/fixture', '.codex', 'sessions'));
});
