'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

export default function CountUp({ target, suffix = '', duration = 1.5 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setCount(target);
      return;
    }

    const fps = 60;
    const totalFrames = Math.round(duration * fps);
    let frame = 0;

    const interval = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      setCount(Math.round(progress * target));
      if (frame >= totalFrames) {
        clearInterval(interval);
        setCount(target);
      }
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [inView, target, duration]);

  return (
    <span ref={ref}>{count}{suffix}</span>
  );
}
