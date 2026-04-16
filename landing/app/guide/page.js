'use client';

import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import BrowserMockup from '@/components/BrowserMockup';
import AnimatedDemo from '@/components/AnimatedDemo';
import Footer from '@/components/Footer';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  GuideSection — alternating layout wrapper                         */
/* ------------------------------------------------------------------ */
function GuideSection({ eyebrow, title, description, children, reverse = false }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5 }}
      className="py-16 px-6"
    >
      <div className={`max-w-5xl mx-auto flex flex-col gap-10 items-center ${
        reverse ? 'md:flex-row-reverse' : 'md:flex-row'
      }`}>
        <div className="flex-1 w-full max-w-lg">{children}</div>
        <div className="flex-1 max-w-md">
          <span className="text-xs uppercase tracking-[0.14em] text-orange-dark font-semibold mb-2 block">{eyebrow}</span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-3">{title}</h2>
          <p className="text-text-muted leading-relaxed">{description}</p>
        </div>
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini Postcard — reused in selection-dot and write+pause demos     */
/* ------------------------------------------------------------------ */
function MiniPostcard({ guest, insight, topic }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="absolute bottom-4 right-4 left-4 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-10"
    >
      <span className="text-[10px] uppercase tracking-wider text-orange-dark font-semibold">{topic}</span>
      <p className="text-xs text-text-primary leading-relaxed mt-1 line-clamp-2">{insight}</p>
      <p className="text-[10px] text-text-muted mt-2">— {guest}</p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  A. Selection Dot Demo                                             */
/* ------------------------------------------------------------------ */
function SelectionDotDemo() {
  return (
    <GuideSection
      eyebrow="Highlight & discover"
      title="The selection dot"
      description="Highlight any PM-related text on the web — a retention strategy, a pricing model, a growth experiment. An orange dot appears. Click it, and Lenny delivers an insight from a real podcast episode."
    >
      <AnimatedDemo
        phases={[
          { delay: 0, phase: 0 },
          { delay: 800, phase: 1 },
          { delay: 2000, phase: 2 },
          { delay: 3500, phase: 3 },
        ]}
        loopDelay={6000}
      >
        {(phase) => (
          <BrowserMockup url="notion.so/Retention-Strategy">
            <div className="p-6 min-h-[200px] relative">
              <p className="text-sm leading-relaxed text-text-primary">
                Our current 30-day retention sits at 34%. We need to{' '}
                <span
                  className={`transition-colors duration-500 ${
                    phase >= 1 ? 'bg-orange-200/40 rounded px-0.5' : ''
                  }`}
                >
                  identify the activation moment that drives long-term engagement
                  and build a systematic onboarding flow around it
                </span>
                . The team should also explore cohort analysis to segment by acquisition channel.
              </p>

              {/* Orange selection dot */}
              <AnimatePresence>
                {phase >= 2 && phase < 3 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="absolute bottom-16 right-6 w-5 h-5 bg-orange rounded-full shadow-lg cursor-pointer"
                  />
                )}
              </AnimatePresence>

              {/* Mini postcard */}
              <AnimatePresence>
                {phase >= 3 && (
                  <MiniPostcard
                    topic="Retention"
                    insight="The single biggest predictor of long-term retention is whether users hit the 'aha moment' in their first session."
                    guest="Casey Winters, Eventbrite"
                  />
                )}
              </AnimatePresence>
            </div>
          </BrowserMockup>
        )}
      </AnimatedDemo>
    </GuideSection>
  );
}

/* ------------------------------------------------------------------ */
/*  B. Write + Pause Demo                                             */
/* ------------------------------------------------------------------ */
const TYPING_LINES = [
  'Problem: Users drop off after signup.',
  'Hypothesis: Adding a checklist improves activation by 20%.',
  'Key metric: 7-day retention rate.',
];

function WritePauseDemo() {
  return (
    <GuideSection
      reverse
      eyebrow="Write & receive"
      title="The write-and-pause badge"
      description="Start writing a PRD, a strategy doc, or even a Slack message. Pause for a moment, and Lenny surfaces a relevant insight — no prompting needed."
    >
      <AnimatedDemo
        phases={[
          { delay: 0, phase: 0 },
          { delay: 500, phase: 1 },
          { delay: 2500, phase: 2 },
          { delay: 4500, phase: 3 },
        ]}
        loopDelay={7000}
      >
        {(phase) => (
          <BrowserMockup url="docs.google.com/PRD-Draft">
            <div className="p-6 min-h-[220px] relative">
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                {TYPING_LINES.map((line, i) => {
                  const visible = phase >= 1 && i <= (phase >= 2 ? 2 : phase >= 1 ? 1 : 0);
                  return (
                    <p
                      key={i}
                      className={`text-sm text-text-primary leading-relaxed transition-opacity duration-300 ${
                        visible ? 'opacity-100' : 'opacity-0'
                      } ${i > 0 ? 'mt-1' : ''}`}
                    >
                      {line}
                    </p>
                  );
                })}

                {/* Blinking cursor */}
                {phase === 1 && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-0.5 h-4 bg-text-primary ml-0.5 mt-1 align-middle"
                  />
                )}
              </div>

              {/* Badge pill */}
              <AnimatePresence>
                {phase >= 2 && phase < 3 && (
                  <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="mt-3 inline-flex items-center gap-2 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-md"
                  >
                    <motion.span
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-2 h-2 bg-orange rounded-full inline-block"
                    />
                    Lenny has thoughts →
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mini postcard */}
              <AnimatePresence>
                {phase >= 3 && (
                  <MiniPostcard
                    topic="Activation"
                    insight="The best onboarding isn't a product tour — it's getting people to do the thing that makes them stay."
                    guest="Lauryn Isford, Airtable"
                  />
                )}
              </AnimatePresence>
            </div>
          </BrowserMockup>
        )}
      </AnimatedDemo>
    </GuideSection>
  );
}

/* ------------------------------------------------------------------ */
/*  C. Double-tap Ctrl                                                */
/* ------------------------------------------------------------------ */
function DoubleTapCtrlDemo() {
  return (
    <GuideSection
      eyebrow="Anytime shortcut"
      title="Double-tap Ctrl"
      description="No text selected? No problem. Double-tap Ctrl anywhere on the web and Lenny will listen via your microphone, then find a matching insight."
    >
      <div className="flex flex-col items-center justify-center bg-white rounded-xl shadow-lg border border-gray-100 p-10">
        <div className="flex items-center gap-3 mb-6">
          <motion.kbd
            animate={{ scale: [1, 0.92, 1, 0.92, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
            className="inline-flex items-center justify-center w-16 h-14 bg-gray-100 border-2 border-gray-300 rounded-lg text-lg font-mono font-bold text-text-primary shadow-sm"
          >
            Ctrl
          </motion.kbd>
          <span className="text-text-muted text-sm font-semibold">×2</span>
        </div>
        <p className="text-sm text-text-muted text-center">
          Tap twice within 300ms — works on any page.
        </p>
      </div>
    </GuideSection>
  );
}

/* ------------------------------------------------------------------ */
/*  D. Gamification                                                   */
/* ------------------------------------------------------------------ */
const LEVELS = ['Intern', 'APM', 'PM', 'Senior PM', 'Staff PM', 'Group PM'];
const FILLED_COUNT = 3; // first 3 filled (Intern, APM, PM)

const XP_ROWS = [
  { label: 'Insight delivered', xp: '+5 XP', icon: '📬' },
  { label: 'Insight saved', xp: '+15 XP', icon: '💾' },
  { label: 'Streak bonus (day 3)', xp: '+6 XP', icon: '🔥' },
];

function GamificationSection() {
  return (
    <GuideSection
      reverse
      eyebrow="Level up"
      title="Save, streak, grow"
      description="Every insight you engage with earns XP. Save the best ones, build daily streaks, and progress from PM Intern all the way to Group PM."
    >
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        {/* Current level badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 bg-orange/10 text-orange font-bold text-xs rounded-full">
              PM
            </span>
            <span className="font-serif font-bold text-sm">Product Manager</span>
          </div>
          <span className="text-xs text-text-muted">165 / 350 XP to Senior PM</span>
        </div>

        {/* Level progression bar */}
        <div className="flex gap-1 mb-6">
          {LEVELS.map((level, i) => (
            <div key={level} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full h-2 rounded-full ${
                  i < FILLED_COUNT ? 'bg-orange' : 'bg-gray-200'
                }`}
              />
              <span className={`text-[9px] leading-tight text-center ${
                i < FILLED_COUNT ? 'text-orange-dark font-semibold' : 'text-text-muted'
              }`}>
                {level}
              </span>
            </div>
          ))}
        </div>

        {/* XP breakdown */}
        <div className="space-y-2">
          {XP_ROWS.map((row) => (
            <div key={row.label} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm" aria-hidden="true">{row.icon}</span>
                <span className="text-xs text-text-primary">{row.label}</span>
              </div>
              <span className="text-xs font-semibold text-orange-dark">{row.xp}</span>
            </div>
          ))}
        </div>
      </div>
    </GuideSection>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default function GuidePage() {
  return (
    <main>
      <PageHeader
        eyebrow="Getting started"
        headline="How Lenny Live works"
        subtitle="Three ways to surface insights — all ambient, all contextual, zero prompting required."
      />

      {/* A — Selection Dot */}
      <SelectionDotDemo />
      <div className="border-t border-gray-100 max-w-4xl mx-auto" />

      {/* B — Write + Pause */}
      <WritePauseDemo />
      <div className="border-t border-gray-100 max-w-4xl mx-auto" />

      {/* C — Double-tap Ctrl */}
      <DoubleTapCtrlDemo />
      <div className="border-t border-gray-100 max-w-4xl mx-auto" />

      {/* D — Gamification */}
      <GamificationSection />

      {/* E — Bottom CTA */}
      <section className="bg-proof py-20 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-serif text-3xl sm:text-4xl font-bold mb-6">
            Ready to borrow some intuition?
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/download"
              className="inline-flex items-center gap-2 bg-orange hover:bg-orange-dark text-white font-semibold px-8 py-3 rounded-pill shadow-md transition-colors"
            >
              Download Lenny Live
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
            <Link
              href="/"
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Back to home
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />
    </main>
  );
}
