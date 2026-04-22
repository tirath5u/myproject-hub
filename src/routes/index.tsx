import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Clock,
  Github,
  Linkedin,
  Mail,
  PenLine,
  Compass,
  Wrench,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

const liveTools = [
  {
    name: "Project SOR",
    description:
      "A lightweight System of Record for product managers — capture decisions, context, and the why behind every shipped change.",
    href: "https://sor.myproduct.life",
  },
];

const comingSoon = [
  "PM Templates",
  "Compliance Compass",
  "Roadmap Studio",
  "Discovery Notes",
  "EdTech Teardowns",
];

function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between px-6">
        <a href="#top" className="group flex items-center gap-1 text-base font-semibold tracking-tight text-foreground">
          myproduct
          <span className="text-accent">.</span>
          <span className="text-foreground">life</span>
        </a>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground sm:flex">
          <a href="#tools" className="transition-colors hover:text-accent">Tools</a>
          <a href="#strategy" className="transition-colors hover:text-accent">Strategy</a>
          <a href="#writing" className="transition-colors hover:text-accent">Writing</a>
          <a href="#contact" className="transition-colors hover:text-accent">Contact</a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="mx-auto w-full max-w-[1100px] px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
        Product Manager · 14+ years
      </p>
      <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl">
        Hi, I&apos;m{" "}
        <span className="text-accent">Tirath Chhatriwala</span>.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
        I build products and tools at the intersection of EdTech, regulatory
        compliance, and higher education.{" "}
        <span className="text-foreground">myproduct.life</span> is where my side
        projects, notes, and writing live.
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <a
          href="#tools"
          className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover"
        >
          Explore my tools
        </a>
        <a
          href="#contact"
          className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          Get in touch
        </a>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">
        <Icon className="h-3.5 w-3.5" />
        {eyebrow}
      </div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function ToolsGrid() {
  return (
    <section
      id="tools"
      className="mx-auto w-full max-w-[1100px] border-t border-border/60 px-6 py-20 sm:py-24"
    >
      <SectionHeading
        eyebrow="My Tools"
        title={<>Small tools, <span className="text-accent">sharper PM work</span>.</>}
        description="Side projects I build to make my own product work easier — and share with anyone who finds them useful."
        icon={Wrench}
      />

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {liveTools.map((tool) => (
          <a
            key={tool.name}
            href={tool.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex flex-col rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_8px_30px_-12px_color-mix(in_oklab,var(--accent)_35%,transparent)]"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold tracking-tight text-accent">
                {tool.name}
              </h3>
              <ArrowUpRight className="h-4 w-4 text-accent transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {tool.description}
            </p>
            <span className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Live
            </span>
          </a>
        ))}

        {comingSoon.map((name) => (
          <div
            key={name}
            aria-disabled="true"
            className="relative flex cursor-not-allowed flex-col rounded-xl border border-dashed border-border bg-muted/40 p-6 opacity-80"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold tracking-tight text-accent/70">
                {name}
              </h3>
              <Clock className="h-4 w-4 text-accent/60" />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground/80">
              In the workshop. A new tool to help PMs move faster will land here.
            </p>
            <span className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/20 bg-background px-2.5 py-1 text-xs font-medium text-accent/70">
              Coming soon
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Strategy() {
  return (
    <section
      id="strategy"
      className="mx-auto w-full max-w-[1100px] border-t border-border/60 px-6 py-20 sm:py-24"
    >
      <SectionHeading
        eyebrow="My Strategy"
        title={<>Frameworks <span className="text-accent">from the field</span>.</>}
        description="Notes on how I think about product strategy, prioritisation, and operating in regulated, high-stakes domains."
        icon={Compass}
      />
      <div className="mt-10 rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground">
          Coming soon — frameworks, teardowns, and strategy notes from 14 years of
          PM work will live here.
        </p>
      </div>
    </section>
  );
}

function Writing() {
  return (
    <section
      id="writing"
      className="mx-auto w-full max-w-[1100px] border-t border-border/60 px-6 py-20 sm:py-24"
    >
      <SectionHeading
        eyebrow="My Writing"
        title={<>Essays <span className="text-accent">in progress</span>.</>}
        description="Long-form thinking on product, EdTech, and the strange beauty of regulatory complexity."
        icon={PenLine}
      />
      <div className="mt-10 rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground">
          Coming soon — essays on product, EdTech, and regulatory complexity.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      id="contact"
      className="mx-auto w-full max-w-[1100px] border-t border-border/60 px-6 py-12"
    >
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-accent">
            Tirath Chhatriwala
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Product Manager · EdTech, compliance & higher ed.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            © {new Date().getFullYear()} myproduct.life
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="#"
            aria-label="GitHub"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <Github className="h-4 w-4" />
          </a>
          <a
            href="#"
            aria-label="LinkedIn"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <Linkedin className="h-4 w-4" />
          </a>
          <a
            href="#"
            aria-label="Email"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <Mail className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <ToolsGrid />
        <Strategy />
        <Writing />
      </main>
      <Footer />
    </div>
  );
}