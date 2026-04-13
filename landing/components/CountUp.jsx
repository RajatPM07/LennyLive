'use client';

import { useEffect, useRef, useState } from 'react';

export default function CountUp({ target, suffix = '', duration = 1.5 }) {
  const ref = useRef(null);
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;

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
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref}>{count}{suffix}</span>
  );
}
