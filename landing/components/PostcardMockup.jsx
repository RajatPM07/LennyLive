'use client';

import { motion } from 'framer-motion';

const animateProps = {
  initial: { opacity: 0, y: 40, x: 40 },
  animate: { opacity: 1, y: 0, x: 0 },
  transition: { type: 'spring', stiffness: 120, damping: 14, delay: 0.8 },
};

const staticProps = {
  initial: { opacity: 1 },
};

const soundBarHeights = [8, 16, 8, 12];
const soundBarDelays = [0, 0.15, 0.3, 0.1];

export default function PostcardMockup({ animate = false }) {
  const motionProps = animate ? animateProps : staticProps;

  return (
    <motion.div
      {...motionProps}
      className="bg-white rounded-card shadow-xl border border-gray-100 p-5 w-80"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-orange animate-pulse shrink-0" />
        <span className="text-xs text-text-muted">Lenny has thoughts</span>
      </div>
      <p className="text-xs text-text-muted mb-3">
        Casey Winters · &ldquo;The Sustainable Growth Playbook&rdquo;
      </p>

      {/* Quote */}
      <p
        className="text-base text-text-primary mb-4 leading-snug"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}
      >
        &ldquo;The best retention strategy isn&apos;t a feature — it&apos;s ensuring your product
        delivers value before the user has time to forget why they signed up.&rdquo;
      </p>

      {/* Actions footer */}
      <div className="flex items-center justify-between">
        {/* Left: replay + waveform */}
        <div className="flex items-center gap-2">
          {/* Replay icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-text-muted"
          >
            <path
              d="M2 8a6 6 0 1 1 1.5 3.97"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M2 12V8h4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Sound wave bars */}
          <div className="flex items-end gap-0.5 h-5">
            {soundBarHeights.map((h, i) => (
              <motion.span
                key={i}
                className="w-1 rounded-sm bg-orange block"
                animate={{ height: [h, h === 16 ? 8 : 16, h] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: soundBarDelays[i],
                  ease: 'easeInOut',
                }}
                style={{ height: h }}
              />
            ))}
          </div>
        </div>

        {/* Right: Save */}
        <button className="text-sm text-orange font-medium hover:text-orange-dark transition-colors">
          ♡ Save
        </button>
      </div>
    </motion.div>
  );
}
