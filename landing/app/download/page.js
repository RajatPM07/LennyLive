'use client';

import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import DownloadButton from '@/components/DownloadButton';
import PostcardMockup from '@/components/PostcardMockup';
import Footer from '@/components/Footer';
import Link from 'next/link';

const INCLUDES = [
  {
    title: '2,700+ curated moments',
    description: 'Real stories from 300+ podcast episodes, semantically searchable.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="3" y="6" width="7" height="20" rx="2" stroke="#ff6e40" strokeWidth="1.5" />
        <rect x="12.5" y="3" width="7" height="23" rx="2" stroke="#ff6e40" strokeWidth="1.5" />
        <rect x="22" y="8" width="7" height="18" rx="2" stroke="#ff6e40" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Lenny's voice",
    description: 'Hear insights narrated in a cloned voice (with his permission).',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="10" y="3" width="12" height="16" rx="6" stroke="#ff6e40" strokeWidth="1.5" />
        <path d="M6 19c0 5.5 4.5 10 10 10s10-4.5 10-10" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Level up as a PM',
    description: 'Save insights, build streaks, progress from Intern to Group PM.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 3l3.5 7 7.5 1-5.5 5.3 1.3 7.7L16 20.5 9.2 24l1.3-7.7L5 11l7.5-1L16 3z" stroke="#ff6e40" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function DownloadPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Download"
        headline="Get Lenny Live"
        subtitle="Install the Chrome extension and start borrowing the intuition of 300+ product leaders."
      />

      <section className="pb-16 px-6 bg-cream">
        <div className="max-w-4xl mx-auto">
          {/* Download CTA — centered, bold */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="text-center mb-16"
          >
            <DownloadButton size="lg" />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4"
            >
              <span className="inline-block px-4 py-1.5 bg-white rounded-pill text-xs text-text-muted border border-gray-100 shadow-sm">
                Requires Chrome 120+ on macOS, Windows, or Linux
              </span>
            </motion.div>
          </motion.div>

          {/* What's included */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
            {INCLUDES.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
                className="bg-white rounded-card p-6 shadow-sm border border-gray-100 text-center"
              >
                <div className="flex justify-center mb-3">{item.icon}</div>
                <h3 className="font-serif text-lg font-bold mb-1">{item.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Next step nudge */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <p className="text-text-muted mb-2">Downloaded the zip?</p>
            <Link
              href="/install"
              className="inline-flex items-center gap-2 text-orange font-semibold hover:text-orange-dark transition-colors"
            >
              Follow the install guide
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Decorative postcard */}
      <section className="py-16 px-6 bg-proof">
        <div className="max-w-4xl mx-auto flex justify-center">
          <PostcardMockup />
        </div>
      </section>

      <Footer />
    </main>
  );
}
