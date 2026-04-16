'use client';
import { motion } from 'framer-motion';

const features = [
  {
    title: 'Real voices, not AI slop',
    description:
      'Every insight comes from a real guest on a real episode. Lenny\u2019s voice delivers it. Zero hallucination.',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        {/* Microphone body */}
        <rect x="14" y="4" width="12" height="18" rx="6" stroke="#ff6e40" strokeWidth="2" />
        {/* Microphone stand */}
        <path d="M8 22c0 6.627 5.373 12 12 12s12-5.373 12-12" stroke="#ff6e40" strokeWidth="2" strokeLinecap="round" />
        <line x1="20" y1="34" x2="20" y2="38" stroke="#ff6e40" strokeWidth="2" strokeLinecap="round" />
        <line x1="14" y1="38" x2="26" y2="38" stroke="#ff6e40" strokeWidth="2" strokeLinecap="round" />
        {/* Animated sound waves */}
        <motion.path
          d="M30 16c2 1.5 2 6.5 0 8"
          stroke="#ff6e40"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M34 13c3.5 3 3.5 11 0 14"
          stroke="#ff6e40"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
        />
      </svg>
    ),
  },
  {
    title: 'Ambient, not annoying',
    description:
      'No popups, no chat windows. A quiet nudge in the corner \u2014 only when it\u2019s relevant to what you\u2019re working on.',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        {/* Eye shape */}
        <path d="M4 20c4-8 28-8 32 0C32 28 8 28 4 20z" stroke="#ff6e40" strokeWidth="2" strokeLinejoin="round" />
        {/* Pupil */}
        <circle cx="20" cy="20" r="4" stroke="#ff6e40" strokeWidth="2" />
        {/* Pulsing glow ring */}
        <motion.circle
          cx="20"
          cy="20"
          r="9"
          stroke="#ff6e40"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          initial={{ opacity: 0.2, scale: 0.85 }}
          animate={{ opacity: [0.2, 0.7, 0.2], scale: [0.85, 1.05, 0.85] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '20px 20px' }}
        />
      </svg>
    ),
  },
  {
    title: '300+ episodes distilled',
    description:
      '2,700+ curated moments from guests like Shreyas Doshi, Shishir Mehrotra, Reforge founders \u2014 searchable by your context.',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        {/* Bookshelf — 5 vertical bars of varying height */}
        <rect x="4"  y="14" width="5" height="22" rx="2" stroke="#ff6e40" strokeWidth="2" />
        <rect x="11" y="10" width="5" height="26" rx="2" stroke="#ff6e40" strokeWidth="2" />
        <rect x="18" y="17" width="5" height="19" rx="2" stroke="#ff6e40" strokeWidth="2" />
        <rect x="25" y="8"  width="5" height="28" rx="2" stroke="#ff6e40" strokeWidth="2" />
        <rect x="32" y="13" width="5" height="23" rx="2" stroke="#ff6e40" strokeWidth="2" />
        {/* Shelf baseline */}
        <line x1="2" y1="37" x2="38" y2="37" stroke="#ff6e40" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Works where you work',
    description:
      'Notion, Google Docs, Linear, Jira \u2014 and any text editor on the web.',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        {/* 2x2 grid */}
        <rect x="4"  y="4"  width="14" height="14" rx="3" stroke="#ff6e40" strokeWidth="2" />
        <rect x="22" y="4"  width="14" height="14" rx="3" stroke="#ff6e40" strokeWidth="2" />
        <rect x="4"  y="22" width="14" height="14" rx="3" stroke="#ff6e40" strokeWidth="2" />
        <rect x="22" y="22" width="14" height="14" rx="3" stroke="#ff6e40" strokeWidth="2" />
        {/* Letters */}
        <text x="11" y="15" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="bold" fill="#ff6e40">N</text>
        <text x="29" y="15" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="bold" fill="#ff6e40">G</text>
        <text x="11" y="33" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="bold" fill="#ff6e40">L</text>
        <text x="29" y="33" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="bold" fill="#ff6e40">J</text>
      </svg>
    ),
  },
];

export default function FeatureShowcase() {
  return (
    <section className="py-24 px-6 bg-cream">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-center mb-16">
          Why PMs love it
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.4, delay: i * 0.15 }}
              whileHover={{
                y: -4,
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}
              className="bg-white rounded-card p-6 shadow-sm border border-gray-100 hover:border-orange/30 transition-colors"
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="font-serif text-lg font-bold mb-2 text-text-primary">
                {feature.title}
              </h3>
              <p className="text-text-muted leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
