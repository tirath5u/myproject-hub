import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
  related_documents?: { citation_id: string; title: string; source_url: string; publication_date: string; authority_label?: string }[];
};

type Passage = {
  citation_id: string; label: string; heading: string; passage: string; source_url: string; official_url: string;
  award_year: string | null; source_status: string; last_modified_date: string | null; retrieved_at: string; similarity: number;
};

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

  async function ask(query: string) {
    if (query.trim().length < 2) return;
    setQ(query);
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
        </div>
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
                <div className="font-mono text-xs opacity-60 mt-1">{c.expected_citation_ids.join(", ") || "no citation expected"}</div>
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
  if (r.no_match) {
    return (
      <div className="border p-5 text-sm space-y-2">
        <p>
          {r.no_confident_cite
            ? "No confident citation — nothing matched your question closely enough to cite. Try including a section number like 34 CFR 668.34, or rephrase."
            : "No matching Education Department documents found. Try a section number like 668.34."}
        </p>
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
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed max-h-96 overflow-auto opacity-85">{shown}</pre>
        {(r.truncated || text.length > DISPLAY_CAP) && <p className="text-xs opacity-60 mt-2">Excerpt shortened. Read the full text at the source.</p>}
        <Button asChild className="mt-5 bg-accent hover:bg-accent-hover text-accent-foreground">
          <a href={r.source_url} target="_blank" rel="noopener noreferrer">Open official source ↗</a>
        </Button>
        {r.mode === "handbook-passage" && (
          <p className="text-xs opacity-60 mt-2">Exact passage from the imported handbook, shown word for word.</p>
        )}
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

function HandbookPassages({ list }: { list: Passage[] }) {
  if (!list.length) return null;
  return (
    <div className="mt-6 border-t pt-4">
      <div className="text-xs uppercase tracking-wide opacity-60 mb-2">Related FSA Handbook passages (exact text)</div>
      <div className="space-y-4">
        {list.map((p) => (
          <div key={p.citation_id} className="border-l-2 border-accent/40 pl-3">
            <div className="text-sm font-semibold">{p.heading}</div>
            <div className="text-xs opacity-60 mb-1">
              FSA Handbook {p.award_year} · {p.source_status} · last modified {p.last_modified_date ?? "unknown"} · fetched {new Date(p.retrieved_at).toLocaleDateString()}
            </div>
            <PriorYearWarning year={p.award_year} />
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed max-h-48 overflow-auto opacity-85">{p.passage}</pre>
            <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">Open this passage on fsapartners.ed.gov ↗</a>
          </div>
        ))}
      </div>
    </div>
  );
}
