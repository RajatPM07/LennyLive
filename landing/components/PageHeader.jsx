'use client';

import { motion } from 'framer-motion';

/**
 * Reusable page hero with eyebrow label, headline, and optional subtitle.
 */
export default function PageHeader({ eyebrow, headline, subtitle }) {
  return (
    <header className="pt-32 pb-16 px-6 bg-cream text-center">
      <div className="max-w-3xl mx-auto">
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-xs uppercase tracking-[0.14em] text-orange-dark font-semibold mb-4"
        >
          {eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-4"
        >
          {headline}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="text-lg sm:text-xl text-text-muted max-w-2xl mx-auto"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </header>
  );
}
