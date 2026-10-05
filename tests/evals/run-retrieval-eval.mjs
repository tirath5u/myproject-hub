// Retrieval-only eval (plan item 3.3): posts each labeled question to the public lookup and records what
// was shown and the raw search candidates. No AI call, no owner token, no server change. Scoring lives in
// retrieval-score.mjs. Output goes to tests/evals/runs/ (git-ignored: it holds full source responses).
import fs from 'node:fs';
import path from 'node:path';
import { scoreCase, summarize, shownList, candidateList, TOP_K } from './retrieval-score.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const flag = (name) => args.includes(name);
const labelsPath = path.resolve(option('--labels', path.join(import.meta.dirname, 'retrieval-labels.json')));
const endpoint = option('--endpoint', 'https://myproduct.life/api/ed-source-desk/lookup');
const outDir = path.resolve(option('--out', path.join(import.meta.dirname, 'runs')));
const pauseMs = Number(option('--pause-ms', '750'));
const split = option('--split', null); // build | held-out
const reviewedOnly = flag('--reviewed-only');
const only = option('--ids', null)?.split(',');
if (!Number.isFinite(pauseMs) || pauseMs < 0) throw new Error('Invalid --pause-ms');
if (split && !['build', 'held-out'].includes(split)) throw new Error('--split must be build or held-out');

const file = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
const labels = file.cases.filter((c) => (!split || c.split === split) && (!reviewedOnly || c.status === 'reviewed') && (!only || only.includes(c.id)));
if (!labels.length) throw new Error('No labeled questions match the filters');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };

async function lookup(q) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q }), signal: controller.signal });
    return { status: res.status, body: await res.json() };
  } finally { clearTimeout(timer); }
}

const now = new Date();
const runId = `retrieval-${now.toISOString().replaceAll(':', '-').replaceAll('.', '-')}`;
const rows = [];
for (const label of labels) {
  const started = performance.now();
  let status = null, response = null, error = null;
  try { ({ status, body: response } = await lookup(label.question)); } catch (e) { error = e.message; }
  const latency = Math.round(performance.now() - started);
  const scored = error || status !== 200 ? { id: label.id, expect: label.expect, split: label.split, status: label.status, scored: false, error: error ?? `HTTP ${status}` } : scoreCase(label, response);
  rows.push({
    ...scored, question: label.question, http_status: status, latency_ms: latency,
    embedding_tokens: typeof response?.handbook_embedding_tokens === 'number' ? response.handbook_embedding_tokens : 'unavailable',
    // What came back, so unlabeled questions can be labeled from it: the shown list and the raw top-12 candidates.
    shown_detail: response ? shownList(response).map(({ id, heading, role }) => ({ id, heading, role })) : [],
    candidates: response ? candidateList(response).map(({ heading, similarity, fit }) => ({ heading, similarity, fit })) : [],
    response,
  });
  const r = rows.at(-1);
  const verdict = r.error ? `ERROR ${r.error}` : r.scored === false ? 'NEEDS-LABEL' : r.expect === 'answer' ? (r.top1 ? 'TOP1' : r.top_k ? `TOP${TOP_K}` : `MISS (${r.miss})`) : (r.correct ? 'OK' : 'WRONG');
  process.stdout.write(`${verdict} ${label.id} ${latency}ms\n`);
  if (pauseMs) await sleep(pauseMs);
}

const summary = {
  suite: file.suite, labels_file: labelsPath, run_at: now.toISOString(), endpoint,
  filters: { split: split ?? 'all', reviewed_only: reviewedOnly, ids: only ?? 'all' },
  labels_status: { reviewed: labels.filter((l) => l.status === 'reviewed').length, candidate_unreviewed: labels.filter((l) => l.status !== 'reviewed').length },
  scope: 'retrieval only: which sources were shown and where the search ranked them; not answer correctness, no AI',
  caution: labels.some((l) => l.status !== 'reviewed') ? 'Includes candidate-unreviewed labels. Publish only --reviewed-only results.' : null,
  ...summarize(rows.filter((r) => !r.error)),
  errors: rows.filter((r) => r.error).map((r) => ({ id: r.id, error: r.error })),
  latency_ms: { median: median(rows.map((r) => r.latency_ms)), max: Math.max(...rows.map((r) => r.latency_ms)) },
};
fs.mkdirSync(outDir, { recursive: true });
const stem = path.join(outDir, runId);
fs.writeFileSync(`${stem}.json`, JSON.stringify({ summary, rows }, null, 2));
const q = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
const csv = ['id,split,status,expect,verdict,rank,candidate_rank,miss,mode,shown,top_candidates',
  ...rows.map((r) => [r.id, r.split, r.status, r.expect,
    r.error ? 'error' : r.scored === false ? 'needs-label' : r.expect === 'answer' ? (r.top1 ? 'top1' : r.top_k ? `top${TOP_K}` : 'miss') : (r.correct ? 'ok' : 'wrong'),
    r.rank, r.candidate_rank, r.miss, r.mode, (r.shown ?? []).join(' | '), r.candidates.slice(0, 5).map((c) => `${c.heading} (${c.similarity})`).join(' | ')].map(q).join(','))];
fs.writeFileSync(`${stem}.csv`, `${csv.join('\n')}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\nResults: ${stem}.json\n`);
if (rows.some((r) => r.error)) process.exitCode = 1;
