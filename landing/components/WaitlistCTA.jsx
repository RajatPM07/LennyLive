'use client';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import WaitlistForm from './WaitlistForm';

export default function WaitlistCTA() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch('/api/waitlist/count')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.count > 0) setCount(data.count);
      })
      .catch(() => {});
  }, []);

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
          Be the first to borrow Lenny&apos;s intuition
        </h2>

        {count > 0 && (
          <p className="text-white/90 text-lg mb-2">
            Join {count.toLocaleString()} {count === 1 ? 'PM' : 'PMs'} upgrading their workflow
          </p>
        )}

        <p className="text-white/80 text-lg mb-8">
          Launching April 15, 2026.
        </p>

        <WaitlistForm variant="inverted" />

        <p className="text-white/60 text-sm mt-6">
          Free forever. No spam. Just PM wisdom.
        </p>
      </motion.div>
    </section>
  );
}
