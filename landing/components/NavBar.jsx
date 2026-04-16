'use client';

import { useState, useEffect } from 'react';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MobileMenu from './MobileMenu';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/download', label: 'Download' },
  { href: '/install', label: 'Install' },
  { href: '/guide', label: 'Guide' },
];

export default function NavBar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 40);
  });

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <motion.header
        className="fixed top-0 left-0 right-0 z-30 px-6 py-4 transition-colors duration-200"
        style={{
          backgroundColor: scrolled ? 'var(--color-nav-bg)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
        }}
      >
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="" width={28} height={28} />
            <span className="font-serif font-bold text-lg text-text-primary">Lenny Live</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors relative ${
                  pathname === href ? 'text-orange' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {label}
                {pathname === href && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-orange rounded-full"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/download"
              className="hidden md:inline-block px-5 py-2 bg-orange text-white text-sm font-semibold rounded-pill hover:opacity-90 transition-opacity"
            >
              Download
            </Link>

            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden text-text-primary"
              aria-label="Open menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </nav>
      </motion.header>

      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} pathname={pathname} />
    </>
  );
}
