'use client';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import FloatingPills from './FloatingPills';
import CountUp from './CountUp';

const stats = [
  { target: 300, suffix: '+', label: 'Episodes indexed' },
  { target: 280, suffix: '+', label: 'Curated PM moments' },
  { target: 50, suffix: '+', label: 'Product leaders featured' },
];

export default function SocialProof() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <section className="py-24 px-6 bg-proof">
      <div ref={ref} className="max-w-5xl mx-auto">
        {/* Headline */}
        <motion.h2
          className="font-serif text-3xl sm:text-4xl font-bold text-center mb-8"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          Wisdom from the best in product
        </motion.h2>

        {/* Anchor quote */}
        <motion.blockquote
          className="max-w-2xl mx-auto text-center mb-12"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <p className="font-serif italic text-xl sm:text-2xl leading-relaxed mb-3">
            "Product sense isn't magic — it's pattern recognition from seeing thousands of product decisions play out. The best PMs are the ones who've borrowed the most experience."
          </p>
          <cite className="text-text-muted text-sm not-italic">— Shreyas Doshi</cite>
        </motion.blockquote>

        {/* Floating guest pills */}
        <FloatingPills />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-12">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-serif text-4xl sm:text-5xl font-bold text-orange">
                <CountUp target={stat.target} suffix={stat.suffix} />
              </div>
              <div className="text-text-muted text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
