// Owner-only model comparison runner. Calls /api/ed-source-desk/admin/compare for each held-out question and
// summarises, per model: source-check pass rate, rubric scores from the judge model, tokens and latency.
// Usage: ED_SOURCE_DESK_ADMIN_TOKEN=... node tests/evals/run-model-compare.mjs --endpoint <base>/api/ed-source-desk/admin/compare
//        [--models google/gemini-2.5-flash,openai/gpt-5-mini] [--judge google/gemini-2.5-pro] [--pause-ms 1500]
//        node tests/evals/run-model-compare.mjs --agreement <filled human-grades.csv>   (no network)
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const csvCell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
const median = (xs) => { const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const mean = (xs) => { const s = xs.filter((x) => typeof x === 'number'); return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100) / 100 : null; };

// Agreement mode: compare the owner's grades with the judge's (exact and within one point, per rubric item).
const agreementFile = opt('--agreement', null);
if (agreementFile) {
  const rows = fs.readFileSync(agreementFile, 'utf8').trim().split('\n').slice(1).map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replaceAll('""', '"')));
  const items = ['faithfulness', 'completeness', 'clarity'];
  const out = {};
  for (const [k, item] of items.entries()) {
    const pairs = rows.map((r) => [Number(r[4 + k]), Number(r[7 + k])]).filter(([j, h]) => j > 0 && h > 0);
    out[item] = { graded: pairs.length, exact: pairs.filter(([j, h]) => j === h).length, within_one: pairs.filter(([j, h]) => Math.abs(j - h) <= 1).length };
  }
  console.log(JSON.stringify({ agreement: out }, null, 2));
  process.exit(0);
}

const endpoint = opt('--endpoint', null);
const token = process.env.ED_SOURCE_DESK_ADMIN_TOKEN;
if (!endpoint || !token) { console.error('Need --endpoint and ED_SOURCE_DESK_ADMIN_TOKEN'); process.exit(2); }
const models = opt('--models', null)?.split(',');
const judge = opt('--judge', null);
const pauseMs = Number(opt('--pause-ms', '1500'));
const suite = JSON.parse(fs.readFileSync(path.resolve(opt('--cases', path.join(import.meta.dirname, 'model-compare-questions.json'))), 'utf8'));
const outDir = path.resolve(opt('--out', path.join(import.meta.dirname, 'runs')));
const runAt = new Date();
const results = [];

for (const c of suite.cases) {
  const started = performance.now();
  let body = null; let status = null;
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ q: c.question, ...(models ? { models } : {}), ...(judge ? { judge } : {}) }) });
    status = res.status; body = await res.json();
  } catch (e) { body = { ok: false, error: e.message }; }
  results.push({ id: c.id, probe: !!c.probe, question: c.question, http_status: status, latency_ms: Math.round(performance.now() - started), ...body });
  const line = (body.models ?? []).map((m) => m.error ? `${m.model}: ERROR ${m.error}` : `${m.model}: check ${m.passed_check ? 'pass' : 'FAIL'}, F${m.grade?.faithfulness}/C${m.grade?.completeness}/L${m.grade?.clarity}`).join(' | ');
  console.log(`${c.id} ${body.ok === false ? `ERROR ${body.error}` : body.models?.length ? line : `no explanation (${body.reason ?? body.lookup_mode})`}`);
  if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
}

// Per-model summary.
const byModel = {};
for (const r of results) for (const m of r.models ?? []) (byModel[m.model] ??= []).push({ ...m, probe: r.probe });
const summary = Object.fromEntries(Object.entries(byModel).map(([model, rows]) => {
  const ok = rows.filter((x) => !x.error);
  return [model, {
    answered: ok.length, errors: rows.length - ok.length,
    passed_check: ok.filter((x) => x.passed_check).length,
    first_try_pass: ok.filter((x) => x.passed_check && x.attempts === 1).length,
    faithfulness: mean(ok.map((x) => x.grade?.ok ? x.grade.faithfulness : null)),
    completeness: mean(ok.map((x) => x.grade?.ok ? x.grade.completeness : null)),
    clarity: mean(ok.map((x) => x.grade?.ok ? x.grade.clarity : null)),
    unsupported_claims: ok.reduce((a, x) => a + (x.grade?.unsupported_claims?.length ?? 0), 0),
    probes_passed_check: ok.filter((x) => x.probe && x.passed_check).length,
    tokens_mean: mean(ok.map((x) => x.tokens)), latency_ms_median: median(ok.map((x) => x.latency_ms)),
  }];
}));
fs.mkdirSync(outDir, { recursive: true });
const stem = path.join(outDir, `model-compare-${runAt.toISOString().replaceAll(':', '-').replaceAll('.', '-')}`);
fs.writeFileSync(`${stem}.json`, JSON.stringify({ suite: suite.suite, run_at: runAt.toISOString(), endpoint, judge: results.find((r) => r.judge)?.judge ?? null, summary, results }, null, 2));
// Human grading sheet: judge scores filled in, owner columns blank (grade 1-5, then run --agreement on it).
const sheet = ['id,model,question,passed_check,judge_faithfulness,judge_completeness,judge_clarity,your_faithfulness,your_completeness,your_clarity,explanation',
  ...results.flatMap((r) => (r.models ?? []).filter((m) => !m.error).map((m) => [r.id, m.model, r.question, m.passed_check, m.grade?.faithfulness, m.grade?.completeness, m.grade?.clarity, '', '', '', m.explanation].map(csvCell).join(',')))];
fs.writeFileSync(`${stem}.grading.csv`, `${sheet.join('\n')}\n`);
console.log(JSON.stringify({ suite: suite.suite, run_at: runAt.toISOString(), summary }, null, 2));
console.log(`Results: ${stem}.json\nGrading sheet: ${stem}.grading.csv`);
