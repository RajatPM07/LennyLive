'use client';

import { useRef, useState, useEffect } from 'react';
import { useInView } from 'framer-motion';

/**
 * Reusable looping state-machine demo.
 *
 * @param {Array<{delay: number, phase: number}>} phases — phase timings
 * @param {number} loopDelay — ms before loop restarts after last phase
 * @param {(phase: number) => React.ReactNode} children — render function receiving current phase
 */
export default function AnimatedDemo({ phases, loopDelay = 7000, pauseDelay = 1000, children }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false });
  const [phase, setPhase] = useState(0);
  const timeoutIds = useRef([]);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clearAll = () => {
    timeoutIds.current.forEach((id) => clearTimeout(id));
    timeoutIds.current = [];
  };

  const startLoop = () => {
    clearAll();

    phases.forEach(({ delay, phase: p }) => {
      const id = setTimeout(() => setPhase(p), delay);
      timeoutIds.current.push(id);
    });

    const resetId = setTimeout(() => {
      setPhase(0);
      const restartId = setTimeout(startLoop, pauseDelay);
      timeoutIds.current.push(restartId);
    }, loopDelay);
    timeoutIds.current.push(resetId);
  };

  useEffect(() => {
    if (prefersReducedMotion) {
      const maxPhase = Math.max(...phases.map((p) => p.phase));
      setPhase(maxPhase);
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

  return <div ref={ref}>{children(phase)}</div>;
}
