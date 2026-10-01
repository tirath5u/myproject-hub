import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GOLDENS } from "@/data/ed-source-desk/goldens";

export const Route = createFileRoute("/ask-regs")({
  component: AskRegsPage,
  head: () => ({
    meta: [
      { title: "Ask Regs — ED Source Desk | myproduct.life" },
      { name: "description", content: "Ask a federal student aid regulation question and get the official citation, an excerpt, and a link to eCFR, Federal Register, or Regulations.gov. No AI guessing." },
      { property: "og:title", content: "Ask Regs — ED Source Desk" },
      { property: "og:description", content: "Search, cite, official link. A grounded regulation lookup for financial aid, with tested refusals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Result = {
  ok: boolean;
  error?: string;
  mode?: string;
  refuse?: boolean;
  refuse_reason?: string;
  citation_id?: string;
  title?: string;
  source_url?: string;
  text?: string | null;
  truncated?: boolean;
  fetched_at?: string;
  as_of_date?: string;
  no_match?: boolean;
  no_confident_cite?: boolean;
  authority_rank?: number;
  authority_label?: string;
  results?: { citation_id: string; title: string; source_url: string; publication_date: string; authority_label?: string }[];
  award_year?: string | null;
  rejected_candidate?: { citation_id?: string; title?: string; missing_terms?: string[] };
  handbook_passages?: Passage[];
  handbook_error?: string | null;
  handbook_coverage?: string;
  coverage?: { status: "retrieved-text" | "partial"; missing_terms: string[]; notes: string[] } | null;
  conditional?: string | null;
  source_unavailable?: boolean;
  related_passages?: boolean;
  definitions?: { term: string; citation_id: string; title: string; text: string; source_url: string }[];
  message?: string | null;
  related_documents?: { citation_id: string; title: string; source_url: string; publication_date: string; authority_label?: string }[];
  official_amount_notice?: string | null;
};

type Passage = {
  citation_id: string; label: string; heading: string; passage: string; source_url: string; official_url: string;
  award_year: string | null; source_status: string; last_modified_date: string | null; retrieved_at: string; similarity: number;
  page_published_date?: string | null; document_title?: string | null; is_example?: boolean; fictional_amounts?: boolean; warning?: string | null;
  look_next?: { label: string; url: string; imported?: boolean }[];
};

// Shown outside the quoted passage — never part of the handbook text itself.
function FictionalWarning({ p }: { p?: Passage }) {
  if (!p?.warning) return null;
  return (
    <div className="border border-accent-complement/60 bg-accent-complement-soft text-sm p-3 my-2">
      <strong className="text-accent-complement">Fictional amounts:</strong> {p.warning.replace(/^Fictional amounts:\s*/, "")}
    </div>
  );
}

function OfficialAmountNotice({ r }: { r: Result }) {
  if (!r.official_amount_notice || r.message === r.official_amount_notice) return null;
  return <div className="border border-accent/40 bg-accent-soft text-sm p-3 my-3">{r.official_amount_notice}</div>;
}

function PassageMeta({ p }: { p: Passage }) {
  return (
    <div className="text-xs opacity-60 mb-1">
      FSA Handbook {p.award_year} · {p.source_status === "staged" ? "staged (preview only, not yet approved)" : p.source_status} · last modified {p.last_modified_date ?? "unknown"}
      {p.page_published_date && ` · FSA page first published ${p.page_published_date}`} · fetched {new Date(p.retrieved_at).toLocaleDateString()}
    </div>
  );
}

const EXAMPLES = [
  "Satisfactory academic progress",
  "§668.22 return of funds",
  "FAFSA simplification",
  "Is student Jane Doe eligible for Pell based on her ISIR?",
];

const REASONS: Record<string, string> = {
  "student-specific": "This asks about a specific student's eligibility.",
  "private-member-content": "This asks for private membership content.",
  "non-ed-tax-advice": "This is individual tax advice, outside Department of Education rules.",
  "vendor-internal-config": "This asks about vendor or internal software setup, which isn't public law.",
};

const DISPLAY_CAP = 6000;
const CURRENT_AWARD_YEAR = "2026-27";
const isPriorYear = (y?: string | null) => !!y && y !== CURRENT_AWARD_YEAR;

function PriorYearWarning({ year }: { year?: string | null }) {
  if (!isPriorYear(year)) return null;
  return (
    <div className="border border-accent-complement/60 bg-accent-complement-soft text-sm p-3 my-3">
      <strong className="text-accent-complement">Prior award year:</strong> this is {year} guidance. This site answers for {CURRENT_AWARD_YEAR}; the {CURRENT_AWARD_YEAR} handbook chapter has not been imported yet, so confirm the rule still applies.
    </div>
  );
}

function AskRegsPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [asked, setAsked] = useState("");

  async function ask(query: string) {
    if (query.trim().length < 2) return;
    setQ(query);
    setAsked(query);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ed-source-desk/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query }),
      });
      setResult((await res.json()) as Result);
    } catch {
      setResult({ ok: false, error: "Couldn't reach the lookup service. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  const g = GOLDENS;
  const owner = useOwnerToken();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="flex items-center justify-between px-5 sm:px-8 py-4 border-b">
        <Link to="/" className="font-extrabold text-lg">myproduct.life</Link>
        <a href="/#ai-work" className="text-sm font-semibold">← AI Work</a>
      </nav>

      <section className="px-5 sm:px-8 pt-14 pb-8 max-w-[900px] mx-auto">
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge className="bg-accent-hover text-accent-foreground">$0 model cost</Badge>
          {g.eval ? (
            <Badge variant="outline" className="border-accent text-accent">Eval {g.eval.pass_count}/{g.eval.total} pass</Badge>
          ) : (
            <Badge variant="outline">Beta · eval re-run pending</Badge>
          )}
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-2">
          Ask <span className="text-accent">Regs</span>
        </h1>
        <p className="text-sm uppercase tracking-wide opacity-60 mb-4">ED Source Desk</p>
        <p className="text-lg max-w-[60ch] text-foreground/80">
          Search, cite, official link. Ask a federal student aid question and get the actual regulation, not a guess. If a question needs a person, it says so.
        </p>

        <form
          className="mt-8 flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(q);
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. What is satisfactory academic progress?"
            maxLength={500}
            className="h-11"
            aria-label="Your regulation question"
          />
          <Button type="submit" disabled={loading} className="h-11 bg-accent hover:bg-accent-hover text-accent-foreground">
            {loading ? "Looking up…" : "Find citation"}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => void ask(ex)}
              className="text-xs border border-accent/40 text-accent rounded-full px-3 py-1 hover:bg-accent-soft transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-8" aria-live="polite">
          {loading && <div className="border p-6 bg-muted animate-pulse text-sm opacity-70">Fetching from official sources…</div>}
          {result && <ResultCard r={result} />}
          {result && !loading && result.ok && <Feedback key={`${asked}|${result.citation_id ?? ""}`} q={asked} r={result} />}
          {result && !loading && owner.token && result.ok && !result.refuse && <OwnerExplain key={`${asked}|${result.citation_id ?? ""}`} q={asked} token={owner.token} onUnauthorized={owner.clear} />}
        </div>
        <OwnerSignIn owner={owner} />
      </section>

      <section className="px-5 sm:px-8 py-8 max-w-[900px] mx-auto">
        <h6 className="text-accent-complement text-xs font-bold uppercase tracking-wide mb-3">How it works</h6>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border text-sm">
          {[
            ["1. You ask", "In plain words or by section number."],
            ["2. Our server", "Checks if it should refuse, then routes the question."],
            ["3. Official source", "eCFR, Federal Register, or Regulations.gov."],
            ["4. Citation back", "ID, excerpt, and a link you can verify."],
          ].map(([t, d]) => (
            <div key={t} className="bg-background p-4">
              <div className="font-bold mb-1">{t}</div>
              <div className="opacity-70 text-xs">{d}</div>
            </div>
          ))}
        </div>
        <p className="text-xs opacity-60 mt-3">Keys stay on the server. Your browser only talks to myproduct.life.</p>
      </section>

      <section className="px-5 sm:px-8 py-8 max-w-[900px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h6 className="text-accent text-xs font-bold uppercase tracking-wide">Test cases (golden set {g.version})</h6>
          {g.eval ? (
            <span className="text-xs">
              <Badge className="bg-accent-hover text-accent-foreground mr-2">Eval {g.eval.pass_count}/{g.eval.total} pass</Badge>
              <span className="opacity-60">ran {new Date(g.eval.ran_at).toLocaleString()}</span>
            </span>
          ) : (
            <span className="text-xs opacity-60">
              {g.previous_eval
                ? `Earlier run ${g.previous_eval.pass_count}/${g.previous_eval.total} (${new Date(g.previous_eval.ran_at).toLocaleDateString()}) is out of date. ${g.previous_eval.superseded_reason}`
                : "Results pending"}
            </span>
          )}
        </div>
        <div className="border divide-y">
          {g.cases.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => void ask(c.question)}
              className="w-full text-left p-4 grid sm:grid-cols-[1fr_auto] gap-2 hover:bg-muted transition-colors"
            >
              <div>
                <div className="text-sm font-semibold">{c.question}</div>
                <div className="font-mono text-xs opacity-60 mt-1">{c.scoring_rule ? "Time-based rule: recent ED FAFSA notice (last 12 months)" : c.expected_citation_ids.join(", ") || "no citation expected"}</div>
              </div>
              <Badge variant="outline" className={c.expect_refuse ? "border-accent-complement text-accent-complement" : "border-accent text-accent"}>
                {c.expect_refuse ? "Should refuse" : "Answerable"}
              </Badge>
            </button>
          ))}
        </div>
        <p className="text-xs opacity-60 mt-2">Click any case to run it live.</p>
      </section>

      <footer className="border-t px-5 sm:px-8 py-8 mt-8">
        <div className="max-w-[900px] mx-auto text-xs opacity-65 space-y-1">
          <p>Sources: eCFR Title 34, Federal Register, Regulations.gov. Citations are the source of truth — always read the official text.</p>
          <p>Not advice. For your own aid, talk to your school's financial aid office or visit StudentAid.gov. An AI "explain" step comes later.</p>
        </div>
      </footer>
    </div>
  );
}

function ResultCard({ r }: { r: Result }) {
  if (r.source_unavailable) {
    return <div className="border border-accent-complement/50 bg-accent-complement-soft p-5 text-sm"><strong>Source temporarily unavailable.</strong> The official site is busy right now, so no citation is shown. Please try again in a minute.</div>;
  }
  if (!r.ok) {
    return <div className="border border-destructive/40 p-5 text-sm">Something went wrong: {r.error}</div>;
  }
  if (r.refuse) {
    return (
      <div className="border-2 border-accent-complement/50 bg-accent-complement-soft p-6">
        <div className="text-xs uppercase tracking-wide font-bold text-accent-complement mb-2">Not answering this one · {r.refuse_reason}</div>
        <p className="font-semibold mb-2">{REASONS[r.refuse_reason ?? ""] ?? "This question is outside what this tool should answer."}</p>
        <p className="text-sm opacity-80">
          Eligibility depends on a student's full record. Please ask your school's financial aid office, or check{" "}
          <a href="https://studentaid.gov" target="_blank" rel="noopener noreferrer" className="text-accent underline">StudentAid.gov</a>.
        </p>
      </div>
    );
  }
  if (r.no_match && r.related_passages && !!r.handbook_passages?.length) {
    return (
      <div className="border p-5 text-sm space-y-2">
        <p className="font-semibold">Related handbook passages, not a complete answer.</p>
        <OfficialAmountNotice r={r} />
        <HandbookPassages list={r.handbook_passages} bare />
        <Definitions r={r} />
        <p className="text-xs opacity-60">Handbook coverage: {r.handbook_coverage ?? "none for 2026-27 yet"}.</p>
      </div>
    );
  }
  if (r.no_match) {
    return (
      <div className="border p-5 text-sm space-y-2">
        <p>
          {r.message
            ? r.message
            : r.no_confident_cite
            ? "No confident citation — nothing matched your question closely enough to cite. Try including a section number like 34 CFR 668.34, or rephrase."
            : "No matching Education Department documents found. Try a section number like 668.34."}
        </p>
        <OfficialAmountNotice r={r} />
        {r.rejected_candidate?.citation_id && (
          <p className="text-xs opacity-70">
            Checked and set aside: <span className="font-mono">{r.rejected_candidate.citation_id}</span> ({r.rejected_candidate.title}) — it doesn't mention{" "}
            {r.rejected_candidate.missing_terms?.map((t) => `"${t}"`).join(", ")}.
          </p>
        )}
        {!!r.related_documents?.length && (
          <div className="text-xs">
            <div className="opacity-70 mb-1">Related Federal Register documents (not an answer to this question):</div>
            <ul className="space-y-1">
              {r.related_documents.map((d) => (
                <li key={d.citation_id}>
                  <a href={d.source_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{d.title}</a>{" "}
                  <span className="font-mono opacity-60">{d.citation_id}</span> <span className="opacity-60">· {d.authority_label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {r.related_passages && !!r.handbook_passages?.length && (
          <div className="text-xs">
            <div className="opacity-70 mb-1">Related handbook passages, not a complete answer:</div>
            <HandbookPassages list={r.handbook_passages} bare />
          </div>
        )}
        <Definitions r={r} />
        <p className="text-xs opacity-60">Handbook coverage: {r.handbook_coverage ?? "none for 2026-27 yet"}.</p>
      </div>
    );
  }
  const text = r.text ?? "";
  const shown = text.length > DISPLAY_CAP ? text.slice(0, DISPLAY_CAP) + "…" : text;
  return (
    <div className="border-2 border-accent/40 bg-background">
      <div className="p-6 border-b bg-accent-soft">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-mono text-xs text-accent font-bold">{r.citation_id}</span>
          <span className="font-mono text-xs opacity-60">mode: {r.mode}</span>
          {r.authority_label && (
            <Badge variant="outline" className={r.authority_rank === 3 ? "border-accent-complement text-accent-complement" : "border-accent text-accent"}>
              Authority {r.authority_rank} · {r.authority_label}
            </Badge>
          )}
        </div>
        <h2 className="text-xl font-extrabold">{r.title}</h2>
        <div className="text-xs opacity-60 mt-1">
          Fetched {r.fetched_at ? new Date(r.fetched_at).toLocaleString() : ""}
          {r.as_of_date && ` · eCFR as of ${r.as_of_date}`}
          {r.award_year && ` · Award year ${r.award_year}`}
        </div>
      </div>
      <div className="p-6">
        <PriorYearWarning year={r.award_year} />
        <OfficialAmountNotice r={r} />
        {r.mode === "handbook-passage" && <FictionalWarning p={r.handbook_passages?.find((p) => p.citation_id === r.citation_id)} />}
        {r.mode === "handbook-passage" && (() => { const p = r.handbook_passages?.find((x) => x.citation_id === r.citation_id); return p ? <PassageMeta p={p} /> : null; })()}
        {r.conditional && <div className="border border-accent/40 bg-accent-soft text-sm p-3 my-3">{r.conditional}</div>}
        {r.mode === "handbook-passage" && (
          <p className="text-xs opacity-70 my-2">Retrieved source text, not a complete answer. Read the full section at the official source.</p>
        )}
        {r.coverage?.status === "partial" && (
          <div className="border border-accent-complement/60 bg-accent-complement-soft text-sm p-3 my-3">
            <strong className="text-accent-complement">Partial answer:</strong> {r.coverage.notes.join(" ")}
          </div>
        )}
        <PassageText text={shown} className="max-h-96" />
        {(r.truncated || text.length > DISPLAY_CAP) && <p className="text-xs opacity-60 mt-2">Excerpt shortened. Read the full text at the source.</p>}
        <Button asChild className="mt-5 bg-accent hover:bg-accent-hover text-accent-foreground">
          <a href={r.source_url} target="_blank" rel="noopener noreferrer">Open official source ↗</a>
        </Button>
        {r.mode === "handbook-passage" && (
          <p className="text-xs opacity-60 mt-2">Exact passage from the imported handbook, shown word for word.</p>
        )}
        <Definitions r={r} />
        <LookNext list={(r.handbook_passages ?? []).filter((p) => p.citation_id === r.citation_id).flatMap((p) => p.look_next ?? [])} />
        <HandbookPassages list={(r.handbook_passages ?? []).filter((p) => p.citation_id !== r.citation_id)} />
        {r.results && r.results.length > 1 && (
          <div className="mt-6">
            <div className="text-xs uppercase tracking-wide opacity-60 mb-2">Other matches</div>
            <ul className="space-y-2 text-sm">
              {r.results.slice(1).map((x) => (
                <li key={x.citation_id}>
                  <a href={x.source_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{x.title}</a>{" "}
                  <span className="font-mono text-xs opacity-60">{x.citation_id}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// Handbook tables are stored as rows of "cell | cell" lines; show them as a table, word for word.
// Everything else keeps its line breaks exactly as stored.
function PassageText({ text, className = "" }: { text: string; className?: string }) {
  const blocks: { table: boolean; lines: string[] }[] = [];
  for (const line of text.split("\n")) {
    const table = line.includes(" | ");
    const last = blocks[blocks.length - 1];
    if (last && last.table === table) last.lines.push(line);
    else blocks.push({ table, lines: [line] });
  }
  return (
    <div className={`text-sm leading-relaxed overflow-auto opacity-85 ${className}`}>
      {blocks.map((b, i) =>
        b.table && b.lines.length > 1 ? (
          <table key={i} className="my-2 border-collapse text-xs w-full">
            <thead>
              <tr>{b.lines[0].split(" | ").map((c, j) => <th key={j} className="border px-2 py-1 text-left font-semibold">{c}</th>)}</tr>
            </thead>
            <tbody>
              {b.lines.slice(1).map((l, r) => (
                <tr key={r}>{l.split(" | ").map((c, j) => <td key={j} className="border px-2 py-1 align-top">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        ) : (
          <pre key={i} className="whitespace-pre-wrap font-sans">{b.lines.join("\n")}</pre>
        ),
      )}
    </div>
  );
}

// ---- Owner-only AI explanation --------------------------------------------------
// The token is the owner's admin token; it is checked on the server. It is kept only in this browser.
const OWNER_KEY = "ask-regs-owner-token";
function useOwnerToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    try { setToken(localStorage.getItem(OWNER_KEY)); } catch { /* storage unavailable */ }
  }, []);
  const save = (t: string) => { setToken(t); try { localStorage.setItem(OWNER_KEY, t); } catch { /* ignore */ } };
  const clear = () => { setToken(null); try { localStorage.removeItem(OWNER_KEY); } catch { /* ignore */ } };
  return { token, save, clear };
}

function OwnerSignIn({ owner }: { owner: ReturnType<typeof useOwnerToken> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  if (owner.token)
    return (
      <p className="text-xs opacity-60 mt-4">
        Owner mode on: an "Explain in plain English" button appears under answers.{" "}
        <button type="button" className="underline" onClick={owner.clear}>Sign out</button>
      </p>
    );
  if (!open) return <button type="button" className="text-xs opacity-40 mt-4 underline" onClick={() => setOpen(true)}>Owner</button>;
  return (
    <form className="mt-4 flex gap-2 max-w-md" onSubmit={(e) => { e.preventDefault(); if (value.trim()) owner.save(value.trim()); }}>
      <Input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Owner token" aria-label="Owner token" className="h-9 text-xs" />
      <Button type="submit" className="h-9 text-xs">Sign in</Button>
    </form>
  );
}

type Explained = {
  ok: boolean; error?: string; explanation?: string | null; reason?: string | null; model?: string; tokens?: number | string;
  sources?: { id: string; citation_id: string; label: string; kind: string; fictional: boolean }[];
};
function Feedback({ q, r }: { q: string; r: Result }) {
  const [state, setState] = useState<"idle" | "comment" | "sending" | "done" | "error">("idle");
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  async function send(h: boolean, text: string) {
    setState("sending");
    try {
      const res = await fetch("/api/ed-source-desk/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful: h, q, lookup_mode: r.mode, citation_id: r.citation_id, comment: text.trim() || undefined }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }
  if (state === "done") return <p className="mt-3 text-xs opacity-70">Thanks — your feedback helps improve Ask Regs.</p>;
  if (state === "error") return <p className="mt-3 text-xs opacity-70">Couldn't send feedback right now.</p>;
  if (state === "comment" || (state === "sending" && helpful !== null))
    return (
      <form className="mt-3 flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); void send(helpful ?? false, comment); }}>
        <Input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder={helpful ? "What was useful? (optional)" : "What was wrong or missing? (optional, no personal details)"} aria-label="Feedback comment" className="h-9 text-sm" />
        <Button type="submit" variant="outline" disabled={state === "sending"} className="h-9 text-sm">Send</Button>
      </form>
    );
  return (
    <div className="mt-3 flex items-center gap-2 text-xs">
      <span className="opacity-70">Was this helpful?</span>
      {[true, false].map((h) => (
        <button key={String(h)} type="button" onClick={() => { setHelpful(h); setState("comment"); }}
          className="border rounded-full px-3 py-1 hover:bg-muted transition-colors">{h ? "Yes" : "No"}</button>
      ))}
    </div>
  );
}

function OwnerExplain({ q, token, onUnauthorized }: { q: string; token: string; onUnauthorized: () => void }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [data, setData] = useState<Explained | null>(null);
  async function run() {
    setState("loading");
    try {
      const res = await fetch("/api/ed-source-desk/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ q }),
      });
      if (res.status === 401 || res.status === 404) { onUnauthorized(); setData({ ok: false, error: "Owner token not accepted. Sign in again." }); }
      else setData((await res.json()) as Explained);
    } catch {
      setData({ ok: false, error: "Couldn't reach the explanation service." });
    }
    setState("done");
  }
  if (state === "idle")
    return <Button type="button" variant="outline" className="mt-4 border-accent text-accent" onClick={() => void run()}>Explain in plain English (owner only)</Button>;
  if (state === "loading") return <div className="mt-4 border p-4 text-sm bg-muted animate-pulse">Writing an explanation from the cited sources…</div>;
  return (
    <div className="mt-4 border-2 border-dashed border-accent/50 p-5 text-sm space-y-3">
      <div className="text-xs uppercase tracking-wide font-bold text-accent">AI explanation · owner-only draft</div>
      {data?.explanation ? (
        <>
          <div className="whitespace-pre-wrap leading-relaxed">{data.explanation}</div>
          <div className="text-xs opacity-70 space-y-1">
            {data.sources?.map((s) => (
              <div key={s.id}><span className="font-mono">[{s.id}]</span> {s.label} <span className="opacity-60">({s.kind}{s.fictional ? ", fictional example amounts" : ""})</span></div>
            ))}
          </div>
          <p className="text-xs opacity-60">Written by {data.model} from the quoted sources above only, and checked that every point cites one. Verify each point against the quoted text before relying on it.{typeof data.tokens === "number" ? ` ${data.tokens} tokens.` : ""}</p>
        </>
      ) : (
        <p>{data?.error ?? data?.reason ?? "No explanation."}</p>
      )}
    </div>
  );
}

function HandbookPassages({ list, bare }: { list: Passage[]; bare?: boolean }) {
  if (!list.length) return null;
  return (
    <div className={bare ? "mt-2" : "mt-6 border-t pt-4"}>
      {!bare && <div className="text-xs uppercase tracking-wide opacity-60 mb-2">Related handbook passages, not a complete answer (exact text)</div>}
      <div className="space-y-4">
        {list.map((p) => (
          <div key={p.citation_id} className="border-l-2 border-accent/40 pl-3">
            <div className="text-sm font-semibold">{p.heading}</div>
            <PassageMeta p={p} />
            <PriorYearWarning year={p.award_year} />
            <FictionalWarning p={p} />
            <PassageText text={p.passage} className="max-h-48" />
            <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">Open this passage on fsapartners.ed.gov ↗</a>
            <LookNext list={p.look_next ?? []} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LookNext({ list }: { list: { label: string; url: string; imported?: boolean }[] }) {
  if (!list.length) return null;
  const groups = [
    { title: "Also in this library (ask about it here): ", items: list.filter((l) => l.imported) },
    { title: "Where to look next (not imported yet): ", items: list.filter((l) => !l.imported) },
  ].filter((g) => g.items.length);
  return (
    <>
      {groups.map((g) => (
        <div key={g.title} className="text-xs mt-2">
          <span className="opacity-70">{g.title}</span>
          {g.items.map((l, i) => (
            <span key={l.label}>
              {i > 0 && " · "}
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">FSA Handbook {l.label} ↗</a>
            </span>
          ))}
        </div>
      ))}
    </>
  );
}

function Definitions({ r }: { r: Result }) {
  if (!r.definitions?.length) return null;
  return (
    <div className="mt-6 border-t pt-4 space-y-3">
      <div className="text-xs uppercase tracking-wide opacity-60">Definitions (official regulation text)</div>
      {r.definitions.map((d) => (
        <div key={d.term} className="border-l-2 border-accent/40 pl-3">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed opacity-85">{d.text}</pre>
          <a href={d.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">Open {d.citation_id.replace("ecfr:34-", "34 CFR ")} on eCFR ↗</a>
        </div>
      ))}
    </div>
  );
}
