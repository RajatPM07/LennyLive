'use client';

import { motion } from 'framer-motion';

/**
 * Numbered step with illustration and instruction text.
 * Alternates layout on desktop (even steps flip illustration/text sides).
 */
export default function StepCard({ number, title, description, illustration, tip }) {
  const isEven = number % 2 === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="py-12"
    >
      <div className={`max-w-5xl mx-auto flex flex-col gap-8 items-center ${
        isEven ? 'md:flex-row-reverse' : 'md:flex-row'
      }`}>
        {/* Illustration */}
        <div className="flex-1 w-full max-w-lg">
          {illustration}
        </div>

        {/* Text */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-full bg-orange text-white flex items-center justify-center font-serif font-bold text-lg">
              {number}
            </span>
            <h3 className="font-serif text-2xl font-bold text-text-primary">{title}</h3>
          </div>

          <p className="text-text-muted leading-relaxed text-base mb-3">{description}</p>

          {tip && (
            <div className="flex items-start gap-2 px-4 py-3 bg-step-bg rounded-lg border border-orange/10">
              <span className="text-orange text-sm mt-0.5" aria-hidden="true">💡</span>
              <p className="text-sm text-text-muted leading-relaxed">{tip}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
