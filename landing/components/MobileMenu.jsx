'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/download', label: 'Download' },
  { href: '/install', label: 'Install' },
  { href: '/guide', label: 'Guide' },
  { href: '/privacy', label: 'Privacy' },
];

export default function MobileMenu({ isOpen, onClose, pathname }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.nav
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 w-72 bg-cream z-50 shadow-2xl p-8 flex flex-col"
          >
            <button
              onClick={onClose}
              className="self-end mb-8 text-text-muted hover:text-text-primary transition-colors"
              aria-label="Close menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={`py-3 px-4 rounded-lg text-lg font-medium transition-colors ${
                    pathname === href
                      ? 'text-orange bg-orange/5'
                      : 'text-text-primary hover:bg-gray-100'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="mt-auto pt-8">
              <Link
                href="/download"
                onClick={onClose}
                className="block w-full text-center px-6 py-3 bg-orange text-white font-semibold rounded-pill hover:opacity-90 transition-opacity"
              >
                Download
              </Link>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}
