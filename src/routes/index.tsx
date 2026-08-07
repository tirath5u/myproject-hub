import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Tirath Chhatriwala — Product Manager, Federal Student Aid & EdTech" },
      {
        name: "description",
        content:
          "I turn ambiguous federal financial-aid regulation into tested, versioned, publicly verifiable software — an OBBBA Schedule of Reductions calculator, an open API, and an MCP server for AI agents.",
      },
      { property: "og:title", content: "Tirath Chhatriwala — Product Manager, Federal Student Aid & EdTech" },
      {
        property: "og:description",
        content:
          "Regulation in, tested software out. Built in public: an OBBBA Schedule of Reductions calculator, an open API, and agent (MCP) integrations for financial aid.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
});

const LIFECYCLE_STEPS = [
  "Policy text",
  "Interpretation & fixtures",
  "Tested engine",
  "API + MCP",
  "Shipped & verifiable",
];

const ENGINE_STEPS = [
  "Initial max annual limit",
  "SOR % (AY reduction)",
  "Per-term share",
  "Enrollment % × share",
  "Verified disbursement",
];

const CASE_STUDIES = [
  {
    href: "https://sor.myproduct.life/work/project-sor",
    meta: "2026 · Product, policy interpretation, engineering",
    title: "Project SOR — Schedule of Reductions calculator",
    desc: "An open calculator for the OBBBA less-than-full-time Direct Loan reduction, built for financial aid offices and the students they serve.",
    stats: [
      { k: "Audiences served", v: "4" },
      { k: "Regression tests", v: "89 passing" },
      { k: "Public endpoints", v: "V1 + V2" },
    ],
  },
  {
    href: "https://sor.myproduct.life/work/cod-annual-update",
    meta: "2026-27 cycle · Product, content architecture",
    title: "COD annual update, productised",
    desc: "Turning the yearly Common Origination and Disbursement technical update into readable, gated, brand-owned segments.",
    stats: [
      { k: "Award year", v: "2026-27" },
      { k: "Format", v: "Segmented briefs" },
      { k: "Access", v: "Gated" },
    ],
  },
  {
    href: "https://sor.myproduct.life/work/sor-agent-contract",
    meta: "2026 · Product, API design",
    title: "Making a policy engine agent-callable",
    desc: "An MCP server and versioned public contract so AI agents can answer Schedule of Reductions questions with the real engine instead of guessing.",
    stats: [
      { k: "MCP tools", v: "5" },
      { k: "Contract versions", v: "V1 + V2" },
      { k: "Auth", v: "Public, read-only" },
    ],
  },
];

const PRINCIPLES = [
  { title: "Cite or don't claim", body: "Every number this site produces traces back to a labelled source, and where the regulation is unsettled the tool says so instead of guessing quietly." },
  { title: "Two audiences, one engine", body: "Students and financial aid staff need opposite levels of detail from identical math. One tested engine, different surfaces, no forked logic." },
  { title: "Make it checkable", body: "Public scenarios, an OpenAPI contract, a scenario-challenge process. If I am wrong, I want it to be cheap for someone to prove it." },
  { title: "Ship the boring parts", body: "Versioning, disclaimers, release markers, and regression fixtures are the product when the domain is compliance." },
];

function LinkedInBadge() {
  return (
    <a
      href="https://www.linkedin.com/in/tirath-c-7228b814/"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/5 pl-1 pr-3 py-1 transition-colors hover:bg-white/10"
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-accent-foreground text-xs font-bold">
        TC
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-bold text-accent">Tirath Chhatriwala</span>
        <span className="text-[11px] opacity-70">View LinkedIn profile</span>
      </span>
      <svg
        className="ml-1 h-4 w-4 shrink-0 text-accent"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    </a>
  );
}

function StepFlow({ steps, flowColor, pulseColor }: { steps: string[]; flowColor: string; pulseColor: string }) {
  return (
    <div className="flex items-start" style={{ "--flow-color": flowColor } as React.CSSProperties}>
      {steps.map((label, i) => (
        <div key={label} className="flex items-start flex-1">
          <div className="flex flex-col items-center text-center w-24 md:w-28 shrink-0">
            <div
              className="flow-node w-11 h-11 border-2 flex items-center justify-center font-extrabold text-base shrink-0"
              style={{ borderColor: flowColor, color: flowColor, "--pulse-color": pulseColor, background: "var(--background)" } as React.CSSProperties}
            >
              {i + 1}
            </div>
            <div className="text-[12.5px] font-semibold mt-2.5 leading-tight">{label}</div>
          </div>
          {i < steps.length - 1 && (
            <div className="flow-track mt-[21px]" style={{ "--i": i } as React.CSSProperties}>
              <span className="flow-arrowhead" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="flex items-center justify-between px-5 sm:px-8 py-4 border-b">
        <a href="/" className="font-extrabold text-lg">myproduct.life</a>
        <div className="flex items-center gap-6">
          <a href="#tools" className="text-sm font-semibold hidden sm:inline">Tools</a>
          <a href="#process" className="text-sm font-semibold hidden sm:inline">Process</a>
          <a href="#work" className="text-sm font-semibold hidden sm:inline">Work</a>
          <a href="#principles" className="text-sm font-semibold hidden sm:inline">How I think</a>
          <Button asChild className="bg-accent hover:bg-accent-hover text-accent-foreground">
            <a href="https://sor.myproduct.life/">Open the calculator ↗</a>
          </Button>
        </div>
      </nav>

      <section id="top" className="px-5 sm:px-8 py-16 sm:py-20 max-w-[1180px] mx-auto">
        <Badge className="mb-4 bg-accent-hover text-accent-foreground">Product Manager · Federal Student Aid · 14+ years</Badge>
        <h1 className="text-4xl sm:text-6xl font-extrabold max-w-[15ch] mb-5 leading-[1.05]">
          I turn regulation nobody wants to read into software people actually trust.
        </h1>
        <p className="text-lg max-w-[62ch] text-foreground/85 mb-3">
          Fourteen years in product, most of them at the seam of federal student aid policy and the systems that run on it. Where I add the most value: the requirement is still regulation, the stakes are compliance, and someone has to decide what the software will actually claim.
        </p>
        <p className="text-sm max-w-[60ch] text-foreground/65 mb-8">
          Cite or don't claim. Ship the boring parts. Make it checkable. That's the whole method — applied to a law that changed loan limits for less-than-full-time students in 2026.
        </p>
        <div className="flex flex-wrap gap-3 mb-10">
          <Button asChild className="bg-accent hover:bg-accent-hover text-accent-foreground"><a href="#tools">See the tools</a></Button>
          <Button asChild variant="outline"><a href="#principles">How I work</a></Button>
          <Button asChild variant="ghost" className="text-accent"><a href="https://www.linkedin.com/in/tirath-c-7228b814/">Connect on LinkedIn</a></Button>
        </div>
        <div className="border-t pt-4 flex flex-wrap items-center gap-2.5">
          <span className="text-xs uppercase tracking-wide opacity-60 mr-1">Start here —</span>
          <a href="#tools" className="text-xs border border-accent text-accent rounded-full px-3 py-1">Financial aid staff</a>
          <a href="#work" className="text-xs border border-accent text-accent rounded-full px-3 py-1">Recruiters &amp; product leaders</a>
          <a href="#for-devs" className="text-xs border border-accent text-accent rounded-full px-3 py-1">Developers &amp; AI agents</a>
        </div>
      </section>

      <section className="px-5 sm:px-8 pb-16 max-w-[1180px] mx-auto">
        <div className="grid sm:grid-cols-2 gap-px bg-border border">
          <div className="p-7 bg-[oklch(0.129_0.042_264.695)] text-[oklch(0.9_0.01_264)]">
            <div className="text-[11px] uppercase tracking-wide opacity-60 mb-3.5">The input — OBBBA, condensed</div>
            <p className="font-mono text-[13px] leading-7 opacity-85">
              "...for a student enrolled on a less-than-full-time basis, the Secretary shall apply a schedule of reductions to the applicable annual loan limit, prorated by the student's enrollment intensity for the period, calculated separately for subsidized and unsubsidized amounts, net of amounts already disbursed..."
            </p>
          </div>
          <div className="p-7 bg-muted">
            <div className="text-[11px] uppercase tracking-wide opacity-60 mb-3.5 flex items-center gap-2">
              The output — one query later
              <span className="w-1.5 h-1.5 bg-accent inline-block" style={{ animation: "livePulse 1.8s ease-in-out infinite" }} />
            </div>
            <div className="flex gap-5 flex-wrap">
              <div><div className="text-2xl font-extrabold text-accent">100%</div><div className="text-xs opacity-65">SOR eligibility</div></div>
              <div><div className="text-2xl font-extrabold">$3,500</div><div className="text-xs opacity-65">Annual Sub limit</div></div>
              <div><div className="text-2xl font-extrabold">$2,000</div><div className="text-xs opacity-65">Annual Unsub limit</div></div>
            </div>
            <p className="text-sm opacity-65 mt-4">Same math, two surfaces: a full staff engine and a plain-English student estimate. <a href="https://sor.myproduct.life/" className="text-accent">Try it live ↗</a></p>
          </div>
        </div>
      </section>

      <section id="proof" className="border-y bg-muted">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-7 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            ["89", "Regression tests passing"],
            ["V1 + V2", "Public API contract"],
            ["5", "MCP tools for AI agents"],
            ["2026-27", "Policy year, sources dated"],
          ].map(([v, k]) => (
            <div key={k}><div className="text-3xl font-extrabold text-accent">{v}</div><div className="text-xs opacity-70">{k}</div></div>
          ))}
        </div>
      </section>

      <section id="tools" className="px-5 sm:px-8 py-16 max-w-[1180px] mx-auto">
        <h6 className="text-accent text-xs font-bold uppercase tracking-wide mb-1.5">My Tools</h6>
        <h2 className="text-3xl font-extrabold max-w-[20ch] mb-9">Small tools, built for the offices and students living the reduction.</h2>
        <div className="grid sm:grid-cols-3 gap-px bg-border border">
          <a href="https://sor.myproduct.life/" className="hover-tile bg-background p-6 flex flex-col">
            <div className="flex justify-between items-start mb-3"><h3 className="font-extrabold text-lg">SOR Calculator</h3><Badge className="bg-accent-hover text-accent-foreground">Live</Badge></div>
            <p className="text-sm opacity-75 flex-1">The full staff engine: SOR %, per-term Sub/Unsub/Grad PLUS, disbursement schedules — plus a plain-English student estimate on the same tested logic.</p>
            <span className="text-sm font-semibold text-accent">Open the calculator →</span>
          </a>
          <a href="https://cod.myproduct.life" className="hover-tile bg-background p-6 flex flex-col">
            <div className="flex justify-between items-start mb-3"><h3 className="font-extrabold text-lg">COD Updates</h3><Badge className="bg-accent-hover text-accent-foreground">Live</Badge></div>
            <p className="text-sm opacity-75 flex-1">A COD annual-update portfolio hub: schema diffs, report-change dashboards, field logic, and the product narrative behind each year's release.</p>
            <span className="text-sm font-semibold text-accent">View the hub →</span>
          </a>
          <div className="bg-background p-6 flex flex-col">
            <div className="flex justify-between items-start mb-3"><h3 className="font-extrabold text-lg">In the workshop</h3><Badge variant="secondary">Next up</Badge></div>
            <p className="text-sm opacity-75 flex-1">An advanced student SOR estimator with scenario comparison, plus a lifecycle tracker for how a reduction evolves across a student's enrollment. Both build on the same engine — no forked logic.</p>
            <span className="text-sm font-semibold opacity-50">In progress</span>
          </div>
        </div>
      </section>

      <section id="process" className="px-5 sm:px-8 pt-10 pb-6 max-w-[1180px] mx-auto">
        <h6 className="text-accent text-xs font-bold uppercase tracking-wide mb-1.5">How the work gets made</h6>
        <h2 className="text-3xl font-extrabold max-w-[24ch] mb-3">From policy text to a shipped, agent-callable product.</h2>
        <p className="opacity-70 max-w-[60ch] mb-10 text-sm">The same five moves, every release. Nothing ships that skips a step.</p>
        <StepFlow steps={LIFECYCLE_STEPS} flowColor="var(--accent)" pulseColor="var(--accent-soft)" />
      </section>

      <section className="px-5 sm:px-8 pt-6 pb-16 max-w-[1180px] mx-auto">
        <div className="border p-8 bg-muted">
          <h6 className="text-accent-complement text-xs font-bold uppercase tracking-wide mb-1.5">Inside the engine</h6>
          <h3 className="text-2xl font-extrabold max-w-[30ch] mb-7">The ED 5-step Schedule of Reductions, the way it actually runs.</h3>
          <StepFlow steps={ENGINE_STEPS} flowColor="var(--accent-complement)" pulseColor="var(--accent-complement-soft)" />
          <p className="text-sm opacity-60 mt-6">Every step is source-labelled and regression-tested against published fixtures. <a href="https://sor.myproduct.life/methodology" className="text-accent-complement">Methodology &amp; sources ↗</a></p>
        </div>
      </section>

      <section id="for-devs" className="px-5 sm:px-8 pt-6 pb-16 max-w-[1180px] mx-auto">
        <h6 className="text-accent-complement text-xs font-bold uppercase tracking-wide mb-1.5">For developers &amp; AI agents</h6>
        <h2 className="text-3xl font-extrabold max-w-[24ch] mb-8">The engine isn't just a page. It's a contract.</h2>
        <div className="grid sm:grid-cols-2 gap-px bg-border border">
          <a href="https://sor.myproduct.life/api-docs" className="hover-tile bg-background p-6">
            <h4 className="font-bold mb-2">Public SOR API</h4>
            <p className="text-sm opacity-75 mb-2.5">Versioned, read-only endpoints for staff and student SOR calculations. V1 and V2 both live and documented.</p>
            <span className="text-sm font-semibold text-accent-complement">Read the API docs →</span>
          </a>
          <a href="https://sor.myproduct.life/mcp-guide" className="hover-tile bg-background p-6">
            <h4 className="font-bold mb-2">Ask an AI agent (MCP)</h4>
            <p className="text-sm opacity-75 mb-2.5">An MCP server exposing 5 tools so an agent answers SOR questions off the real, tested engine — not a guess.</p>
            <span className="text-sm font-semibold text-accent-complement">Read the MCP guide →</span>
          </a>
        </div>
      </section>

      <section id="work" className="px-5 sm:px-8 pt-6 pb-16 max-w-[1180px] mx-auto">
        <h6 className="text-accent text-xs font-bold uppercase tracking-wide mb-1.5">Proof of work</h6>
        <h2 className="text-3xl font-extrabold max-w-[26ch] mb-9">Things I have shipped, and what they cost to get right.</h2>
        <div className="flex flex-col gap-px bg-border border">
          {CASE_STUDIES.map((cs) => (
            <a key={cs.href} href={cs.href} className="hover-tile bg-background p-7 grid sm:grid-cols-[1fr_auto] gap-5 items-center">
              <div>
                <div className="text-xs opacity-55 mb-1.5">{cs.meta}</div>
                <h3 className="font-extrabold text-lg mb-2">{cs.title}</h3>
                <p className="text-sm opacity-75 max-w-[62ch] mb-3">{cs.desc}</p>
                <div className="flex gap-5 flex-wrap">
                  {cs.stats.map((s) => (
                    <div key={s.k}><div className="text-lg font-extrabold text-accent">{s.v}</div><div className="text-[11.5px] opacity-60">{s.k}</div></div>
                  ))}
                </div>
              </div>
              <span className="text-sm font-semibold text-accent whitespace-nowrap">Read the case study →</span>
            </a>
          ))}
        </div>
      </section>

      <section id="principles" className="px-5 sm:px-8 pt-6 pb-20 max-w-[1180px] mx-auto">
        <h6 className="text-accent text-xs font-bold uppercase tracking-wide mb-1.5">How I think about product</h6>
        <h2 className="text-3xl font-extrabold max-w-[22ch] mb-9">Four rules that hold in a regulated domain — and everywhere else.</h2>
        <div className="grid sm:grid-cols-4 gap-px bg-border border">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="bg-background p-6">
              <h4 className="font-bold text-accent mb-2">{p.title}</h4>
              <p className="text-sm opacity-75">{p.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button asChild variant="outline"><a href="https://sor.myproduct.life/work">Work with me — case studies</a></Button>
          <Button asChild variant="ghost" className="text-accent"><a href="https://www.linkedin.com/in/tirath-c-7228b814/">Connect on LinkedIn</a></Button>
        </div>
      </section>

      <footer className="border-t bg-[oklch(0.129_0.042_264.695)] text-[oklch(0.9_0.01_264)] px-5 sm:px-8 py-12">
        <div className="max-w-[1180px] mx-auto">
          <div className="grid sm:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8 mb-8">
            <div>
              <a href="/" className="font-extrabold text-base mb-2.5 inline-block">myproduct.life</a>
              <p className="text-sm opacity-65 max-w-[32ch]">Product management in higher-education technology. Built in public and source-backed: open Schedule of Reductions calculators, a public API, and agent integrations for federal student aid.</p>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide opacity-55 mb-3">SOR Calculators</div>
              <div className="flex flex-col gap-2 text-sm">
                <a href="https://sor.myproduct.life/">Staff SOR calculator</a>
                <a href="https://sor.myproduct.life/student">Student SOR estimate</a>
                <a href="https://sor.myproduct.life/student/advanced">Advanced student estimate</a>
                <a href="https://sor.myproduct.life/lifecycle">SOR lifecycle tracker</a>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide opacity-55 mb-3">Developers &amp; AI agents</div>
              <div className="flex flex-col gap-2 text-sm">
                <a href="https://sor.myproduct.life/api-docs">Public SOR API</a>
                <a href="https://sor.myproduct.life/mcp-guide">Ask an AI agent (MCP)</a>
                <a href="https://sor.myproduct.life/compare">Parity compare</a>
                <a href="https://sor.myproduct.life/migration">Version migration</a>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide opacity-55 mb-3">Product work</div>
              <div className="flex flex-col gap-2 text-sm">
                <a href="https://sor.myproduct.life/work">Case studies</a>
                <a href="https://sor.myproduct.life/methodology">Methodology</a>
                <a href="https://sor.myproduct.life/releases">Releases</a>
                <a href="https://sor.myproduct.life/about">About Tirath</a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/15 pt-4">
            <p className="text-[11.5px] opacity-55 max-w-[80ch] mb-2">Estimates only. Not an award, approval, or guarantee. Authority is 34 CFR 685.203 and current Federal Student Aid guidance; a school must verify every figure.</p>
            <p className="text-[11.5px] opacity-55">Copyright 2026 myproduct.life — built by Tirath Chhatriwala</p>
            <div className="mt-4">
              <LinkedInBadge />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
