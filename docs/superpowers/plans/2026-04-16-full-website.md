# Lenny Live Full Website — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Lenny Live landing page into a full product website with Download, Install Guide, Getting Started Guide pages, shared navigation, and updated home page copy.

**Architecture:** Next.js 16 App Router with new route directories under `landing/app/`. Shared components in `landing/components/`. Reusable `BrowserMockup` and `PageHeader` extracted for consistency. Static zip served from `landing/public/`.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Framer Motion 12, canvas-confetti (existing)

**Spec:** `docs/superpowers/specs/2026-04-16-full-website-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `landing/components/NavBar.jsx` | Sticky top navigation with scroll-aware background |
| `landing/components/MobileMenu.jsx` | Hamburger slide-out menu for mobile |
| `landing/components/PageHeader.jsx` | Reusable page hero (eyebrow + headline + subtitle) |
| `landing/components/BrowserMockup.jsx` | Reusable browser chrome frame |
| `landing/components/StepCard.jsx` | Numbered step with illustration + text |
| `landing/components/DownloadButton.jsx` | Primary download CTA with version/size |
| `landing/components/DownloadCTA.jsx` | Replaces WaitlistCTA — orange section with download button |
| `landing/components/AnimatedDemo.jsx` | Reusable looping state-machine demo |
| `landing/app/download/page.js` | Download page |
| `landing/app/install/page.js` | Installation guide page |
| `landing/app/guide/page.js` | Getting started guide page |

### Modified Files
| File | Changes |
|------|---------|
| `landing/app/layout.js` | Add NavBar to layout, update metadata |
| `landing/app/page.js` | Replace WaitlistCTA with DownloadCTA, update Hero imports |
| `landing/app/globals.css` | Add new design tokens (code-bg, success, nav-bg) |
| `landing/components/Hero.jsx` | Replace WaitlistForm with download button + secondary link |
| `landing/app/privacy/page.js` | Remove back-link (nav handles this now) |

### Static Assets
| File | Source |
|------|--------|
| `landing/public/lenny-live-1.0.0.zip` | Copy from repo root `lenny-live-1.0.0.zip` |

---

## Task 1: Design Tokens & Static Assets

**Files:**
- Modify: `landing/app/globals.css`
- Copy: `lenny-live-1.0.0.zip` → `landing/public/lenny-live-1.0.0.zip`

- [ ] **Step 1: Add new CSS tokens to globals.css**

Add inside the `@theme inline` block, after `--color-dark`:

```css
  --color-code-bg: #faf5ee;
  --color-success: #22c55e;
  --color-nav-bg: rgba(253, 252, 246, 0.95);
  --color-step-bg: #fff8f0;
```

- [ ] **Step 2: Copy zip to public folder**

```bash
cp /Users/rajat/AntiGravity/LennyLive/lenny-live-1.0.0.zip /Users/rajat/AntiGravity/LennyLive/landing/public/lenny-live-1.0.0.zip
```

- [ ] **Step 3: Commit**

```bash
git add landing/app/globals.css landing/public/lenny-live-1.0.0.zip
git commit -m "feat: add design tokens and zip asset for full website"
```

---

## Task 2: Shared Components — PageHeader & BrowserMockup

**Files:**
- Create: `landing/components/PageHeader.jsx`
- Create: `landing/components/BrowserMockup.jsx`

- [ ] **Step 1: Create PageHeader component**

```jsx
// landing/components/PageHeader.jsx
'use client';

import { motion } from 'framer-motion';

/**
 * Reusable page hero with eyebrow label, headline, and optional subtitle.
 *
 * @param {string} eyebrow — small uppercase label (e.g., "Installation Guide")
 * @param {string} headline — main heading text
 * @param {string} [subtitle] — optional body text below headline
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
```

- [ ] **Step 2: Create BrowserMockup component**

```jsx
// landing/components/BrowserMockup.jsx

/**
 * Reusable browser chrome frame — renders children inside a macOS-style browser window.
 *
 * @param {string} url — URL text shown in the address bar
 * @param {React.ReactNode} children — content inside the browser viewport
 * @param {string} [className] — additional classes on the outer wrapper
 */
export default function BrowserMockup({ url, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden ${className}`}>
      {/* Chrome bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
        {/* Traffic lights */}
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-yellow-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />

        {/* URL bar */}
        <div className="ml-2 flex-1 max-w-sm">
          <div className="bg-white rounded-md px-3 py-1 text-xs text-text-muted border border-gray-200 truncate">
            {url}
          </div>
        </div>
      </div>

      {/* Viewport */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/PageHeader.jsx landing/components/BrowserMockup.jsx
git commit -m "feat: add PageHeader and BrowserMockup shared components"
```

---

## Task 3: NavBar & MobileMenu

**Files:**
- Create: `landing/components/NavBar.jsx`
- Create: `landing/components/MobileMenu.jsx`
- Modify: `landing/app/layout.js`
- Modify: `landing/app/privacy/page.js`

- [ ] **Step 1: Create MobileMenu component**

```jsx
// landing/components/MobileMenu.jsx
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
            {/* Close button */}
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

            {/* Links */}
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

            {/* Download CTA */}
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
```

- [ ] **Step 2: Create NavBar component**

```jsx
// landing/components/NavBar.jsx
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

  // Close menu on route change
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
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="" width={28} height={28} />
            <span className="font-serif font-bold text-lg text-text-primary">Lenny Live</span>
          </Link>

          {/* Desktop nav links */}
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

          {/* Desktop CTA + Mobile hamburger */}
          <div className="flex items-center gap-4">
            <Link
              href="/download"
              className="hidden md:inline-block px-5 py-2 bg-orange text-white text-sm font-semibold rounded-pill hover:opacity-90 transition-opacity"
            >
              Download
            </Link>

            {/* Hamburger */}
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
```

- [ ] **Step 3: Update layout.js to include NavBar**

Replace the entire content of `landing/app/layout.js` with:

```jsx
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata = {
  title: "Lenny Live — Compounded experience. Borrowed intuition.",
  description:
    "The wisdom of 300+ product leaders, arriving exactly when you need it. A Chrome extension that brings Lenny Rachitsky's voice into your PM workflow.",
  icons: {
    icon: '/logo-icon.svg',
  },
  openGraph: {
    title: "Lenny Live — Compounded experience. Borrowed intuition.",
    description:
      "The wisdom of 300+ product leaders, arriving exactly when you need it.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Remove back-link from privacy page**

In `landing/app/privacy/page.js`, remove the `<Link>` import and the back-link block (lines 1, 17-22) since the NavBar now handles navigation. Replace with a spacer:

Remove:
```jsx
import Link from 'next/link';
```

Remove:
```jsx
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-orange-dark mb-10"
        >
          <span aria-hidden>←</span> Back to Lenny Live
        </Link>
```

- [ ] **Step 5: Verify dev server renders NavBar**

```bash
cd /Users/rajat/AntiGravity/LennyLive/landing && npm run dev
```

Open `http://localhost:3000` — verify sticky nav appears with logo, links, download button. Scroll to verify background transition. Check mobile (375px) for hamburger. Check `/privacy` renders without back-link.

- [ ] **Step 6: Commit**

```bash
git add landing/components/NavBar.jsx landing/components/MobileMenu.jsx landing/app/layout.js landing/app/privacy/page.js
git commit -m "feat: add sticky NavBar with mobile menu, wire into layout"
```

---

## Task 4: DownloadButton & DownloadCTA Components

**Files:**
- Create: `landing/components/DownloadButton.jsx`
- Create: `landing/components/DownloadCTA.jsx`

- [ ] **Step 1: Create DownloadButton component**

```jsx
// landing/components/DownloadButton.jsx
'use client';

import { motion } from 'framer-motion';

/**
 * Primary download CTA button — shows version and file size.
 *
 * @param {'default' | 'inverted'} [variant='default']
 *   default = orange button on cream bg, inverted = dark button on orange bg
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
```

- [ ] **Step 2: Create DownloadCTA section component**

```jsx
// landing/components/DownloadCTA.jsx
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
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/DownloadButton.jsx landing/components/DownloadCTA.jsx
git commit -m "feat: add DownloadButton and DownloadCTA components"
```

---

## Task 5: Update Home Page — Replace Waitlist with Download

**Files:**
- Modify: `landing/app/page.js`
- Modify: `landing/components/Hero.jsx`

- [ ] **Step 1: Update Hero to use DownloadButton instead of WaitlistForm**

Replace the full content of `landing/components/Hero.jsx`:

```jsx
'use client';

import { motion } from 'framer-motion';
import DownloadButton from './DownloadButton';
import PostcardMockup from './PostcardMockup';
import Link from 'next/link';

const headline = 'Compounded experience. Borrowed intuition.';
const words = headline.split(' ');

export default function Hero() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 py-20 bg-cream relative overflow-hidden">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <img src="/logo.svg" alt="Lenny Live" width={200} height={70} className="mx-auto" />
        </motion.div>

        {/* Eyebrow pill */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
          className="inline-block mb-6"
        >
          <span className="px-4 py-2 bg-white rounded-pill text-sm font-medium text-text-muted shadow-sm border border-gray-100">
            Powered by 300+ Lenny Podcast episodes & newsletters
          </span>
        </motion.div>

        {/* Headline */}
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
          {words.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
              className="inline-block mr-[0.3em]"
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="text-lg sm:text-xl text-text-muted max-w-2xl mx-auto mb-8"
        >
          An ambient Chrome extension that brings Lenny Rachitsky&apos;s voice into your PM
          workflow — exactly when you need it.
        </motion.p>

        {/* Download CTA + secondary link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="flex flex-col items-center gap-4"
        >
          <DownloadButton />
          <Link
            href="/guide"
            className="text-sm text-text-muted hover:text-orange-dark transition-colors underline underline-offset-2"
          >
            See how it works →
          </Link>
        </motion.div>
      </div>

      {/* Postcard mockup */}
      <div className="mt-12 md:absolute md:bottom-12 md:right-12">
        <PostcardMockup animate={true} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Update page.js to replace WaitlistCTA with DownloadCTA**

Replace the full content of `landing/app/page.js`:

```jsx
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import FeatureShowcase from '@/components/FeatureShowcase';
import SocialProof from '@/components/SocialProof';
import DemoPreview from '@/components/DemoPreview';
import DownloadCTA from '@/components/DownloadCTA';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <FeatureShowcase />
      <SocialProof />
      <DemoPreview />
      <DownloadCTA />
      <Footer />
    </main>
  );
}
```

- [ ] **Step 3: Verify home page renders correctly**

Open `http://localhost:3000` — verify:
- Hero shows download button instead of email form
- "See how it works" link visible below
- Orange CTA section at bottom shows download button, not waitlist form
- All existing sections still render correctly

- [ ] **Step 4: Commit**

```bash
git add landing/app/page.js landing/components/Hero.jsx
git commit -m "feat: replace waitlist with download CTA on home page"
```

---

## Task 6: Download Page

**Files:**
- Create: `landing/app/download/page.js`

- [ ] **Step 1: Create the download page**

```jsx
// landing/app/download/page.js
'use client';

import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import DownloadButton from '@/components/DownloadButton';
import PostcardMockup from '@/components/PostcardMockup';
import Footer from '@/components/Footer';
import Link from 'next/link';

const INCLUDES = [
  {
    title: '312 curated moments',
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
```

- [ ] **Step 2: Verify download page**

Open `http://localhost:3000/download` — verify:
- PageHeader renders with "Get Lenny Live"
- Download button links to `/lenny-live-1.0.0.zip`
- Three "what's included" cards render
- "Follow the install guide" link points to `/install`
- Click download button — file downloads

- [ ] **Step 3: Commit**

```bash
git add landing/app/download/page.js
git commit -m "feat: add download page with CTA and feature cards"
```

---

## Task 7: StepCard Component

**Files:**
- Create: `landing/components/StepCard.jsx`

- [ ] **Step 1: Create StepCard component**

```jsx
// landing/components/StepCard.jsx
'use client';

import { motion } from 'framer-motion';

/**
 * Numbered step with illustration and instruction text.
 * Alternates layout on desktop (even steps flip illustration/text sides).
 *
 * @param {number} number — step number (1-based)
 * @param {string} title — step title
 * @param {string} description — instruction text
 * @param {React.ReactNode} illustration — visual content (BrowserMockup, SVG, etc.)
 * @param {React.ReactNode} [tip] — optional tip text below description
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
          {/* Step badge */}
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
```

- [ ] **Step 2: Commit**

```bash
git add landing/components/StepCard.jsx
git commit -m "feat: add StepCard component for install/guide pages"
```

---

## Task 8: Installation Guide Page

**Files:**
- Create: `landing/app/install/page.js`

- [ ] **Step 1: Create the install page**

```jsx
// landing/app/install/page.js
'use client';

import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import StepCard from '@/components/StepCard';
import BrowserMockup from '@/components/BrowserMockup';
import Footer from '@/components/Footer';
import Link from 'next/link';

function DownloadIllustration() {
  return (
    <div className="bg-white rounded-card shadow-sm border border-gray-100 p-6 flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-orange/10 flex items-center justify-center shrink-0">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff6e40" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text-primary text-sm">lenny-live-1.0.0.zip</p>
        <p className="text-xs text-text-muted">49 KB</p>
      </div>
      <span className="text-xs text-success font-medium">Downloaded ✓</span>
    </div>
  );
}

function UnzipIllustration() {
  return (
    <div className="bg-code-bg rounded-card border border-orange/10 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded bg-orange/10 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <rect x="2" y="2" width="12" height="12" rx="2" />
            <path d="M6 2v12M8 4h-2M8 6h-2M8 8h-2" />
          </svg>
        </div>
        <span className="text-sm font-medium text-text-primary">lenny-live-1.0.0.zip</span>
        <span className="text-text-muted mx-2">→</span>
        <div className="w-8 h-8 rounded bg-orange/10 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M2 4l6-2 6 2v8l-6 2-6-2V4z" />
            <path d="M8 6v8" />
          </svg>
        </div>
        <span className="text-sm font-medium text-text-primary">LennyLive/</span>
      </div>
      <div className="pl-10 space-y-1 text-xs text-text-muted font-mono">
        <p>├── manifest.json</p>
        <p>├── background/</p>
        <p>├── content/</p>
        <p>├── popup/</p>
        <p>└── data/</p>
      </div>
    </div>
  );
}

function ExtensionsPageIllustration() {
  return (
    <BrowserMockup url="chrome://extensions">
      <div className="p-6 bg-gray-50 min-h-[140px]">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold text-text-primary">Extensions</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Developer mode</span>
            <div className="w-10 h-6 bg-orange rounded-full relative">
              <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow" />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="px-4 py-2 bg-white border-2 border-orange rounded-lg text-sm font-medium text-text-primary shadow-sm"
          >
            Load unpacked
          </motion.div>
          <div className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-text-muted">
            Pack extension
          </div>
        </div>
      </div>
    </BrowserMockup>
  );
}

function PinExtensionIllustration() {
  return (
    <div className="bg-white rounded-card shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-text-muted">Chrome toolbar →</span>
        <div className="flex items-center gap-1.5">
          {/* Puzzle piece icon (extensions menu) */}
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            className="w-7 h-7 bg-gray-100 rounded flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#ff6e40" strokeWidth="1.5" aria-hidden="true">
              <rect x="1" y="5" width="8" height="8" rx="1" />
              <path d="M5 5V4a2 2 0 114 0v1" />
              <path d="M9 9h1a2 2 0 100-4H9" />
            </svg>
          </motion.div>
        </div>
      </div>
      {/* Extensions dropdown mockup */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
        <div className="flex items-center justify-between py-1.5 px-2 bg-orange/5 rounded border border-orange/20">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="" width={16} height={16} />
            <span className="text-sm font-medium text-text-primary">Lenny Live</span>
          </div>
          <motion.div
            animate={{ rotate: [0, 15, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
            className="text-orange"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <path d="M7 1a1 1 0 011 1v2.586l1.707-1.293a1 1 0 111.414 1.414L7.707 8.121a1 1 0 01-1.414 0L2.879 4.707a1 1 0 111.414-1.414L6 4.586V2a1 1 0 011-1z" transform="rotate(180 7 7)" />
            </svg>
          </motion.div>
        </div>
        <div className="flex items-center justify-between py-1.5 px-2">
          <span className="text-sm text-text-muted">Other Extension</span>
          <span className="text-xs text-text-muted">📌</span>
        </div>
      </div>
    </div>
  );
}

function SuccessIllustration() {
  return (
    <motion.div
      initial={{ scale: 0.95 }}
      whileInView={{ scale: 1 }}
      viewport={{ once: true }}
      className="bg-white rounded-card shadow-sm border-2 border-success/30 p-6 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.3 }}
        className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <motion.path
            d="M8 16l5.5 5.5L24 11"
            stroke="#22c55e"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
          />
        </svg>
      </motion.div>
      <p className="font-serif text-xl font-bold text-text-primary mb-1">You&apos;re all set!</p>
      <p className="text-sm text-text-muted">Lenny Live is ready to go.</p>
    </motion.div>
  );
}

const STEPS = [
  {
    number: 1,
    title: 'Download the extension',
    description: "If you haven't already, grab the zip file from the download page.",
    tip: 'Your browser may warn about the download — click "Keep" to proceed.',
    Illustration: DownloadIllustration,
  },
  {
    number: 2,
    title: 'Unzip the file',
    description: 'Double-click the zip file to extract it. You should see a LennyLive folder with the extension files inside.',
    tip: "Keep this folder somewhere permanent — Chrome needs it to stay there. Don't delete it after installing.",
    Illustration: UnzipIllustration,
  },
  {
    number: 3,
    title: 'Open Chrome Extensions',
    description: "Type chrome://extensions into your Chrome address bar and press Enter. Then flip the Developer mode toggle in the top-right corner to ON.",
    Illustration: ExtensionsPageIllustration,
  },
  {
    number: 4,
    title: 'Load the extension',
    description: 'Click the "Load unpacked" button that appears. In the file picker, navigate to the LennyLive folder you just unzipped and select it.',
    Illustration: ExtensionsPageIllustration,
  },
  {
    number: 5,
    title: 'Pin it to your toolbar',
    description: "Click the puzzle piece icon in Chrome's toolbar, find Lenny Live in the list, and click the pin icon. The Lenny Live icon will now be visible in your toolbar.",
    Illustration: PinExtensionIllustration,
  },
  {
    number: 6,
    title: "You're ready!",
    description: 'Lenny Live is installed and running. Open any web page, highlight some PM-related text, and watch Lenny appear.',
    Illustration: SuccessIllustration,
  },
];

export default function InstallPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Installation Guide"
        headline="Install in under a minute."
        subtitle="No Chrome Web Store needed. Load the extension directly from the zip file."
      />

      <section className="px-6 bg-cream pb-16">
        {STEPS.map((step) => (
          <StepCard
            key={step.number}
            number={step.number}
            title={step.title}
            description={step.description}
            tip={step.tip}
            illustration={<step.Illustration />}
          />
        ))}
      </section>

      {/* Next step */}
      <section className="py-16 px-6 bg-proof text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-3">
            Installed? Learn how to use it.
          </h2>
          <Link
            href="/guide"
            className="inline-flex items-center gap-2 text-orange font-semibold hover:text-orange-dark transition-colors"
          >
            Getting started guide
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
        </motion.div>
      </section>

      {/* Trouble section */}
      <section className="py-12 px-6 bg-cream">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-text-muted text-sm">
            Having trouble?{' '}
            <a
              href="mailto:sharma.rajat70@gmail.com"
              className="text-orange-dark underline underline-offset-2 hover:text-orange transition-colors"
            >
              Email us
            </a>{' '}
            and we&apos;ll help you get set up.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
```

- [ ] **Step 2: Verify install page**

Open `http://localhost:3000/install` — verify:
- PageHeader renders
- 6 steps with alternating layout on desktop
- Animated illustrations (pulsing "Load unpacked", checkmark path draw)
- "Learn how to use it" link at bottom
- Mobile: single column, illustrations above text
- Step 6 success illustration has green checkmark animation

- [ ] **Step 3: Commit**

```bash
git add landing/app/install/page.js
git commit -m "feat: add installation guide page with step-by-step walkthrough"
```

---

## Task 9: AnimatedDemo Component

**Files:**
- Create: `landing/components/AnimatedDemo.jsx`

- [ ] **Step 1: Create AnimatedDemo component**

A reusable looping state-machine demo extracted from the DemoPreview pattern. Runs through phases on a timer, loops when in view.

```jsx
// landing/components/AnimatedDemo.jsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { useInView } from 'framer-motion';

/**
 * Reusable looping state-machine demo.
 *
 * @param {Array<{delay: number, phase: number}>} phases — phase timings
 * @param {number} loopDelay — ms before loop restarts after last phase
 * @param {(phase: number) => React.ReactNode} children — render function receiving current phase
 */
export default function AnimatedDemo({ phases, loopDelay = 7000, pauseDelay = 1000, children }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false });
  const [phase, setPhase] = useState(0);
  const timeoutIds = useRef([]);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clearAll = () => {
    timeoutIds.current.forEach((id) => clearTimeout(id));
    timeoutIds.current = [];
  };

  const startLoop = () => {
    clearAll();

    phases.forEach(({ delay, phase: p }) => {
      const id = setTimeout(() => setPhase(p), delay);
      timeoutIds.current.push(id);
    });

    const resetId = setTimeout(() => {
      setPhase(0);
      const restartId = setTimeout(startLoop, pauseDelay);
      timeoutIds.current.push(restartId);
    }, loopDelay);
    timeoutIds.current.push(resetId);
  };

  useEffect(() => {
    if (prefersReducedMotion) {
      // Show the most interesting phase
      const maxPhase = Math.max(...phases.map((p) => p.phase));
      setPhase(maxPhase);
      return;
    }

    if (isInView) {
      startLoop();
    } else {
      clearAll();
      setPhase(0);
    }

    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView, prefersReducedMotion]);

  return <div ref={ref}>{children(phase)}</div>;
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/components/AnimatedDemo.jsx
git commit -m "feat: add AnimatedDemo reusable looping state-machine component"
```

---

## Task 10: Getting Started Guide Page

**Files:**
- Create: `landing/app/guide/page.js`

- [ ] **Step 1: Create the guide page**

```jsx
// landing/app/guide/page.js
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import BrowserMockup from '@/components/BrowserMockup';
import AnimatedDemo from '@/components/AnimatedDemo';
import Footer from '@/components/Footer';
import Link from 'next/link';

/* ── Section: Selection Dot ────────────────────────────────────── */

const SELECTION_PHASES = [
  { delay: 0, phase: 0 },     // idle
  { delay: 800, phase: 1 },   // text highlighted
  { delay: 2000, phase: 2 },  // dot appears
  { delay: 3500, phase: 3 },  // postcard appears
];

function SelectionDotDemo() {
  return (
    <AnimatedDemo phases={SELECTION_PHASES} loopDelay={6000}>
      {(phase) => (
        <BrowserMockup url="notion.so/Retention-Strategy">
          <div className="p-6 min-h-[240px] relative">
            <p className="text-sm text-text-muted leading-relaxed">
              Our D30 retention sits at 18%.{' '}
              <span className={phase >= 1 ? 'bg-orange/20 rounded px-0.5 transition-colors duration-300' : ''}>
                The biggest drop-off happens between Day 3 and Day 7 when users haven&apos;t experienced the core value.
              </span>
            </p>
            <p className="text-sm text-text-muted leading-relaxed mt-3">
              Hypothesis: users who complete onboarding retain at 2.3x the rate...
            </p>

            {/* Orange selection dot */}
            <AnimatePresence>
              {phase >= 2 && (
                <motion.div
                  key="dot"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className="absolute top-14 right-8 w-5 h-5 bg-orange rounded-full shadow-lg cursor-pointer"
                />
              )}
            </AnimatePresence>

            {/* Postcard */}
            <AnimatePresence>
              {phase >= 3 && (
                <motion.div
                  key="postcard"
                  initial={{ opacity: 0, y: 20, x: 10 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                  className="absolute bottom-4 right-4 w-[240px] bg-white rounded-xl shadow-xl border border-gray-100 p-4"
                >
                  <p className="text-[10px] text-text-muted mb-1">Casey Winters</p>
                  <p className="text-xs text-text-primary italic leading-snug font-serif">
                    &ldquo;The best retention strategy isn&apos;t a feature...&rdquo;
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </BrowserMockup>
      )}
    </AnimatedDemo>
  );
}

/* ── Section: Write + Pause ────────────────────────────────────── */

const WRITE_PHASES = [
  { delay: 0, phase: 0 },
  { delay: 500, phase: 1 },   // typing
  { delay: 2500, phase: 2 },  // paused, badge appears
  { delay: 4500, phase: 3 },  // postcard
];

function WritePauseDemo() {
  return (
    <AnimatedDemo phases={WRITE_PHASES} loopDelay={7000}>
      {(phase) => (
        <BrowserMockup url="docs.google.com/PRD-Draft">
          <div className="p-6 min-h-[240px] relative">
            {/* Simulated editor */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 min-h-[120px]">
              <p className="text-sm text-text-primary">
                {phase >= 1 && (
                  <>Our pricing strategy should focus on</>
                )}
                {phase >= 1 && phase < 2 && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-0.5 h-4 bg-text-primary ml-0.5 align-middle"
                  />
                )}
                {phase >= 2 && (
                  <> value-based pricing with a freemium tier to drive adoption...</>
                )}
              </p>
            </div>

            {/* Badge pill */}
            <AnimatePresence>
              {phase >= 2 && (
                <motion.div
                  key="badge"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.25 }}
                  className="absolute bottom-4 right-4 flex items-center gap-2 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg"
                >
                  <span className="w-2 h-2 rounded-full bg-orange animate-pulse shrink-0" />
                  Lenny has thoughts →
                </motion.div>
              )}
            </AnimatePresence>

            {/* Postcard */}
            <AnimatePresence>
              {phase >= 3 && (
                <motion.div
                  key="postcard"
                  initial={{ opacity: 0, y: 20, x: 10 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                  className="absolute bottom-12 right-4 w-[240px] bg-white rounded-xl shadow-xl border border-gray-100 p-4"
                >
                  <p className="text-[10px] text-text-muted mb-1">Elena Verna</p>
                  <p className="text-xs text-text-primary italic leading-snug font-serif">
                    &ldquo;Freemium only works when your free tier creates a habit...&rdquo;
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </BrowserMockup>
      )}
    </AnimatedDemo>
  );
}

/* ── Section: Gamification ─────────────────────────────────────── */

const PM_LEVELS = [
  { name: 'Intern', xp: 0, active: false },
  { name: 'APM', xp: 50, active: false },
  { name: 'PM', xp: 150, active: true },
  { name: 'Senior PM', xp: 350, active: false },
  { name: 'Staff PM', xp: 700, active: false },
  { name: 'Group PM', xp: 1200, active: false },
];

function GamificationVisual() {
  return (
    <div className="bg-white rounded-card shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center">
          <span className="font-serif font-bold text-orange">3</span>
        </div>
        <div>
          <p className="font-serif font-bold text-text-primary">PM</p>
          <p className="text-xs text-text-muted">165 / 350 XP to Senior PM</p>
        </div>
      </div>

      {/* Level progression bar */}
      <div className="flex gap-1 mb-4">
        {PM_LEVELS.map((level, i) => (
          <div key={level.name} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`h-2 w-full rounded-full ${
                i <= 2 ? 'bg-orange' : 'bg-gray-200'
              }`}
            />
            <span className={`text-[9px] ${level.active ? 'text-orange font-semibold' : 'text-text-muted'}`}>
              {level.name}
            </span>
          </div>
        ))}
      </div>

      {/* XP breakdown */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between py-1.5 px-3 bg-orange/5 rounded">
          <span className="text-text-muted">Insight delivered</span>
          <span className="text-orange font-semibold">+5 XP</span>
        </div>
        <div className="flex items-center justify-between py-1.5 px-3 bg-orange/5 rounded">
          <span className="text-text-muted">Saved to library</span>
          <span className="text-orange font-semibold">+15 XP</span>
        </div>
        <div className="flex items-center justify-between py-1.5 px-3 bg-orange/5 rounded">
          <span className="text-text-muted">3-day streak bonus</span>
          <span className="text-orange font-semibold">+6 XP</span>
        </div>
      </div>
    </div>
  );
}

/* ── Guide section wrapper ─────────────────────────────────────── */

function GuideSection({ number, eyebrow, title, description, children, reverse = false }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5 }}
      className="py-16 px-6"
    >
      <div className={`max-w-5xl mx-auto flex flex-col gap-10 items-center ${
        reverse ? 'md:flex-row-reverse' : 'md:flex-row'
      }`}>
        {/* Demo / Visual */}
        <div className="flex-1 w-full max-w-lg">{children}</div>

        {/* Text */}
        <div className="flex-1 max-w-md">
          <span className="text-xs uppercase tracking-[0.14em] text-orange-dark font-semibold mb-2 block">
            {eyebrow}
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-3">{title}</h2>
          <p className="text-text-muted leading-relaxed">{description}</p>
        </div>
      </div>
    </motion.section>
  );
}

/* ── Page ───────────────────────────────────────────────────────── */

export default function GuidePage() {
  return (
    <main>
      <PageHeader
        eyebrow="Getting Started"
        headline="Here's how Lenny shows up."
        subtitle="Three ways Lenny appears in your workflow — all ambient, none annoying."
      />

      {/* Selection Dot */}
      <GuideSection
        number={1}
        eyebrow="Highlight & discover"
        title="The selection dot"
        description="Highlight any PM-related text on any web page. An orange dot appears at the edge of your selection. Click it, and Lenny delivers a real insight from a real product leader — matched to exactly what you highlighted."
      >
        <SelectionDotDemo />
      </GuideSection>

      <div className="border-t border-gray-100 max-w-4xl mx-auto" />

      {/* Write + Pause */}
      <GuideSection
        number={2}
        eyebrow="Write & receive"
        title="The write-and-pause badge"
        description='Start typing in any text editor — Notion, Google Docs, Linear, anywhere. When you pause, Lenny reads the concept you're working on and a "Lenny has thoughts" pill appears. Click it for a relevant insight.'
        reverse
      >
        <WritePauseDemo />
      </GuideSection>

      <div className="border-t border-gray-100 max-w-4xl mx-auto" />

      {/* Double-tap Ctrl */}
      <GuideSection
        number={3}
        eyebrow="Anytime shortcut"
        title="Double-tap Ctrl"
        description="On any page, double-tap the Ctrl key (within 300ms) to summon Lenny instantly. Works with or without a text selection — Lenny will use whatever context is available on the page."
      >
        <div className="bg-white rounded-card shadow-sm border border-gray-100 p-8 text-center">
          <motion.div
            animate={{ scale: [1, 0.92, 1, 0.92, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-50 rounded-lg border border-gray-200"
          >
            <kbd className="px-3 py-1.5 bg-white rounded border border-gray-300 text-sm font-mono font-medium shadow-sm">
              Ctrl
            </kbd>
            <span className="text-text-muted text-xs">×2</span>
          </motion.div>
          <p className="text-xs text-text-muted mt-4">Tap twice within 300ms</p>
        </div>
      </GuideSection>

      <div className="border-t border-gray-100 max-w-4xl mx-auto" />

      {/* Gamification */}
      <GuideSection
        number={4}
        eyebrow="Level up"
        title="Save, streak, grow"
        description="Every insight you engage with earns XP. Save insights to your library for bonus XP. Come back daily to build streaks. Progress from PM Intern all the way to Group PM. Your popup shows your knowledge map across topics."
        reverse
      >
        <GamificationVisual />
      </GuideSection>

      {/* Explore CTA */}
      <section className="py-20 px-6 bg-proof text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="max-w-xl mx-auto"
        >
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-3">
            Ready to borrow some intuition?
          </h2>
          <p className="text-text-muted mb-6">
            Open any page with PM content — a PRD, a strategy doc, a Jira ticket — and watch Lenny appear.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/download"
              className="px-6 py-3 bg-orange text-white font-semibold rounded-pill hover:opacity-90 transition-opacity"
            >
              Download Lenny Live
            </Link>
            <Link
              href="/"
              className="text-sm text-text-muted hover:text-orange-dark transition-colors underline underline-offset-2"
            >
              Back to home
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />
    </main>
  );
}
```

- [ ] **Step 2: Verify guide page**

Open `http://localhost:3000/guide` — verify:
- PageHeader renders
- Selection dot demo loops: idle → highlight → dot → postcard
- Write+pause demo loops: idle → typing → badge → postcard
- Double-tap Ctrl animation plays (key press visual)
- Gamification section shows level progression bar and XP breakdown
- Alternating layout works on desktop
- Mobile: single column
- Bottom CTA links work

- [ ] **Step 3: Commit**

```bash
git add landing/app/guide/page.js
git commit -m "feat: add getting started guide with animated demos"
```

---

## Task 11: Design Skill Passes — Polish, Motion, Typography

This task runs the installed design skills against the completed pages to elevate quality. Each sub-step invokes a skill's principles.

**Files:**
- Modify: All new components as needed based on skill audit results

- [ ] **Step 1: Run `/animate` + `/design-motion-principles` audit**

Review all animations across the new pages. Check:
- Spring physics for entrances (no linear easing)
- Appropriate durations (150-300ms micro, 400-600ms layout shifts)
- GPU-accelerated properties (transform, opacity — not height/width)
- `prefers-reduced-motion` respected in all new components
- No simultaneous competing animations

Fix any violations found.

- [ ] **Step 2: Run `/typeset` pass**

Review all new pages for typography. Check:
- Consistent heading hierarchy (no skipped levels)
- Georgia serif on all headings
- system-ui sans on all body text
- Adequate line-height on body text (1.6-1.7)
- Caption text uses `text-sm text-text-muted`
- Code/mono text in install guide uses warm background (`bg-code-bg`)

Fix any violations found.

- [ ] **Step 3: Run `/layout` pass**

Review layout across all new pages. Check:
- Alternating layouts actually work on tablet (768px)
- Adequate whitespace between sections
- No orphaned single-line headings
- Max-width constraints prevent overly wide text blocks
- Consistent section padding (py-16 or py-24)

Fix any violations found.

- [ ] **Step 4: Run `/polish` final pass**

Final quality check:
- Border radius consistency (rounded-card on cards, rounded-pill on pills, rounded-xl on browser mockups)
- Shadow depth consistency
- Responsive behavior at 375px, 768px, 1280px
- Nav doesn't overlap page headers
- All links work (download, install, guide, privacy, home)
- Footer appears on all pages

Fix any violations found.

- [ ] **Step 5: Commit all design refinements**

```bash
git add -A
git commit -m "polish: design skill passes — motion, typography, layout, polish"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Full page flow test**

Navigate: Home → Download → Install → Guide and back. Verify:
- Nav highlights correct page
- All inter-page links work
- Download button triggers real file download
- No console errors
- Mobile hamburger menu works on all pages

- [ ] **Step 2: Run build check**

```bash
cd /Users/rajat/AntiGravity/LennyLive/landing && npm run build
```

Verify no build errors. Fix any that appear.

- [ ] **Step 3: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: address build errors and final verification fixes"
```

---

## Execution Order & Dependencies

```
Task 1 (tokens + zip)
  ↓
Task 2 (PageHeader + BrowserMockup)
  ↓
Task 3 (NavBar + MobileMenu + layout.js) — depends on Task 1 for nav-bg token
  ↓
Task 4 (DownloadButton + DownloadCTA) — depends on Task 1 for zip
  ↓
Task 5 (Home page updates) — depends on Task 4
  ↓
Task 6 (Download page) — depends on Tasks 2, 4
  ↓
Task 7 (StepCard) — depends on Task 2 for BrowserMockup
  ↓
Task 8 (Install page) — depends on Tasks 2, 7
  ↓
Task 9 (AnimatedDemo)
  ↓
Task 10 (Guide page) — depends on Tasks 2, 9
  ↓
Task 11 (Design skill passes) — all pages must exist
  ↓
Task 12 (Final verification) — everything must be done
```

**Parallelizable groups:**
- Tasks 2, 9 can run in parallel (no dependencies on each other)
- Tasks 6, 7 can run in parallel after Task 4
- Tasks 8, 10 can run in parallel after their dependencies
