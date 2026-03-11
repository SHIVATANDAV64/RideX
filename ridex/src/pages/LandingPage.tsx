// src/pages/LandingPage.tsx
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Bike,
  CarFront,
  Clock3,
  Route,
  Shield,
  ShieldCheck,
  Sparkles,
  Split,
  Ticket,
  Users,
  Waypoints,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { APPWRITE_CONFIGURED, MISSING_APPWRITE_ENV } from '../lib/env';

const signalRows = [
  { label: 'Dispatch cadence', value: '03:24', note: 'median pickup window across dense corridors' },
  { label: 'Trust layer', value: '97/100', note: 'verification, visibility, and escalation readiness' },
  { label: 'Fare posture', value: 'LOCKED', note: 'riders understand cost before they commit' },
  { label: 'Ops uptime', value: '24/7', note: 'support and safety cues stay within immediate reach' },
];

const designAxes = [
  {
    index: '01',
    title: 'Decision load must collapse, not accumulate.',
    desc: 'Top-tier agency work removes hesitation. For RideX, that means every public-screen element must either sharpen intent, prove trust, or orient motion.',
  },
  {
    index: '02',
    title: 'Atmosphere needs a governing motif.',
    desc: 'The motif here is the city as a signal network: routes, cadence, checkpoints, and status. It governs layout rhythm, typography, and motion.',
  },
  {
    index: '03',
    title: 'Premium does not mean ornamental.',
    desc: 'The expensive feeling comes from restraint, pacing, and confidence in composition, not from stacking gradients, blobs, and generic UI trophies.',
  },
];

const rails = [
  {
    icon: Clock3,
    label: 'Speed with orientation',
    text: 'Users should instantly understand what is happening now, what happens next, and how long it will take.',
  },
  {
    icon: ShieldCheck,
    label: 'Trust with evidence',
    text: 'Safety language must appear as operational proof points, not soft reassurance copied from every mobility app.',
  },
  {
    icon: Ticket,
    label: 'Support without clutter',
    text: 'Emergency and support surfaces stay reachable, but they do not visually contaminate the main booking rhythm.',
  },
];

const fleet = [
  { icon: Bike, name: 'Bike', note: 'last-mile urgency, dense-lane movement', price: '₹30+' },
  { icon: CarFront, name: 'Auto', note: 'casual city hops, balanced economics', price: '₹60+' },
  { icon: CarFront, name: 'Mini', note: 'standard daily transport with low friction', price: '₹100+' },
  { icon: CarFront, name: 'Sedan', note: 'business movement, longer transfers, calmer cabin', price: '₹140+' },
  { icon: Sparkles, name: 'Prime', note: 'premium comfort with elevated service cues', price: '₹200+' },
];

const backstage = [
  {
    title: 'Narrative before decoration',
    desc: 'The public landing page should explain how RideX thinks about movement before it starts selling interfaces. That is how premium studios turn websites into brand arguments.',
  },
  {
    title: 'Backstage, not black box',
    desc: 'The strongest case-study-inspired pattern is transparency: show the operational logic, the system layers, and the design rationale instead of hiding them behind vague marketing copy.',
  },
  {
    title: 'Modular, but never templated',
    desc: 'Great agency work uses systems under the hood and uniqueness in front. Reusable structure is fine. Repeated visual formulas are not.',
  },
];

export default function LandingPage() {
  const nav = useNavigate();

  return (
    <div className="landing-shell min-h-dvh overflow-x-hidden">
      <div className="landing-noise" />
      <div className="landing-orbit landing-orbit-a" />
      <div className="landing-orbit landing-orbit-b" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="landing-mark">RX</div>
          <div>
            <p className="landing-kicker">RideX mobility signal system</p>
            <p className="text-sm font-medium text-[var(--landing-ink-soft)]">A public-facing operating language for urban motion.</p>
          </div>
        </div>

        <div className="hidden items-center gap-8 lg:flex">
          {['Manifesto', 'Method', 'Fleet'].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-medium text-[var(--landing-ink-soft)] transition-colors hover:text-[var(--landing-ink)]">
              {item}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="border border-[var(--landing-line)] bg-white/70 text-[var(--landing-ink)] hover:bg-white"
            onClick={() => nav('/login')}
          >
            Sign in
          </Button>
          <Button
            size="sm"
            className="bg-[var(--landing-accent)] text-[var(--landing-accent-ink)] shadow-[0_16px_40px_rgba(209,92,49,0.24)] hover:bg-[var(--landing-accent-strong)]"
            onClick={() => nav('/login?tab=register')}
          >
            Start riding
          </Button>
        </div>
      </header>

      <main>
        {!APPWRITE_CONFIGURED && (
          <section className="mx-auto max-w-7xl px-5 pb-2 sm:px-6 lg:px-8">
            <div className="rounded-[1.4rem] border border-amber-300/50 bg-amber-100/70 px-4 py-4 text-sm leading-6 text-amber-950 backdrop-blur-sm sm:px-5">
              <strong className="font-semibold">Frontend preview mode.</strong> Appwrite is not configured yet, so auth and booking flows are disabled.
              {' '}Missing: {MISSING_APPWRITE_ENV.join(', ')}.
            </div>
          </section>
        )}

        <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-end lg:px-8 lg:pb-24 lg:pt-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="space-y-8"
          >
            <div className="landing-tag w-fit">
              <span className="h-2 w-2 rounded-full bg-[var(--landing-accent)]" />
              Built mobile-first. Composed like a studio case study.
            </div>

            <div className="space-y-5">
              <p className="landing-kicker">Art direction thesis / urban certainty</p>
              <h1 className="landing-display max-w-[9ch] text-[3.55rem] leading-[0.88] tracking-[-0.07em] text-[var(--landing-ink)] sm:text-[5.3rem] lg:text-[7.4rem]">
                Move with certainty, not interface noise.
              </h1>
              <p className="max-w-[35rem] text-base leading-7 text-[var(--landing-ink-soft)] sm:text-lg">
                The new direction treats RideX less like an app launch and more like a premium mobility system. Massive type establishes authority, the city-grid motif creates coherence, and every supporting element exists to reduce hesitation under time pressure.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                icon={<ArrowRight size={18} />}
                className="bg-[var(--landing-ink)] text-[var(--landing-canvas)] shadow-[0_18px_48px_rgba(20,18,16,0.18)] hover:bg-[var(--landing-ink)]/92"
                onClick={() => nav('/login?tab=register')}
              >
                Book your first ride
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="border border-[var(--landing-line)] bg-transparent text-[var(--landing-ink)] hover:bg-white/70"
                onClick={() => nav('/login?tab=driver')}
              >
                Drive with RideX
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Split, label: 'One dominant motif' },
                { icon: Shield, label: 'Trust as evidence' },
                { icon: Waypoints, label: 'Motion-led hierarchy' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="landing-mini-panel">
                  <Icon size={18} className="text-[var(--landing-accent)]" />
                  <span className="text-sm font-medium text-[var(--landing-ink)]">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.7, ease: 'easeOut' }}
            className="landing-board landing-board-strong"
          >
            <div className="landing-board-glow" />

            <div className="flex items-center justify-between gap-3 border-b border-[var(--landing-line)] px-5 py-4 sm:px-6">
              <div>
                <p className="landing-kicker">Signal board / Bangalore east sector</p>
                <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--landing-ink)]">Public system posture</h2>
              </div>
              <div className="landing-status-chip">
                <BadgeCheck size={14} />
                Operational
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:px-6 sm:pb-6 lg:grid-cols-[1.06fr_0.94fr]">
              <div className="landing-route-stage landing-route-stage-strong">
                <div className="landing-stage-label">Urban certainty model</div>
                <div className="landing-map-grid" />
                <div className="landing-route-strip strip-a" />
                <div className="landing-route-strip strip-b" />
                <div className="landing-route-strip strip-c" />
                <div className="landing-stage-quote">
                  <span className="landing-kicker">Core idea</span>
                  <p>Speed earns attention. Legibility earns trust.</p>
                </div>
                <div className="landing-stage-rail">
                  <span>pickup</span>
                  <span>verification</span>
                  <span>fare</span>
                  <span>support</span>
                </div>
              </div>

              <div className="landing-signal-table">
                {signalRows.map((row, index) => (
                  <div key={row.label} className={`landing-signal-row ${index === 0 ? 'first:border-t-0' : ''}`}>
                    <div>
                      <p className="landing-kicker">{row.label}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--landing-ink-soft)]">{row.note}</p>
                    </div>
                    <div className="text-right">
                      <p className="landing-signal-value">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <section id="manifesto" className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:py-24">
          <div className="space-y-4">
            <p className="landing-kicker">Manifesto / why this should feel expensive</p>
            <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-[var(--landing-ink)] sm:text-5xl lg:text-6xl">
              Premium web design is a matter of conviction.
            </h2>
            <p className="max-w-[34rem] text-base leading-7 text-[var(--landing-ink-soft)]">
              The strongest studio work starts from a disciplined idea and lets every formal choice obey it. For RideX, the idea is simple: the interface must behave like a clean transport signal, not a marketing collage.
            </p>
          </div>

          <div className="space-y-5">
            {designAxes.map(({ index, title, desc }) => (
              <motion.article
                key={index}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                viewport={{ once: true, amount: 0.3 }}
                className="landing-axis"
              >
                <div className="landing-axis-index">{index}</div>
                <div>
                  <h3 className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--landing-ink)] sm:text-[2rem]">{title}</h3>
                  <p className="mt-3 max-w-[42rem] text-sm leading-6 text-[var(--landing-ink-soft)] sm:text-base">{desc}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="space-y-4 border-y border-[var(--landing-line)] py-6">
            {rails.map(({ icon: Icon, label, text }) => (
              <div key={label} className="landing-rail-row">
                <div className="landing-rail-title">
                  <Icon size={18} className="text-[var(--landing-accent)]" />
                  <span>{label}</span>
                </div>
                <p className="text-sm leading-6 text-[var(--landing-ink-soft)] sm:text-base">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="method" className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="landing-method-grid">
            <div className="landing-method-lead">
              <p className="landing-kicker">Method / inspired by case-study thinking</p>
              <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-[var(--landing-ink)] sm:text-5xl lg:text-6xl">
                Backstage matters as much as surface.
              </h2>
              <p className="max-w-[34rem] text-base leading-7 text-[var(--landing-ink-soft)]">
                Verified agency sources repeat the same point: show the rationale, show the technical discipline, show the content structure. That is how expensive work proves it is not bluffing.
              </p>
            </div>

            <div className="space-y-4">
              {backstage.map((item, index) => (
                <div key={item.title} className="landing-process-step">
                  <div className="landing-process-index">0{index + 1}</div>
                  <div>
                    <h3 className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--landing-ink)]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--landing-ink-soft)] sm:text-base">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="fleet" className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="landing-kicker">Fleet spectrum</p>
              <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-[var(--landing-ink)] sm:text-5xl lg:text-6xl">
                Five movement bands, one coherent signal language.
              </h2>
            </div>
            <p className="max-w-[28rem] text-sm leading-6 text-[var(--landing-ink-soft)]">
              The fleet should read like a spectrum of movement choices, not a row of commerce cards. Each tier gets a role, a mood, and a clear price posture.
            </p>
          </div>

          <div className="landing-spectrum">
            {fleet.map(({ icon: Icon, name, note, price }, index) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
                viewport={{ once: true, amount: 0.25 }}
                className="landing-spectrum-item"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="landing-icon-wrap">
                    <Icon size={20} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--landing-ink-soft)]">{price}</span>
                </div>
                <div className="mt-10 border-t border-[var(--landing-line)] pt-4">
                  <p className="landing-kicker">Mode {index + 1}</p>
                  <h3 className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] text-[var(--landing-ink)]">{name}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--landing-ink-soft)]">{note}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="landing-closing-statement">
            <div className="landing-closing-number">RX</div>
            <div className="space-y-4">
              <p className="landing-kicker">Closing statement</p>
              <p className="font-display text-3xl font-semibold leading-[1.02] tracking-[-0.05em] text-[var(--landing-ink)] sm:text-5xl lg:max-w-[12ch] lg:text-6xl">
                Premium mobility design should feel authored, not assembled.
              </p>
              <p className="max-w-[40rem] text-base leading-7 text-[var(--landing-ink-soft)]">
                That is the bar for the next phase of RideX. Not prettier widgets. A clearer worldview, stronger typographic confidence, and a system that feels intentional from the first scroll.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-5 pb-8 sm:px-6 lg:px-8">
        <div className="landing-final-panel">
          <div className="max-w-[38rem] space-y-4">
            <p className="landing-kicker">Ready to enter the system</p>
            <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-[var(--landing-canvas)] sm:text-5xl">
              Agency-level art direction. Street-level usability.
            </h2>
            <p className="text-base leading-7 text-[var(--landing-canvas-soft)]">
              RideX now has a stronger public visual thesis. The next step is carrying this authored language into login, booking, active ride, and support surfaces so the whole product stops feeling split.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              icon={<ArrowRight size={18} />}
              className="bg-[var(--landing-accent)] text-[var(--landing-accent-ink)] hover:bg-[var(--landing-accent-strong)]"
              onClick={() => nav('/login?tab=register')}
            >
              Launch the rider flow
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="border border-white/18 bg-transparent text-[var(--landing-canvas)] hover:bg-white/8"
              onClick={() => nav('/login?tab=driver')}
            >
              Open driver mode
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--landing-line)] py-6 text-sm text-[var(--landing-ink-soft)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} RideX Technologies Pvt. Ltd. · Bengaluru, India</p>
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-2"><Users size={15} /> Rider, driver, and support surfaces</span>
            <span className="inline-flex items-center gap-2"><Route size={15} /> Built for mobile first, refined for laptop</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
