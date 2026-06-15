'use client';

import { useTranslations } from 'next-intl';
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, Check, Sparkles, Search, Database, GitBranch, Layers, Terminal as TerminalIcon } from "lucide-react";
import { Terminal, TypingAnimation } from "@/components/ui/terminal";
import { SparklesText } from "@/components/ui/sparkles-text";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BentoGrid } from "@/components/ui/bento-grid";
import { ShineBorder } from "@/components/ui/shine-border";
import { BorderBeam } from "@/components/ui/border-beam";
import { Marquee } from "@/components/ui/marquee";
import { RetroGrid } from "@/components/ui/retro-grid";
import { AuroraText } from "@/components/aurora-text";
import FlickeringGrid from "@/components/ui/flickering-grid";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { motion } from "framer-motion";

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

const featureIcons = [
  <Search key="search" className="size-6" />,
  <Database key="db" className="size-6" />,
  <GitBranch key="git" className="size-6" />,
  <Sparkles key="sparkles" className="size-6" />,
  <CodeIcon key="code" className="size-6" />,
  <Layers key="layers" className="size-6" />,
];

const integrations = [
  "Claude Code", "Claude Desktop", "Cursor", "Windsurf",
  "Google Antigravity", "VS Code", "Continue.dev",
];

export default function Home() {
  const t = useTranslations();

  const featureItems = [
    ...Array.from({ length: 6 }, (_, i) => i).map((i) => {
      try {
        return {
          icon: featureIcons[i],
          title: t(`features.items.${i}.title`),
          desc: t(`features.items.${i}.desc`),
        };
      } catch {
        return null;
      }
    }).filter(Boolean) as { icon: React.ReactNode; title: string; desc: string }[],
  ];

  const faqItems = [
    ...Array.from({ length: 4 }, (_, i) => i).map((i) => {
      try {
        return {
          q: t(`faq.items.${i}.q`),
          a: t(`faq.items.${i}.a`),
        };
      } catch {
        return null;
      }
    }).filter(Boolean) as { q: string; a: string }[],
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b py-20 sm:py-32">
        <FlickeringGrid
          squareSize={4}
          gridGap={6}
          color="#6366f1"
          maxOpacity={0.08}
          flickerChance={0.04}
          className="absolute inset-0 size-full [mask-image:radial-gradient(ellipse_at_center,white_30%,transparent_70%)]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.03] via-transparent to-white" />
        <div className="container relative mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-6">{t('hero.badge')}</Badge>
          <motion.div
            className="flex flex-col overflow-hidden"
            initial={{ filter: "blur(10px)", opacity: 0, y: 50 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">
              <motion.span
                className="inline-block text-balance"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <AuroraText className="font-bold">{t('hero.title')}</AuroraText>
              </motion.span>
              <br />
              <motion.span
                className="inline-block"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                {t('hero.titleHighlight')}
              </motion.span>
            </h1>
          </motion.div>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 sm:text-xl">
            {t('hero.subtitle')}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <ShimmerButton
              background="#6366f1"
              shimmerColor="#ffffff"
              shimmerSize="0.08em"
              className="px-6 py-2.5 text-sm font-medium"
              onClick={() => document.getElementById('install')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {t('hero.getStarted')} <ArrowRight className="ml-1.5 size-4" />
            </ShimmerButton>
            <a
              href="https://github.com/AndyAnh174/vibe-hnindex"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border-2 border-slate-300 bg-white px-6 text-sm font-medium text-slate-700 transition-all hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              {t('hero.viewOnGithub')}
            </a>
          </div>
          <div className="mx-auto mt-8 max-w-md rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-sm text-emerald-400 shadow-lg">
            <div className="flex items-center gap-2 mb-2 text-slate-500">
              <TerminalIcon className="size-3.5" />
              <span className="text-xs">terminal</span>
            </div>
            <code><span className="text-indigo-300">$</span> npx vibe-hnindex --init</code>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative border-y-2 border-indigo-200 bg-gradient-to-r from-indigo-50/50 via-white to-indigo-50/50 py-10">
        <div className="container mx-auto grid grid-cols-3 gap-8 px-4 text-center">
          {[
            { value: 40, suffix: "+", label: t('stats.languages') },
            { value: 7, suffix: "", label: t('stats.integrations') },
            { value: 16, suffix: "", label: t('stats.tools') },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <div className="flex items-baseline gap-0.5 text-3xl font-bold text-indigo-600 sm:text-4xl">
                <NumberTicker value={stat.value} className="text-indigo-600" />
                {stat.suffix && <span>{stat.suffix}</span>}
              </div>
              <div className="text-sm text-slate-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('features.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">
            {t('features.subtitle')}
          </p>
          <BentoGrid className="mt-12 auto-rows-auto sm:grid-cols-2 lg:grid-cols-3">
            {featureItems.map((f, idx) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md"
              >
                <ShineBorder
                  shineColor={["#6366f1", "#818cf8", "#a5b4fc"]}
                  borderWidth={1}
                  duration={8 + idx * 2}
                />
                <div className="relative z-10">
                  <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
                </div>
              </div>
            ))}
          </BentoGrid>
        </div>
      </section>

      {/* Install */}
      <section id="install" className="relative overflow-hidden border-t bg-white py-20">
        <RetroGrid
          angle={65}
          cellSize={60}
          opacity={0.15}
          lightLineColor="#6366f1"
          darkLineColor="#6366f1"
        />
        <div className="container relative mx-auto px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('install.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">
            {t('install.subtitle')}
          </p>
          <div className="mx-auto mt-12 flex justify-center px-4">
            <Terminal className="w-full max-w-2xl overflow-x-auto">
              <TypingAnimation duration={40}># 1. Pull embedding model</TypingAnimation>
              <TypingAnimation duration={30} delay={300}>ollama pull bge-m3:567m</TypingAnimation>
              <TypingAnimation duration={30} delay={300}>docker run -d -p 6333:6333 qdrant/qdrant</TypingAnimation>
              <TypingAnimation duration={30}> </TypingAnimation>
              <TypingAnimation duration={40}># 2. Add to MCP config</TypingAnimation>
              <TypingAnimation duration={10} delay={200}>{`{`}</TypingAnimation>
              <TypingAnimation duration={15} delay={100}>{`  "mcpServers": {`}</TypingAnimation>
              <TypingAnimation duration={15} delay={100}>{`    "vibe-hnindex": {`}</TypingAnimation>
              <TypingAnimation duration={20} delay={100}>{`      "command": "npx",`}</TypingAnimation>
              <TypingAnimation duration={20} delay={100}>{`      "args": ["-y", "vibe-hnindex"],`}</TypingAnimation>
              <TypingAnimation duration={20} delay={100}>{`      "env": {`}</TypingAnimation>
              <TypingAnimation duration={25} delay={100}>{`        "OLLAMA_URL": "http://localhost:11434",`}</TypingAnimation>
              <TypingAnimation duration={25} delay={100}>{`        "OLLAMA_MODEL": "bge-m3:567m",`}</TypingAnimation>
              <TypingAnimation duration={25} delay={100}>{`        "QDRANT_URL": "http://localhost:6333"`}</TypingAnimation>
              <TypingAnimation duration={15} delay={100}>{`      }`}</TypingAnimation>
              <TypingAnimation duration={15} delay={100}>{`    }`}</TypingAnimation>
              <TypingAnimation duration={15} delay={100}>{`  }`}</TypingAnimation>
              <TypingAnimation duration={10} delay={100}>{`}`}</TypingAnimation>
              <TypingAnimation duration={30}> </TypingAnimation>
              <TypingAnimation duration={40}># 3. Index your codebase</TypingAnimation>
              <TypingAnimation duration={30} delay={200}>index_codebase /path/to/project my-project</TypingAnimation>
              <TypingAnimation duration={30}> </TypingAnimation>
              <TypingAnimation duration={40}># 4. Search!</TypingAnimation>
              <TypingAnimation duration={30} delay={200}>search &quot;how does auth work&quot; my-project</TypingAnimation>
            </Terminal>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('integrations.title')}
          </h2>
          <Marquee className="mt-8" pauseOnHover repeat={2}>
            {integrations.map((item) => (
              <Badge
                key={item}
                variant="secondary"
                className="cursor-default px-5 py-2.5 text-sm font-medium hover:bg-indigo-50 hover:text-indigo-600 transition-colors select-none"
              >
                <Check className="mr-1.5 size-3.5 text-indigo-500" />
                {item}
              </Badge>
            ))}
          </Marquee>
        </div>
      </section>

      {/* Architecture */}
      <section className="border-t bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('architecture.title')}
          </h2>
          <div className="mx-auto mt-12 max-w-4xl">
            <div className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm sm:p-10">
              <ShineBorder
                shineColor={["#6366f1", "#818cf8"]}
                borderWidth={1}
                duration={12}
              />
              <div className="relative z-10 w-full">
                <MermaidDiagram chart={`
graph TB
    subgraph Input["📂 Input"]
        A["💻 Your Codebase<br/>.ts .py .go .rs ..."]
    end

    subgraph Server["⚙️ vibe-hnindex MCP Server"]
        B["🔍 Search Router<br/>keyword | semantic | hybrid"]
        C["🔀 RRF Fusion"]
    end

    subgraph Storage["💾 Storage"]
        D["(SQLite<br/>FTS5 + Keyword)"]
        E["(Qdrant<br/>Vector Embeddings)"]
    end

    subgraph Memory["🧠 Chat Memory (v0.12)"]
        F["(SQLite<br/>Chat Context)"]
        G["(Qdrant<br/>Chat Vectors)"]
    end

    subgraph Infra["🏗️ Infrastructure"]
        H["Ollama<br/>Embeddings"]
        I["Qdrant<br/>localhost:6333"]
    end

    subgraph Output["🤖 AI Clients"]
        J["Claude · Cursor · Windsurf<br/>Antigravity · VS Code"]
    end

    A -->|"index_codebase"| Storage
    A -->|scan| H
    B -->|"keyword"| D
    B -->|"semantic"| E
    B -->|"hybrid"| C
    C --> D
    C --> E
    B -.->|"auto-track"| F
    F --> H
    H --> G
    D --> J
    E --> J
    H -.-> I

    style F fill:#6366f1,color:#fff
    style G fill:#6366f1,color:#fff
    style B fill:#f59e0b,color:#000
    style J fill:#22c55e,color:#fff
`} className="w-full overflow-x-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('faq.title')}
          </h2>
          <div className="mx-auto mt-12 max-w-2xl">
            <Accordion>
              {faqItems.map((item, idx) => (
                <AccordionItem key={`q${idx}`} value={`q${idx}`} className="relative overflow-hidden rounded-xl border border-slate-200 mb-3 bg-white shadow-sm">
                  <BorderBeam
                    size={80}
                    duration={6}
                    delay={idx * 2}
                    colorFrom="#6366f1"
                    colorTo="#a78bfa"
                    borderWidth={1}
                  />
                  <AccordionTrigger className="px-6 py-4 text-left text-slate-900 hover:no-underline">{item.q}</AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 text-slate-600">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative border-t-2 border-indigo-400 bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('cta.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            {t('cta.subtitle')}
          </p>
          <div className="mt-8 flex justify-center">
            <ShimmerButton
              background="#6366f1"
              shimmerColor="#ffffff"
              shimmerSize="0.08em"
              className="px-8 py-3 text-base font-semibold"
              onClick={() => window.open('https://www.npmjs.com/package/vibe-hnindex', '_blank')}
            >
              {t('cta.button')} <ArrowRight className="ml-2 size-5" />
            </ShimmerButton>
          </div>
        </div>
      </section>
    </>
  );
}
