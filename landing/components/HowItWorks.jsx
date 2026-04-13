'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

// Step 1 icon: split-screen with text lines + blinking cursor
function IconWrite() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left pane */}
      <rect x="3" y="8" width="19" height="32" rx="3" stroke="#ff6e40" strokeWidth="1.5" />
      {/* Right pane */}
      <rect x="26" y="8" width="19" height="32" rx="3" stroke="#ff6e40" strokeWidth="1.5" />
      {/* Left pane text lines */}
      <line x1="7" y1="16" x2="18" y2="16" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="21" x2="18" y2="21" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="26" x2="14" y2="26" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" />
      {/* Right pane text lines */}
      <line x1="30" y1="16" x2="41" y2="16" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="30" y1="21" x2="41" y2="21" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="30" y1="26" x2="37" y2="26" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" />
      {/* Blinking cursor on right pane */}
      <motion.line
        x1="30" y1="30" x2="30" y2="37"
        stroke="#ff6e40"
        strokeWidth="2"
        strokeLinecap="round"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: 'steps(1)' }}
      />
    </svg>
  );
}

// Step 2 icon: badge pill with pulsing dot + "Lenny →" text
function IconBadge() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Pill shape */}
      <rect x="4" y="16" width="40" height="16" rx="8" stroke="#ff6e40" strokeWidth="1.5" />
      {/* Pulsing dot */}
      <motion.circle
        cx="13" cy="24" r="3"
        fill="#ff6e40"
        animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* "Lenny →" text placeholder lines */}
      <line x1="20" y1="22" x2="36" y2="22" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="26" x2="30" y2="26" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Step 3 icon: postcard card with text lines + 4 animated sound-wave bars
const barHeights = [10, 18, 10, 14];
const barDelays = [0, 0.15, 0.3, 0.1];

function IconListen() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Card outline */}
      <rect x="4" y="6" width="40" height="30" rx="4" stroke="#ff6e40" strokeWidth="1.5" />
      {/* Text lines inside card */}
      <line x1="9" y1="14" x2="39" y2="14" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="19" x2="39" y2="19" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="24" x2="28" y2="24" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" />
      {/* Animated sound bars at bottom of card (foreignObject workaround: use motion rects) */}
      {barHeights.map((h, i) => (
        <motion.rect
          key={i}
          x={31 + i * 3}
          width="2"
          rx="1"
          fill="#ff6e40"
          animate={{ height: [h, h === 18 ? 8 : 18, h], y: [36 - h, 36 - (h === 18 ? 8 : 18), 36 - h] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: barDelays[i],
            ease: 'easeInOut',
          }}
          style={{ originY: 1 }}
        />
      ))}
      {/* Decorative dot below card */}
      <circle cx="24" cy="41" r="2" fill="#ff6e40" opacity="0.4" />
    </svg>
  );
}

const steps = [
  {
    number: 1,
    title: 'Read or write — just work',
    description:
      'Work in Notion, Google Docs, Linear, or Jira. Lenny senses PM moments whether you\'re drafting a PRD or reviewing a strategy doc.',
    Icon: IconWrite,
  },
  {
    number: 2,
    title: 'Lenny appears',
    description:
      'When you hit retention, prioritization, GTM, or any PM concept — a gentle nudge appears. Double-tap Ctrl anytime to ask directly.',
    Icon: IconBadge,
  },
  {
    number: 3,
    title: 'Listen & learn',
    description:
      'Hear real stories from 300+ product leaders. One insight, one voice, exactly when your brain is in the problem.',
    Icon: IconListen,
  },
];

export default function HowItWorks() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });

  return (
    <section ref={sectionRef} className="py-24 px-6 bg-cream">
      <h2 className="font-serif text-3xl sm:text-4xl font-bold text-center mb-16 text-text-primary">
        How it works
      </h2>

      {/* Steps grid with relative wrapper for connector line */}
      <div className="max-w-5xl mx-auto relative">
        {/* Connector line — desktop only */}
        <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-px overflow-hidden pointer-events-none">
          <motion.div
            className="h-full w-full"
            style={{
              background:
                'repeating-linear-gradient(to right, #ff6e40 0px, #ff6e40 6px, transparent 6px, transparent 14px)',
              transformOrigin: 'left',
              scaleX: isInView ? 1 : 0,
            }}
            animate={{ scaleX: isInView ? 1 : 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {steps.map(({ number, title, description, Icon }, i) => (
            <motion.div
              key={number}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.2, ease: 'easeOut' }}
              className="flex flex-col items-center text-center"
            >
              {/* Step number circle */}
              <div className="w-12 h-12 rounded-full border-2 border-orange flex items-center justify-center mb-4 bg-cream relative z-10">
                <span className="font-serif text-xl font-bold text-orange">{number}</span>
              </div>

              {/* Animated icon */}
              <div className="mb-5">
                <Icon />
              </div>

              <h3 className="font-serif text-xl font-bold text-text-primary mb-2">{title}</h3>
              <p className="text-text-muted text-base max-w-xs mx-auto leading-relaxed">
                {description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
