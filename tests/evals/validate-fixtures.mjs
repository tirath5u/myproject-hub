// Offline fixture validation for the eval suites (run in CI; no network).
import fs from 'node:fs';
import path from 'node:path';

const dir = import.meta.dirname;
const KINDS = {
  'citation': ['citation'],
  'definition-only': ['citation'],
  'related-only': [],
  'citation-with-related': ['citation'],
  'no-confident-citation': [],
  'refuse': ['reason'],
  'recent-ed-fafsa': [],
  'pell-passage': ['expect'],
  'fictional-amount-guard': [],
};
const EXPECT = new Set(['answer', 'answer-or-related', 'partial-or-related', 'related-only', 'present']);
const SECRET = /api[_-]?key|sk-[a-z0-9]{10,}|bearer\s+[a-z0-9._-]{10,}|service_role|eyJ[a-zA-Z0-9_-]{10,}\./i;
const errors = [];
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  let suite;
  try { suite = JSON.parse(raw); } catch (e) { errors.push(`${f}: invalid JSON (${e.message})`); continue; }
  if (SECRET.test(raw)) errors.push(`${f}: looks like it contains a key or token`);
  if (!suite.suite || !Array.isArray(suite.cases) || !suite.cases.length) { errors.push(`${f}: needs "suite" and non-empty "cases"`); continue; }
  const ids = new Set();
  for (const c of suite.cases) {
    const where = `${f}#${c.id ?? '?'}`;
    if (!c.id || ids.has(c.id)) errors.push(`${where}: missing or duplicate id`);
    ids.add(c.id);
    if (typeof c.question !== 'string' || c.question.trim().length < 2 || c.question.length > 500) errors.push(`${where}: question must be 2-500 characters`);
    const req = KINDS[c.kind];
    if (!req) { errors.push(`${where}: unknown kind ${c.kind}`); continue; }
    for (const k of req) if (c[k] === undefined) errors.push(`${where}: kind ${c.kind} needs "${k}"`);
    if (c.kind === 'pell-passage' && !EXPECT.has(c.expect)) errors.push(`${where}: expect must be one of ${[...EXPECT].join(', ')}`);
    if (c.accepted_headings && !(Array.isArray(c.accepted_headings) && c.accepted_headings.every((h) => typeof h === 'string' && h))) errors.push(`${where}: accepted_headings must be strings`);
    if (suite.status === 'candidate-unreviewed' && c.status !== 'candidate-unreviewed') errors.push(`${where}: candidate suites mark every case candidate-unreviewed`);
  }
  if (!['candidate-unreviewed', 'reviewed', undefined].includes(suite.status)) errors.push(`${f}: status must be candidate-unreviewed or reviewed`);
  if (suite.status === 'reviewed' && !(suite.reviewed_by && suite.reviewed_at)) errors.push(`${f}: a reviewed suite needs reviewed_by and reviewed_at`);
  if (suite.status === 'reviewed' && suite.cases.some((c) => c.status && c.status !== 'reviewed')) errors.push(`${f}: a reviewed suite has unreviewed cases`);
  for (const x of [...(suite.stage1_expected_changes ?? []), ...(suite.expected_changes ?? [])]) if (!x.id || !x.reason) errors.push(`${f}: each expected-change entry needs id and reason`);
  process.stdout.write(`ok ${f}: ${suite.cases.length} cases\n`);
}
if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exit(1); }
