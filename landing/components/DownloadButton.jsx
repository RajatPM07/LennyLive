'use client';

import { motion } from 'framer-motion';

/**
 * Primary download CTA button — shows version and file size.
 *
 * @param {'default' | 'inverted'} [variant='default']
 * @param {'lg' | 'md'} [size='lg']
 */
export default function DownloadButton({ variant = 'default', size = 'lg' }) {
  const isInverted = variant === 'inverted';
  const isLg = size === 'lg';

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.a
        href="/lenny-live-1.0.0.zip"
        download
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={[
          'inline-flex items-center gap-3 font-sans font-semibold rounded-pill transition-opacity hover:opacity-90',
          isLg ? 'px-8 py-4 text-lg' : 'px-6 py-3 text-sm',
          isInverted ? 'bg-dark text-white' : 'bg-orange text-white',
        ].join(' ')}
      >
        {/* Chrome icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="2" x2="12" y2="8" stroke="currentColor" strokeWidth="2" />
          <line x1="3.5" y1="17" x2="8.5" y2="14" stroke="currentColor" strokeWidth="2" />
          <line x1="20.5" y1="17" x2="15.5" y2="14" stroke="currentColor" strokeWidth="2" />
        </svg>
        Download for Chrome
      </motion.a>

      <span className={`text-xs ${isInverted ? 'text-white/60' : 'text-text-muted'}`}>
        v1.0.0 · 49 KB · Chrome 120+
      </span>
    </div>
  );
}
