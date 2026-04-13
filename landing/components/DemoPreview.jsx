'use client';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

const soundBarHeights = [8, 16, 8, 12];
const soundBarDelays = [0, 0.15, 0.3, 0.1];

// Animation phase timing (ms)
// 0: idle → 1: badge → 2: postcard → 3: saved → 4: dismiss → 0: idle
const PHASE_TIMINGS = [
  { delay: 0,    phase: 1 },
  { delay: 1200, phase: 2 },
  { delay: 4000, phase: 3 },
  { delay: 5500, phase: 4 },
];
const LOOP_RESET_DELAY = 6500; // set to 0 first
const LOOP_PAUSE_DELAY = 1000; // pause before restarting

export default function DemoPreview() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false });
  const [phase, setPhase] = useState(0);
  const timeoutIdsRef = useRef([]);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Clear all pending timeouts
  const clearAll = () => {
    timeoutIdsRef.current.forEach((id) => clearTimeout(id));
    timeoutIdsRef.current = [];
  };

  const startLoop = () => {
    clearAll();

    // Schedule each phase transition
    PHASE_TIMINGS.forEach(({ delay, phase: p }) => {
      const id = setTimeout(() => setPhase(p), delay);
      timeoutIdsRef.current.push(id);
    });

    // Reset and restart after loop completes
    const resetId = setTimeout(() => {
      setPhase(0);
      const restartId = setTimeout(startLoop, LOOP_PAUSE_DELAY);
      timeoutIdsRef.current.push(restartId);
    }, LOOP_RESET_DELAY);
    timeoutIdsRef.current.push(resetId);
  };

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase(2);
      return;
    }

    if (isInView) {
      startLoop();
    } else {
      clearAll();
      setPhase(0);
    }

    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView, prefersReducedMotion]);

  const showBadge = phase >= 1 && phase <= 3;
  const showPostcard = phase >= 2 && phase <= 3;
  const isSaved = phase === 3;

  return (
    <section ref={sectionRef} className="py-24 px-6 bg-cream">
      <h2 className="font-serif text-3xl sm:text-4xl font-bold text-center mb-12 text-text-primary">
        See it in action
      </h2>

      {/* Browser window mockup */}
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-3xl mx-auto">

        {/* Browser chrome bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          {/* Traffic lights */}
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="w-3 h-3 rounded-full bg-green-400" />

          {/* URL bar */}
          <div className="ml-2 flex-1 max-w-xs">
            <div className="bg-white rounded-md px-3 py-1 text-xs text-text-muted border border-gray-200">
              notion.so/Retention-Strategy-Draft
            </div>
          </div>
        </div>

        {/* Page content area */}
        <div className="relative p-8 min-h-[360px]">
          {/* Real PM document text */}
          <h3 className="text-xl font-bold text-text-primary mb-4">
            Improving Day-30 Retention
          </h3>
          <p className="text-sm text-text-muted mb-3 leading-relaxed">
            Our current D30 retention sits at 18%, well below the 25% benchmark for B2B SaaS.
            The biggest drop-off happens between Day 3 and Day 7...
          </p>
          <p className="text-sm text-text-muted mb-3 leading-relaxed">
            Hypothesis: users who connect at least one integration in the first session retain
            at 2.3x the rate...
          </p>
          <p className="text-sm text-text-muted leading-relaxed">
            Next step: run a cohort analysis comparing users who completed integration setup...
          </p>

          {/* Badge pill — phases 1-3 */}
          <AnimatePresence>
            {showBadge && (
              <motion.div
                key="badge"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.25 }}
                className="absolute bottom-4 right-4 flex items-center gap-2 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg select-none"
              >
                <span className="w-2 h-2 rounded-full bg-orange animate-pulse shrink-0" />
                Lenny has thoughts →
              </motion.div>
            )}
          </AnimatePresence>

          {/* Postcard — phases 2-3 */}
          <AnimatePresence>
            {showPostcard && (
              <motion.div
                key="postcard"
                initial={{ opacity: 0, y: 40, x: 20 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, y: 20, x: 10 }}
                transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                className="absolute bottom-16 right-4 w-[280px] bg-white rounded-xl shadow-xl border border-gray-100 p-4"
              >
                {/* Guest line */}
                <p className="text-xs text-text-muted mb-2">
                  Casey Winters · &ldquo;The Sustainable Growth Playbook&rdquo;
                </p>

                {/* Quote */}
                <p
                  className="text-sm text-text-primary mb-4 leading-snug"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}
                >
                  &ldquo;The best retention strategy isn&apos;t a feature — it&apos;s ensuring
                  your product delivers value before the user has time to forget why they signed
                  up.&rdquo;
                </p>

                {/* Footer: waveform + save */}
                <div className="flex items-center justify-between">
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

                  {/* Save button */}
                  <motion.button
                    animate={isSaved ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 0.3 }}
                    className={`text-xs font-medium transition-colors ${
                      isSaved ? 'text-green-600' : 'text-orange'
                    }`}
                  >
                    {isSaved ? '✓ Saved!' : '♡ Save'}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
