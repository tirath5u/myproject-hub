import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}
const suitePath = path.resolve(option('--cases', path.join(import.meta.dirname, 'stage1-routing-cases.json')));
const endpoint = option('--endpoint', 'https://myproduct.life/api/ed-source-desk/lookup');
const outDir = path.resolve(option('--out', path.join(import.meta.dirname, 'runs')));
const pauseMs = Number(option('--pause-ms', '750'));
if (!Number.isFinite(pauseMs) || pauseMs < 0) throw new Error('Invalid --pause-ms');
const suite = JSON.parse(fs.readFileSync(suitePath, 'utf8'));
const results = [];
const now = new Date();
const runId = now.toISOString().replaceAll(':', '-').replaceAll('.', '-');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestJson(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.json();
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function citations(response) {
  return [response?.citation_id, ...(response?.citation_ids ?? []),
    ...(response?.definitions ?? []).map((x) => x.citation_id),
    ...(response?.handbook_passages ?? []).map((x) => x.citation_id)]
    .filter(Boolean);
}

async function evaluate(test, response) {
  const issues = [];
  const ids = citations(response);
  const passages = response?.handbook_passages ?? [];
  if (response?.ok !== true) issues.push('response.ok is not true');
  if (passages.some((x) => x.award_year && x.award_year !== '2026-27')) {
    issues.push('handbook passage from another award year');
  }
  if (ids.length && /no confident citation/i.test(response?.message ?? '')) {
    issues.push('no-citation message shown with a cited item');
  }
  switch (test.kind) {
    case 'citation':
      if (response?.citation_id !== test.citation) issues.push(`expected citation ${test.citation}`);
      if (response?.refuse) issues.push('unexpected refusal');
      break;
    case 'definition-only':
      if (response?.mode !== 'definition-only') issues.push('expected definition-only mode');
      if (response?.no_confident_cite !== false) issues.push('definition incorrectly marked no confident citation');
      if (response?.no_match !== true) issues.push('definition incorrectly marked complete');
      if (!(response?.definitions ?? []).some((x) => x.citation_id === test.citation)) {
        issues.push(`missing definition ${test.citation}`);
      }
      break;
    case 'related-only':
      if (!passages.length) issues.push('missing related passages');
      if (passages.some((x) => x.role !== 'related')) issues.push('passage incorrectly labeled answer');
      if (response?.no_confident_cite !== false) issues.push('related passage incorrectly marked no citation');
      if (test.required_heading && !passages.some((x) => (x.heading ?? '').includes(test.required_heading))) {
        issues.push(`missing related heading ${test.required_heading}`);
      }
      break;
    case 'citation-with-related':
      if (response?.citation_id !== test.citation) issues.push(`expected citation ${test.citation}`);
      if (!passages.length) issues.push('missing related passages');
      if (passages.some((x) => x.role !== 'related')) issues.push('handbook passage incorrectly labeled answer');
      break;
    case 'no-confident-citation':
      if (response?.no_confident_cite !== true) issues.push('expected no confident citation');
      if (ids.length) issues.push('unexpected citation');
      break;
    case 'refuse':
      if (response?.refuse !== true || response?.mode !== 'refuse') issues.push('expected refusal');
      if (response?.refuse_reason !== test.reason) issues.push(`expected refusal reason ${test.reason}`);
      if (ids.length) issues.push('refusal exposed citation');
      break;
    case 'recent-ed-fafsa': {
      const items = response?.results ?? [];
      const top = items[0];
      if (response?.mode !== 'fr-search' || !top) {
        issues.push('expected Federal Register search result');
        break;
      }
      if (response?.citation_id !== top.citation_id) issues.push('top result and cited result differ');
      if (!/FAFSA/i.test(`${top.title ?? ''} ${top.abstract ?? ''}`)) issues.push('top result does not mention FAFSA');
      const date = new Date(`${top.publication_date}T00:00:00Z`);
      const cutoff = new Date(now);
      cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
      if (!Number.isFinite(date.getTime()) || date < cutoff || date > now) issues.push('top result outside last 12 months');
      for (let i = 1; i < items.length; i++) {
        if (items[i].publication_date > items[i - 1].publication_date) {
          issues.push('Federal Register results are not newest first');
          break;
        }
      }
      if (!/^fr:[0-9]{4}-[0-9]+$/.test(top.citation_id ?? '')) {
        issues.push('top result has no Federal Register document number');
        break;
      }
      const documentNumber = top.citation_id.slice(3);
      try {
        const official = await requestJson(`https://www.federalregister.gov/api/v1/documents/${documentNumber}.json`);
        const agencyNames = (official.body?.agencies ?? []).map((x) => x.name).join(' ');
        if (official.status !== 200 || !/Education Department/i.test(agencyNames)) {
          issues.push('official Federal Register API does not confirm Education Department agency');
        }
        if (official.body?.publication_date !== top.publication_date) {
          issues.push('publication date differs from official Federal Register API');
        }
      } catch (error) {
        issues.push(`official Federal Register verification unavailable: ${error.message}`);
      }
      break;
    }
    default:
      issues.push(`unknown test kind ${test.kind}`);
  }
  return issues;
}

for (const test of suite.cases) {
  const started = performance.now();
  let status = null;
  let response = null;
  let issues = [];
  try {
    const result = await requestJson(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: test.question }),
    });
    status = result.status;
    response = result.body;
    if (status !== 200) issues.push(`HTTP ${status}`);
    issues.push(...await evaluate(test, response));
  } catch (error) {
    issues.push(`request failed: ${error.message}`);
  }
  const row = {
    id: test.id, question: test.question, kind: test.kind, http_status: status,
    latency_ms: Math.round(performance.now() - started), pass: issues.length === 0,
    issues, mode: response?.mode ?? null, citation_ids: citations(response), response,
  };
  results.push(row);
  process.stdout.write(`${row.pass ? 'PASS' : 'FAIL'} ${test.id} ${row.latency_ms}ms${issues.length ? `: ${issues.join('; ')}` : ''}\n`);
  if (pauseMs) await sleep(pauseMs);
}

fs.mkdirSync(outDir, { recursive: true });
const summary = {
  suite: suite.suite, run_at: now.toISOString(), endpoint, fixture: suitePath,
  total: results.length, pass: results.filter((x) => x.pass).length,
  fail: results.filter((x) => !x.pass).length,
  scope: 'citation routing and refusal, not answer correctness',
};
const stem = path.join(outDir, runId);
fs.writeFileSync(`${stem}.json`, JSON.stringify({ summary, results }, null, 2));
const csv = ['id,pass,http_status,latency_ms,mode,citation_ids,issues',
  ...results.map((x) => [x.id, x.pass, x.http_status ?? '', x.latency_ms, x.mode ?? '',
    x.citation_ids.join('|'), x.issues.join('|')].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))];
fs.writeFileSync(`${stem}.csv`, `${csv.join('\n')}\n`);
process.stdout.write(`${JSON.stringify(summary)}\nResults: ${stem}.json\n`);
if (summary.fail) process.exitCode = 1;
