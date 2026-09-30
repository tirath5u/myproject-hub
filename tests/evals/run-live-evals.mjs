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
// A suite whose `stage1_expected_changes` lists intended behavior changes (e.g. Stage 2A for U09).
const expectedChangesPath = option('--expected-changes', null);
const expectedChanges = new Map(expectedChangesPath
  ? (JSON.parse(fs.readFileSync(path.resolve(expectedChangesPath), 'utf8')).stage1_expected_changes ?? []).map((x) => [x.id, x])
  : []);
if (!Number.isFinite(pauseMs) || pauseMs < 0) throw new Error('Invalid --pause-ms');
const suite = JSON.parse(fs.readFileSync(suitePath, 'utf8'));
const results = [];
const now = new Date();
const runId = now.toISOString().replaceAll(':', '-').replaceAll('.', '-');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };

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

const FICTIONAL = (suite.fictional_amounts ?? ['$7,500', '$750']).map((a) => new RegExp(`${a.replace(/[$.]/g, '\\$&')}(?![\\d,])`));
const hasFictional = (text) => FICTIONAL.some((re) => re.test(text ?? ''));
const fromDocument = (p, doc) => !doc || (p.citation_id ?? '').includes(`:${doc}:`);
const headingOk = (p, list) => !list?.length || list.some((h) => (p.heading ?? '').startsWith(h));

// Each check is recorded as a named assertion (pass or fail); `issues` are the failed ones.
// Stage 1 checks keep their original failure wording as the assertion name, so old reports still line up.
async function evaluate(test, response) {
  const assertions = [];
  const issues = {
    push: (...names) => { for (const name of names) assertions.push({ name, pass: false }); },
  };
  const check = (name, ok) => { assertions.push({ name, pass: !!ok }); };
  const ids = citations(response);
  const passages = response?.handbook_passages ?? [];
  check('response.ok is not true', !(response?.ok !== true));
  check('handbook passage from another award year', !(passages.some((x) => x.award_year && x.award_year !== '2026-27')));
  check('no-citation message shown with a cited item', !(ids.length && /no confident citation/i.test(response?.message ?? '')));
  // Any passage quoting the fictional example amounts must be flagged and carry a warning.
  for (const p of passages.filter((x) => hasFictional(x.passage))) {
    check(`passage ${p.citation_id} with fictional amounts is flagged`, p.fictional_amounts === true);
    check(`passage ${p.citation_id} with fictional amounts has a warning`, typeof p.warning === 'string' && p.warning.length > 0);
    check(`warning is outside the quoted text for ${p.citation_id}`, !/^fictional amounts/i.test(p.passage ?? ''));
  }
  switch (test.kind) {
    case 'citation':
      check(`expected citation ${test.citation}`, !(response?.citation_id !== test.citation));
      check('unexpected refusal', !(response?.refuse));
      break;
    case 'definition-only':
      check('expected definition-only mode', !(response?.mode !== 'definition-only'));
      check('definition incorrectly marked no confident citation', !(response?.no_confident_cite !== false));
      check('definition incorrectly marked complete', !(response?.no_match !== true));
      check(`missing definition ${test.citation}`, !(!(response?.definitions ?? []).some((x) => x.citation_id === test.citation)));
      break;
    case 'related-only':
      check('missing related passages', !(!passages.length));
      check('passage incorrectly labeled answer', !(passages.some((x) => x.role !== 'related')));
      check('related passage incorrectly marked no citation', !(response?.no_confident_cite !== false));
      check(`missing related heading ${test.required_heading}`, !(test.required_heading && !passages.some((x) => (x.heading ?? '').includes(test.required_heading))));
      break;
    case 'citation-with-related':
      check(`expected citation ${test.citation}`, !(response?.citation_id !== test.citation));
      check('missing related passages', !(!passages.length));
      check('handbook passage incorrectly labeled answer', !(passages.some((x) => x.role !== 'related')));
      break;
    case 'no-confident-citation':
      check('expected no confident citation', !(response?.no_confident_cite !== true));
      check('unexpected citation', !(ids.length));
      break;
    case 'refuse':
      check('expected refusal', !(response?.refuse !== true || response?.mode !== 'refuse'));
      check(`expected refusal reason ${test.reason}`, !(response?.refuse_reason !== test.reason));
      check('refusal exposed citation', !(ids.length));
      break;
    case 'recent-ed-fafsa': {
      const items = response?.results ?? [];
      const top = items[0];
      if (response?.mode !== 'fr-search' || !top) {
        issues.push('expected Federal Register search result');
        break;
      }
      check('top result and cited result differ', !(response?.citation_id !== top.citation_id));
      check('top result does not mention FAFSA', !(!/FAFSA/i.test(`${top.title ?? ''} ${top.abstract ?? ''}`)));
      const date = new Date(`${top.publication_date}T00:00:00Z`);
      const cutoff = new Date(now);
      cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
      check('top result outside last 12 months', !(!Number.isFinite(date.getTime()) || date < cutoff || date > now));
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
        check('official Federal Register API does not confirm Education Department agency', !(official.status !== 200 || !/Education Department/i.test(agencyNames)));
        check('publication date differs from official Federal Register API', !(official.body?.publication_date !== top.publication_date));
      } catch (error) {
        issues.push(`official Federal Register verification unavailable: ${error.message}`);
      }
      break;
    }
    case 'pell-passage': {
      const answer = passages.find((x) => x.role === 'answer');
      const matching = passages.filter((x) => fromDocument(x, suite.document) && headingOk(x, test.accepted_headings));
      check('no refusal', !response?.refuse);
      check(`has a ${suite.document ?? 'handbook'} passage${test.accepted_headings ? ` headed ${test.accepted_headings.join(' or ')}` : ''}`, matching.length > 0);
      for (const d of response?.definitions ?? []) check(`definition ${d.citation_id} is allowed`, (test.allowed_definitions ?? []).includes(d.citation_id));
      if (test.expect === 'answer') {
        check('mode is handbook-passage', response?.mode === 'handbook-passage');
        check('the answer passage is an accepted passage', !!answer && matching.includes(answer));
        check('the answer is not a worked example', !!answer && answer.is_example !== true);
      } else if (test.expect === 'answer-or-related') {
        check('answer, if any, is an accepted passage', !answer || matching.includes(answer));
      } else if (test.expect === 'partial-or-related') {
        check('never a complete answer', response?.mode !== 'handbook-passage' || response?.coverage?.status === 'partial');
        check('related passages are not marked no-citation', response?.no_confident_cite !== true);
      } else if (test.expect === 'related-only') {
        check('no handbook passage is labeled answer', !answer);
        check('mode is not handbook-passage', response?.mode !== 'handbook-passage');
      }
      break;
    }
    case 'fictional-amount-guard': {
      const answer = passages.find((x) => x.role === 'answer');
      check('no refusal', !response?.refuse);
      check('answer passage has no fictional amounts', !answer || (answer.fictional_amounts !== true && !hasFictional(answer.passage)));
      check('answer passage is not a worked example', !answer || answer.is_example !== true);
      check('cited text does not show a fictional amount', response?.mode !== 'handbook-passage' || !hasFictional(response?.text));
      check('says official amounts are published separately', /published separately/i.test(response?.official_amount_notice ?? ''));
      break;
    }
    default:
      issues.push(`unknown test kind ${test.kind}`);
  }
  return assertions;
}

for (const test of suite.cases) {
  const started = performance.now();
  let status = null;
  let response = null;
  let issues = [];
  let assertions = [];
  try {
    const result = await requestJson(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: test.question }),
    });
    status = result.status;
    response = result.body;
    // HTTP 200 is recorded but never counts as passage correctness.
    assertions.push({ name: 'HTTP 200', pass: status === 200 });
    assertions.push(...await evaluate(test, response));
  } catch (error) {
    assertions.push({ name: `request failed: ${error.message}`, pass: false });
  }
  issues = assertions.filter((a) => !a.pass).map((a) => a.name);
  const pass = issues.length === 0;
  const change = expectedChanges.get(test.id);
  const tokens = response?.handbook_embedding_tokens;
  const row = {
    id: test.id, question: test.question, kind: test.kind, status: test.status ?? suite.status ?? null, http_status: status,
    latency_ms: Math.round(performance.now() - started), pass, expected_change: !pass && !!change, expected_change_reason: !pass && change ? change.reason : null,
    assertions, issues, mode: response?.mode ?? null, citation_ids: citations(response),
    cost: { embedding_tokens: typeof tokens === 'number' ? tokens : 'unavailable' },
    handbook_lookup_version: response?.handbook_lookup_version ?? null, handbook_staged_included: response?.handbook_staged_included ?? null,
    response,
  };
  results.push(row);
  const label = row.pass ? 'PASS' : row.expected_change ? 'EXPECTED-CHANGE' : 'FAIL';
  process.stdout.write(`${label} ${test.id} ${row.latency_ms}ms${issues.length ? `: ${issues.join('; ')}` : ''}\n`);
  if (pauseMs) await sleep(pauseMs);
}

fs.mkdirSync(outDir, { recursive: true });
const summary = {
  suite: suite.suite, run_at: now.toISOString(), endpoint, fixture: suitePath,
  status: suite.status ?? 'reviewed',
  total: results.length, pass: results.filter((x) => x.pass).length,
  fail: results.filter((x) => !x.pass).length,
  expected_changes: results.filter((x) => x.expected_change).map((x) => x.id),
  regressions: results.filter((x) => !x.pass && !x.expected_change).length,
  assertions: { total: results.reduce((a, x) => a + x.assertions.length, 0), pass: results.reduce((a, x) => a + x.assertions.filter((y) => y.pass).length, 0) },
  latency_ms: { median: median(results.map((x) => x.latency_ms)), max: Math.max(...results.map((x) => x.latency_ms)) },
  cost: { embedding_tokens: results.every((x) => typeof x.cost.embedding_tokens === 'number') ? results.reduce((a, x) => a + x.cost.embedding_tokens, 0) : 'unavailable' },
  scope: 'citation routing, refusal, passage labels and roles; not answer correctness',
};
const stem = path.join(outDir, runId);
fs.writeFileSync(`${stem}.json`, JSON.stringify({ summary, results }, null, 2));
const csv = ['id,pass,expected_change,http_status,latency_ms,embedding_tokens,mode,assertions_passed,assertions_total,citation_ids,issues',
  ...results.map((x) => [x.id, x.pass, x.expected_change, x.http_status ?? '', x.latency_ms, x.cost.embedding_tokens, x.mode ?? '',
    x.assertions.filter((a) => a.pass).length, x.assertions.length,
    x.citation_ids.join('|'), x.issues.join('|')].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))];
// Per-assertion export (one row per check).
const acsv = ['id,assertion,pass', ...results.flatMap((x) => x.assertions.map((a) => [x.id, a.name, a.pass]
  .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')))];
fs.writeFileSync(`${stem}.assertions.csv`, `${acsv.join('\n')}\n`);
fs.writeFileSync(`${stem}.csv`, `${csv.join('\n')}\n`);
process.stdout.write(`${JSON.stringify(summary)}\nResults: ${stem}.json\n`);
if (summary.regressions) process.exitCode = 1;
