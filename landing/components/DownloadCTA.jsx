'use client';

import { motion } from 'framer-motion';
import DownloadButton from './DownloadButton';

/**
 * Orange full-width CTA section — replaces WaitlistCTA on the home page.
 */
export default function DownloadCTA() {
  return (
    <section className="py-24 px-6 bg-orange">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-2xl mx-auto text-center"
      >
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-3">
          Start borrowing Lenny&apos;s intuition
        </h2>

        <p className="text-white/80 text-lg mb-8">
          Free forever. Install in under a minute.
        </p>

        <DownloadButton variant="inverted" />

        <p className="text-white/60 text-sm mt-6">
          No account needed. No data collected. Just PM wisdom.
        </p>
      </motion.div>
    </section>
  );
}
