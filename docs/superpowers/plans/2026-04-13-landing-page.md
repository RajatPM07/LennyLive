# Lenny Live Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a conversion-focused landing page for the Lenny Live Chrome extension that drives waitlist email signups, with playful animations and a Duolingo-meets-product-tool aesthetic.

**Architecture:** Next.js App Router with Tailwind CSS for styling and Framer Motion for animations. Supabase handles waitlist email storage via two API routes (POST to submit, GET for count). The page is a single-page scroll with 7 sections — each is its own React component.

**Tech Stack:** Next.js 15, Tailwind CSS 4, Framer Motion 11, @supabase/supabase-js, canvas-confetti

---

## File Structure

```
landing/
├── app/
│   ├── layout.js              # Root layout — meta tags, OG image, fonts
│   ├── page.js                # Assembles all 7 sections in order
│   ├── globals.css            # Tailwind directives + CSS custom properties
│   └── api/
│       └── waitlist/
│           ├── route.js       # POST: validate + insert email into Supabase
│           └── count/
│               └── route.js   # GET: return waitlist count (60s cache)
├── components/
│   ├── Hero.jsx               # Section 1: full-vh hero with postcard mockup
│   ├── HowItWorks.jsx         # Section 2: 3-step with connector line
│   ├── FeatureShowcase.jsx    # Section 3: 2×2 feature cards
│   ├── SocialProof.jsx        # Section 4: anchor quote + floating pills + stats
│   ├── DemoPreview.jsx        # Section 5: browser mockup with animation loop
│   ├── WaitlistCTA.jsx        # Section 6: orange CTA section with counter
│   ├── Footer.jsx             # Section 7: dark footer
│   ├── WaitlistForm.jsx       # Shared email form (Hero + CTA reuse)
│   ├── PostcardMockup.jsx     # Animated postcard UI (Hero + Demo reuse)
│   ├── CountUp.jsx            # Animated number counter on scroll
│   └── FloatingPills.jsx      # Sine-wave floating guest name pills
├── lib/
│   └── supabase.js            # Supabase client singleton
├── public/
│   └── og-image.png           # OG image (create later)
├── tailwind.config.js         # Custom colors, fonts, border-radius tokens
├── next.config.js             # Minimal config
├── package.json
├── .env.local                 # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
└── .gitignore
```

---

## Task 1: Project Scaffold + Tailwind + Globals

**Files:**
- Create: `landing/package.json`
- Create: `landing/next.config.js`
- Create: `landing/tailwind.config.js`
- Create: `landing/app/globals.css`
- Create: `landing/app/layout.js`
- Create: `landing/app/page.js`
- Create: `landing/.env.local`
- Create: `landing/.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/rajat/AntiGravity/LennyLive/landing
npx create-next-app@latest . --js --tailwind --eslint --app --src-dir=false --import-alias="@/*" --no-turbopack
```

Select defaults when prompted. This creates the Next.js scaffold with Tailwind pre-configured.

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/rajat/AntiGravity/LennyLive/landing
npm install framer-motion @supabase/supabase-js canvas-confetti
```

- [ ] **Step 3: Configure Tailwind with custom design tokens**

Replace `landing/tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#fdfcf6',
        orange: {
          DEFAULT: '#ff6e40',
          dark: '#a23f1d',
        },
        text: {
          primary: '#1a1c1c',
          muted: '#5e5e5e',
        },
        proof: '#fff8f5',
        dark: '#1a1a1a',
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        input: '12px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: Set up globals.css**

Replace `landing/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --cream: #fdfcf6;
  --orange: #ff6e40;
  --orange-dark: #a23f1d;
  --text-primary: #1a1c1c;
  --text-muted: #5e5e5e;
}

html {
  scroll-behavior: smooth;
}

body {
  background-color: var(--cream);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Set up root layout with meta tags**

Replace `landing/app/layout.js` with:

```jsx
import './globals.css';

export const metadata = {
  title: 'Lenny Live — Compounded experience. Borrowed intuition.',
  description: 'An ambient Chrome extension that brings Lenny Rachitsky\'s voice into your PM workflow — exactly when you need it.',
  openGraph: {
    title: 'Lenny Live — Compounded experience. Borrowed intuition.',
    description: 'An ambient Chrome extension that brings Lenny Rachitsky\'s voice into your PM workflow.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Create placeholder page.js**

Replace `landing/app/page.js` with:

```jsx
export default function Home() {
  return (
    <main>
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <h1 className="font-serif text-4xl text-text-primary">
          Lenny Live — Coming Soon
        </h1>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Create .env.local**

```bash
cat > /Users/rajat/AntiGravity/LennyLive/landing/.env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://kjbeubcbhbjrnbnztwap.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_H6QbLUuEBB49f-Hyf0Tybw_GT7bxwqr
EOF
```

- [ ] **Step 8: Create .gitignore**

```bash
cat > /Users/rajat/AntiGravity/LennyLive/landing/.gitignore << 'EOF'
node_modules/
.next/
.env.local
EOF
```

- [ ] **Step 9: Verify dev server starts**

```bash
cd /Users/rajat/AntiGravity/LennyLive/landing
npm run dev
```

Expected: Dev server at http://localhost:3000, cream background, "Lenny Live — Coming Soon" in Georgia serif.

- [ ] **Step 10: Commit**

```bash
git add landing/
git commit -m "feat(landing): scaffold Next.js + Tailwind + Framer Motion project"
```

---

## Task 2: Supabase Client + API Routes

**Files:**
- Create: `landing/lib/supabase.js`
- Create: `landing/app/api/waitlist/route.js`
- Create: `landing/app/api/waitlist/count/route.js`

**Pre-requisite:** Create the `waitlist` table in Supabase. Run this SQL in the Supabase SQL Editor:

```sql
create table if not exists waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  created_at  timestamptz not null default now()
);
```

- [ ] **Step 1: Create Supabase client**

Create `landing/lib/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 2: Create POST /api/waitlist route**

Create `landing/app/api/waitlist/route.js`:

```js
import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { status: 'error', message: 'Email is required.' },
        { status: 400 }
      );
    }

    const trimmed = email.trim().toLowerCase().slice(0, 320);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid email format.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('waitlist')
      .insert({ email: trimmed });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ status: 'duplicate' });
      }
      console.error('[LennyLive] Waitlist insert error:', error);
      return NextResponse.json(
        { status: 'error', message: 'Something went wrong. Try again in a moment.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: 'success' });
  } catch (err) {
    console.error('[LennyLive] Waitlist route error:', err);
    return NextResponse.json(
      { status: 'error', message: 'Something went wrong. Try again in a moment.' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create GET /api/waitlist/count route**

Create `landing/app/api/waitlist/count/route.js`:

```js
import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const revalidate = 60;

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('[LennyLive] Waitlist count error:', error);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (err) {
    console.error('[LennyLive] Waitlist count route error:', err);
    return NextResponse.json({ count: 0 });
  }
}
```

- [ ] **Step 4: Test API routes with curl**

```bash
# Test POST — success
curl -X POST http://localhost:3000/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
# Expected: {"status":"success"}

# Test POST — duplicate
curl -X POST http://localhost:3000/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
# Expected: {"status":"duplicate"}

# Test POST — invalid
curl -X POST http://localhost:3000/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email"}'
# Expected: {"status":"error","message":"Invalid email format."}

# Test GET count
curl http://localhost:3000/api/waitlist/count
# Expected: {"count":1}
```

- [ ] **Step 5: Clean up test data**

Delete the test row from Supabase SQL Editor:
```sql
delete from waitlist where email = 'test@example.com';
```

- [ ] **Step 6: Commit**

```bash
git add landing/lib/ landing/app/api/
git commit -m "feat(landing): Supabase client + waitlist API routes (POST + GET count)"
```

---

## Task 3: WaitlistForm Component (Shared)

**Files:**
- Create: `landing/components/WaitlistForm.jsx`

This component is reused in Hero (Section 1) and WaitlistCTA (Section 6).

- [ ] **Step 1: Create WaitlistForm component**

Create `landing/components/WaitlistForm.jsx`:

```jsx
'use client';

import { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function WaitlistForm({ variant = 'default' }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | duplicate | error
  const [errorMsg, setErrorMsg] = useState('');
  const controls = useAnimation();

  const isInverted = variant === 'inverted';

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim()) {
      setErrorMsg('Enter your email first!');
      controls.start({
        x: [0, -10, 10, -10, 10, 0],
        transition: { duration: 0.4 },
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('That doesn\'t look like an email address.');
      controls.start({
        x: [0, -10, 10, -10, 10, 0],
        transition: { duration: 0.4 },
      });
      return;
    }

    setStatus('loading');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (data.status === 'success') {
        setStatus('success');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ff6e40', '#fef3c7', '#ff6e40', '#a23f1d'],
        });
      } else if (data.status === 'duplicate') {
        setStatus('duplicate');
      } else {
        setStatus('error');
        setErrorMsg(data.message || 'Something went wrong. Try again in a moment.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Try again in a moment.');
    }
  }

  if (status === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <p className={`text-lg font-medium ${isInverted ? 'text-white' : 'text-text-primary'}`}>
          🎉 You&apos;re in! We&apos;ll be in touch.
        </p>
      </motion.div>
    );
  }

  if (status === 'duplicate') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <p className={`text-lg font-medium ${isInverted ? 'text-white' : 'text-text-primary'}`}>
          ✓ You&apos;re already on the list!
        </p>
      </motion.div>
    );
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      animate={controls}
      className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        maxLength={320}
        className={`flex-1 px-4 py-3 rounded-input text-base outline-none transition-shadow
          ${isInverted
            ? 'bg-white text-text-primary placeholder:text-text-muted shadow-lg focus:shadow-xl'
            : 'bg-white text-text-primary placeholder:text-text-muted border border-gray-200 focus:border-orange focus:ring-2 focus:ring-orange/20'
          }`}
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className={`px-6 py-3 rounded-input font-semibold text-base transition-all cursor-pointer
          disabled:opacity-60 disabled:cursor-not-allowed
          ${isInverted
            ? 'bg-dark text-white hover:bg-text-primary'
            : 'bg-orange text-white hover:bg-orange-dark'
          }`}
      >
        {status === 'loading'
          ? 'Joining...'
          : isInverted ? 'Get early access' : 'Join the waitlist'}
      </button>
      {errorMsg && (
        <p className={`text-sm mt-1 w-full text-center sm:text-left
          ${isInverted ? 'text-red-200' : 'text-orange-dark'}`}>
          {errorMsg}
        </p>
      )}
    </motion.form>
  );
}
```

- [ ] **Step 2: Verify it renders**

Temporarily import in `page.js`:

```jsx
import WaitlistForm from '@/components/WaitlistForm';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-cream gap-8 p-8">
      <h1 className="font-serif text-4xl">Test Forms</h1>
      <WaitlistForm />
      <div className="bg-orange p-8 rounded-card w-full max-w-lg">
        <WaitlistForm variant="inverted" />
      </div>
    </main>
  );
}
```

Check: both variants render, shake on empty submit, confetti on success, duplicate message on re-submit.

- [ ] **Step 3: Commit**

```bash
git add landing/components/WaitlistForm.jsx
git commit -m "feat(landing): WaitlistForm component with validation, confetti, shake"
```

---

## Task 4: PostcardMockup Component

**Files:**
- Create: `landing/components/PostcardMockup.jsx`

Reused in Hero (static entrance) and DemoPreview (looping animation).

- [ ] **Step 1: Create PostcardMockup component**

Create `landing/components/PostcardMockup.jsx`:

```jsx
'use client';

import { motion } from 'framer-motion';

export default function PostcardMockup({ animate = false }) {
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 40, x: 40 } : { opacity: 1 }}
      animate={animate ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={animate ? { type: 'spring', stiffness: 120, damping: 14, delay: 0.8 } : {}}
      className="w-[320px] bg-white rounded-card shadow-xl border border-gray-100 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span className="text-xs text-text-muted font-sans">Lenny has thoughts</span>
        </div>
        <p className="text-xs text-text-muted font-sans">
          Casey Winters · &quot;The Sustainable Growth Playbook&quot;
        </p>
      </div>

      {/* Quote */}
      <div className="px-5 py-3">
        <p className="font-serif text-base italic text-text-primary leading-relaxed">
          &quot;The best retention strategy isn&apos;t a feature — it&apos;s ensuring your product
          delivers value before the user has time to forget why they signed up.&quot;
        </p>
      </div>

      {/* Actions */}
      <div className="px-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Replay icon */}
          <button className="text-text-muted hover:text-orange transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
          </button>
          {/* Sound waves */}
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="w-1 bg-orange rounded-full"
                animate={{ height: [8, 16, 8] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </div>
        {/* Save button */}
        <button className="text-xs font-medium text-orange hover:text-orange-dark transition-colors">
          ♡ Save
        </button>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Temporarily add to `page.js` to check:
```jsx
import PostcardMockup from '@/components/PostcardMockup';
// inside return:
<PostcardMockup animate={true} />
```

Expected: Postcard slides in with spring physics, sound wave bars animate, orange dot pulses.

- [ ] **Step 3: Commit**

```bash
git add landing/components/PostcardMockup.jsx
git commit -m "feat(landing): PostcardMockup component with spring entrance + waveform"
```

---

## Task 5: CountUp + FloatingPills Components

**Files:**
- Create: `landing/components/CountUp.jsx`
- Create: `landing/components/FloatingPills.jsx`

- [ ] **Step 1: Create CountUp component**

Create `landing/components/CountUp.jsx`:

```jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

export default function CountUp({ target, suffix = '', duration = 1.5 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setCount(target);
      return;
    }

    let start = 0;
    const increment = target / (duration * 60); // ~60fps
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 1000 / 60);

    return () => clearInterval(timer);
  }, [isInView, target, duration]);

  return (
    <span ref={ref}>
      {count}{suffix}
    </span>
  );
}
```

- [ ] **Step 2: Create FloatingPills component**

Create `landing/components/FloatingPills.jsx`:

```jsx
'use client';

import { motion, useReducedMotion } from 'framer-motion';

const GUESTS = [
  'Shreyas Doshi', 'Shishir Mehrotra', 'Gokul Rajaram', 'Bangaly Kaba',
  'Casey Winters', 'Elena Verna', 'Deb Liu', 'Jeff Weinstein',
  'Maggie Crowley', 'Lenny Rachitsky', 'Merci Victoria Grace', 'Nikita Bier',
  'Paul Adams', 'Ravi Mehta', 'Scott Belsky', 'Jackie Bavaro',
  'Wes Kao', 'Adam Nash', 'Julie Zhuo', 'Mihika Kapoor',
];

export default function FloatingPills() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto py-6">
      {GUESTS.map((name, i) => (
        <motion.span
          key={name}
          className="px-4 py-2 bg-white rounded-pill text-sm font-medium text-text-primary shadow-sm border border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05 }}
          animate={
            prefersReducedMotion
              ? {}
              : {
                  y: [0, -6, 0, 6, 0],
                  transition: {
                    duration: 3 + (i % 3),
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: 'easeInOut',
                  },
                }
          }
        >
          {name}
        </motion.span>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/CountUp.jsx landing/components/FloatingPills.jsx
git commit -m "feat(landing): CountUp + FloatingPills utility components"
```

---

## Task 6: Hero Section

**Files:**
- Create: `landing/components/Hero.jsx`
- Modify: `landing/app/page.js`

- [ ] **Step 1: Create Hero component**

Create `landing/components/Hero.jsx`:

```jsx
'use client';

import { motion } from 'framer-motion';
import WaitlistForm from './WaitlistForm';
import PostcardMockup from './PostcardMockup';

const headline = 'Compounded experience. Borrowed intuition.';
const words = headline.split(' ');

export default function Hero() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 py-20 bg-cream relative overflow-hidden">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Eyebrow pill */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
          className="inline-block mb-6"
        >
          <span className="px-4 py-2 bg-white rounded-pill text-sm font-medium text-text-muted shadow-sm border border-gray-100">
            Powered by 300+ Lenny Podcast episodes
          </span>
        </motion.div>

        {/* Headline */}
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight mb-6">
          {words.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
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
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-lg sm:text-xl text-text-muted max-w-2xl mx-auto mb-8"
        >
          An ambient Chrome extension that brings Lenny Rachitsky&apos;s voice into your PM
          workflow — exactly when you need it.
        </motion.p>

        {/* Waitlist form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <WaitlistForm />
        </motion.div>
      </div>

      {/* Postcard mockup — positioned bottom-right on desktop, below on mobile */}
      <div className="mt-12 md:absolute md:bottom-12 md:right-12">
        <PostcardMockup animate={true} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire Hero into page.js**

Replace `landing/app/page.js` with:

```jsx
import Hero from '@/components/Hero';

export default function Home() {
  return (
    <main>
      <Hero />
    </main>
  );
}
```

- [ ] **Step 3: Verify in browser**

Check: Full viewport hero, staggered word animation, pill bounce-in, postcard slides in from bottom-right, waitlist form works end to end.

- [ ] **Step 4: Commit**

```bash
git add landing/components/Hero.jsx landing/app/page.js
git commit -m "feat(landing): Hero section with staggered animations + postcard mockup"
```

---

## Task 7: HowItWorks Section

**Files:**
- Create: `landing/components/HowItWorks.jsx`
- Modify: `landing/app/page.js`

- [ ] **Step 1: Create HowItWorks component**

Create `landing/components/HowItWorks.jsx`:

```jsx
'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const steps = [
  {
    number: 1,
    title: 'Read or write — just work',
    description:
      'Work in Notion, Google Docs, Linear, or Jira. Lenny senses PM moments whether you\'re drafting a PRD or reviewing a strategy doc.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="8" width="18" height="32" rx="2" stroke="#ff6e40" strokeWidth="2" />
        <rect x="26" y="8" width="18" height="32" rx="2" stroke="#ff6e40" strokeWidth="2" />
        <line x1="8" y1="16" x2="18" y2="16" stroke="#ff6e40" strokeWidth="1.5" opacity="0.5" />
        <line x1="8" y1="20" x2="16" y2="20" stroke="#ff6e40" strokeWidth="1.5" opacity="0.5" />
        <line x1="8" y1="24" x2="18" y2="24" stroke="#ff6e40" strokeWidth="1.5" opacity="0.5" />
        <rect x="30" y="16" width="10" height="2" rx="1" fill="#ff6e40" opacity="0.3" />
        <motion.line x1="30" y1="22" x2="36" y2="22" stroke="#ff6e40" strokeWidth="2"
          animate={{ x2: [30, 38, 30] }} transition={{ duration: 2, repeat: Infinity }} />
      </svg>
    ),
  },
  {
    number: 2,
    title: 'Lenny appears',
    description:
      'When you hit retention, prioritization, GTM, or any PM concept — a gentle nudge appears. Double-tap Ctrl anytime to ask directly.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <motion.rect x="8" y="20" width="32" height="12" rx="6" fill="#ff6e40"
          animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
        <motion.circle cx="14" cy="26" r="3" fill="white"
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
        <text x="20" y="29" fill="white" fontSize="8" fontFamily="sans-serif">Lenny →</text>
      </svg>
    ),
  },
  {
    number: 3,
    title: 'Listen & learn',
    description:
      'Hear real stories from 300+ product leaders. One insight, one voice, exactly when your brain is in the problem.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="10" width="36" height="28" rx="4" stroke="#ff6e40" strokeWidth="2" />
        <line x1="12" y1="18" x2="28" y2="18" stroke="#ff6e40" strokeWidth="1.5" opacity="0.4" />
        <line x1="12" y1="22" x2="24" y2="22" stroke="#ff6e40" strokeWidth="1.5" opacity="0.4" />
        {[0, 1, 2, 3].map((i) => (
          <motion.rect key={i} x={30 + i * 3} y="28" width="1.5" rx="0.75" fill="#ff6e40"
            animate={{ height: [4, 10, 4] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }} />
        ))}
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 px-6 bg-cream">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-center text-text-primary mb-16">
          How it works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Connector line — desktop only */}
          <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-[2px]">
            <motion.div
              className="h-full bg-orange/30"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg, #ff6e40 0, #ff6e40 8px, transparent 8px, transparent 16px)' }}
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.3 }}
              style={{ transformOrigin: 'left' }}
            />
          </div>

          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.2, duration: 0.5 }}
              className="text-center relative"
            >
              {/* Step number */}
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-2 border-orange text-orange font-serif text-xl font-bold mb-4">
                {step.number}
              </div>

              {/* Icon */}
              <div className="flex justify-center mb-4">
                {step.icon}
              </div>

              {/* Title */}
              <h3 className="font-serif text-xl font-bold text-text-primary mb-2">
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-text-muted text-base leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add to page.js**

```jsx
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
    </main>
  );
}
```

- [ ] **Step 3: Verify** — scroll down, steps stagger in, icons animate, connector line draws.

- [ ] **Step 4: Commit**

```bash
git add landing/components/HowItWorks.jsx landing/app/page.js
git commit -m "feat(landing): HowItWorks section with animated steps + connector line"
```

---

## Task 8: FeatureShowcase Section

**Files:**
- Create: `landing/components/FeatureShowcase.jsx`
- Modify: `landing/app/page.js`

- [ ] **Step 1: Create FeatureShowcase component**

Create `landing/components/FeatureShowcase.jsx`:

```jsx
'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const features = [
  {
    title: 'Real voices, not AI slop',
    description: 'Every insight comes from a real guest on a real episode. Lenny\'s voice delivers it. Zero hallucination.',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="16" r="6" stroke="#ff6e40" strokeWidth="2" />
        <path d="M20 22v6" stroke="#ff6e40" strokeWidth="2" />
        <path d="M14 16a6 6 0 0 0 12 0" stroke="#ff6e40" strokeWidth="2" fill="none" />
        {[0, 1, 2].map((i) => (
          <motion.path key={i} d={`M${28 + i * 3} ${12 - i * 2}a${8 + i * 3} ${8 + i * 3} 0 0 1 0 ${8 + i * 4}`}
            stroke="#ff6e40" strokeWidth="1.5" fill="none" opacity={0.3 + i * 0.2}
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
        ))}
      </svg>
    ),
  },
  {
    title: 'Ambient, not annoying',
    description: 'No popups, no chat windows. A quiet nudge in the corner — only when it\'s relevant to what you\'re working on.',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="8" stroke="#ff6e40" strokeWidth="2" />
        <circle cx="20" cy="20" r="3" fill="#ff6e40" />
        <motion.circle cx="20" cy="20" r="12" stroke="#ff6e40" strokeWidth="1" opacity="0.3"
          animate={{ r: [12, 16, 12], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }} />
      </svg>
    ),
  },
  {
    title: '300+ episodes distilled',
    description: '280 curated moments from guests like Shreyas Doshi, Shishir Mehrotra, Reforge founders — searchable by your context.',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={8 + i * 6} y={10 + (i % 2) * 2} width="4" height={20 - (i % 2) * 4}
            rx="1" stroke="#ff6e40" strokeWidth="1.5" fill={i === 2 ? '#ff6e40' : 'none'} opacity={i === 2 ? 0.3 : 1} />
        ))}
      </svg>
    ),
  },
  {
    title: 'Works where you work',
    description: 'Notion, Google Docs, Linear, Jira — and any text editor on the web.',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="4" y="4" width="14" height="14" rx="3" stroke="#ff6e40" strokeWidth="1.5" />
        <rect x="22" y="4" width="14" height="14" rx="3" stroke="#ff6e40" strokeWidth="1.5" />
        <rect x="4" y="22" width="14" height="14" rx="3" stroke="#ff6e40" strokeWidth="1.5" />
        <rect x="22" y="22" width="14" height="14" rx="3" stroke="#ff6e40" strokeWidth="1.5" />
        <text x="7" y="14" fontSize="7" fill="#ff6e40" fontFamily="sans-serif">N</text>
        <text x="25" y="14" fontSize="7" fill="#ff6e40" fontFamily="sans-serif">G</text>
        <text x="8" y="32" fontSize="7" fill="#ff6e40" fontFamily="sans-serif">L</text>
        <text x="26" y="32" fontSize="7" fill="#ff6e40" fontFamily="sans-serif">J</text>
      </svg>
    ),
  },
];

export default function FeatureShowcase() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 px-6 bg-cream">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-center text-text-primary mb-16">
          Why PMs love it
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              ref={i === 0 ? ref : undefined}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.15, duration: 0.4 }}
              whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
              className="bg-white rounded-card p-6 shadow-sm border border-gray-100 transition-all cursor-default
                hover:border-orange/30"
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="font-serif text-lg font-bold text-text-primary mb-2">
                {feature.title}
              </h3>
              <p className="text-text-muted text-base leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add to page.js**

```jsx
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import FeatureShowcase from '@/components/FeatureShowcase';

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <FeatureShowcase />
    </main>
  );
}
```

- [ ] **Step 3: Verify** — cards stagger in, hover lift works, icons animate.

- [ ] **Step 4: Commit**

```bash
git add landing/components/FeatureShowcase.jsx landing/app/page.js
git commit -m "feat(landing): FeatureShowcase section with 2x2 animated cards"
```

---

## Task 9: SocialProof Section

**Files:**
- Create: `landing/components/SocialProof.jsx`
- Modify: `landing/app/page.js`

- [ ] **Step 1: Create SocialProof component**

Create `landing/components/SocialProof.jsx`:

```jsx
'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import FloatingPills from './FloatingPills';
import CountUp from './CountUp';

const stats = [
  { target: 300, suffix: '+', label: 'Episodes indexed' },
  { target: 280, suffix: '+', label: 'Curated PM moments' },
  { target: 50, suffix: '+', label: 'Product leaders featured' },
];

export default function SocialProof() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 px-6 bg-proof">
      <div className="max-w-5xl mx-auto">
        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="font-serif text-3xl sm:text-4xl font-bold text-center text-text-primary mb-8"
        >
          Wisdom from the best in product
        </motion.h2>

        {/* Anchor quote */}
        <motion.blockquote
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="max-w-2xl mx-auto text-center mb-12"
        >
          <p className="font-serif italic text-xl sm:text-2xl text-text-primary leading-relaxed mb-3">
            &quot;Product sense isn&apos;t magic — it&apos;s pattern recognition from seeing
            thousands of product decisions play out. The best PMs are the ones who&apos;ve
            borrowed the most experience.&quot;
          </p>
          <cite className="text-text-muted text-sm not-italic">
            — Shreyas Doshi
          </cite>
        </motion.blockquote>

        {/* Floating guest pills */}
        <FloatingPills />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-12">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-serif text-4xl sm:text-5xl font-bold text-orange">
                <CountUp target={stat.target} suffix={stat.suffix} />
              </div>
              <p className="text-text-muted text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add to page.js**

```jsx
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import FeatureShowcase from '@/components/FeatureShowcase';
import SocialProof from '@/components/SocialProof';

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <FeatureShowcase />
      <SocialProof />
    </main>
  );
}
```

- [ ] **Step 3: Verify** — anchor quote fades in, pills float, numbers count up on scroll.

- [ ] **Step 4: Commit**

```bash
git add landing/components/SocialProof.jsx landing/app/page.js
git commit -m "feat(landing): SocialProof section with anchor quote, floating pills, count-up stats"
```

---

## Task 10: DemoPreview Section

**Files:**
- Create: `landing/components/DemoPreview.jsx`
- Modify: `landing/app/page.js`

- [ ] **Step 1: Create DemoPreview component**

Create `landing/components/DemoPreview.jsx`:

```jsx
'use client';

import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

const SEQUENCE_DURATION = 8000; // 8s total loop

export default function DemoPreview() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, margin: '-100px' });
  const [phase, setPhase] = useState(0); // 0: idle, 1: badge, 2: postcard, 3: save, 4: dismiss

  useEffect(() => {
    if (!isInView) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setPhase(2); // Show postcard statically
      return;
    }

    let timeout;
    function runSequence() {
      setPhase(1); // badge appears
      timeout = setTimeout(() => setPhase(2), 1200); // postcard slides in
      timeout = setTimeout(() => setPhase(3), 4000); // save clicked
      timeout = setTimeout(() => setPhase(4), 5500); // dismiss
      timeout = setTimeout(() => {
        setPhase(0);
        setTimeout(runSequence, 1000); // pause then restart
      }, 6500);
    }

    runSequence();
    return () => clearTimeout(timeout);
  }, [isInView]);

  return (
    <section ref={ref} className="py-24 px-6 bg-cream">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-center text-text-primary mb-12">
          See it in action
        </h2>

        {/* Browser window mockup */}
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden max-w-3xl mx-auto">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-white rounded-md px-3 py-1 text-xs text-text-muted border border-gray-200">
                notion.so/Retention-Strategy-Draft
              </div>
            </div>
          </div>

          {/* Page content — real PM text */}
          <div className="relative p-8 min-h-[360px] bg-white">
            <div className="max-w-lg">
              <h3 className="text-xl font-bold text-text-primary mb-4">
                Improving Day-30 Retention
              </h3>
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                Our current D30 retention sits at 18%, well below the 25% benchmark for B2B SaaS.
                The biggest drop-off happens between Day 3 and Day 7 — users complete onboarding
                but never return to build a second workflow.
              </p>
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                Hypothesis: users who connect at least one integration in the first session retain
                at 2.3x the rate. We need to front-load the integration setup into the onboarding
                flow rather than treating it as a post-setup task.
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                Next step: run a cohort analysis comparing users who completed integration setup
                in session 1 vs. session 2+ to validate the hypothesis before committing eng
                resources to the onboarding redesign.
              </p>
            </div>

            {/* Badge pill */}
            <AnimatePresence>
              {phase >= 1 && phase < 4 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute bottom-4 right-4"
                >
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-dark rounded-pill text-white text-xs shadow-lg">
                    <div className="w-2 h-2 rounded-full bg-orange animate-pulse" />
                    Lenny has thoughts →
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Postcard */}
            <AnimatePresence>
              {phase >= 2 && phase < 4 && (
                <motion.div
                  initial={{ opacity: 0, y: 40, x: 20 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                  className="absolute bottom-16 right-4 w-[280px] bg-white rounded-card shadow-xl border border-gray-100"
                >
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] text-text-muted">
                      Casey Winters · &quot;The Sustainable Growth Playbook&quot;
                    </p>
                  </div>
                  <div className="px-4 py-2">
                    <p className="font-serif text-sm italic text-text-primary leading-relaxed">
                      &quot;The best retention strategy isn&apos;t a feature — it&apos;s ensuring your product
                      delivers value before the user has time to forget why they signed up.&quot;
                    </p>
                  </div>
                  <div className="px-4 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4].map((i) => (
                        <motion.div
                          key={i}
                          className="w-0.5 bg-orange rounded-full"
                          animate={{ height: [4, 10, 4] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                        />
                      ))}
                    </div>
                    <motion.span
                      className="text-[10px] font-medium"
                      animate={phase >= 3 ? { color: '#16a34a' } : { color: '#ff6e40' }}
                    >
                      {phase >= 3 ? '✓ Saved!' : '♡ Save'}
                    </motion.span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add to page.js**

```jsx
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import FeatureShowcase from '@/components/FeatureShowcase';
import SocialProof from '@/components/SocialProof';
import DemoPreview from '@/components/DemoPreview';

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <FeatureShowcase />
      <SocialProof />
      <DemoPreview />
    </main>
  );
}
```

- [ ] **Step 3: Verify** — browser mockup renders, animation loops (badge → postcard → save → dismiss → repeat), real PM text is legible.

- [ ] **Step 4: Commit**

```bash
git add landing/components/DemoPreview.jsx landing/app/page.js
git commit -m "feat(landing): DemoPreview section with real PM text + animation loop"
```

---

## Task 11: WaitlistCTA Section

**Files:**
- Create: `landing/components/WaitlistCTA.jsx`
- Modify: `landing/app/page.js`

- [ ] **Step 1: Create WaitlistCTA component**

Create `landing/components/WaitlistCTA.jsx`:

```jsx
'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import WaitlistForm from './WaitlistForm';

export default function WaitlistCTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [waitlistCount, setWaitlistCount] = useState(null);

  useEffect(() => {
    fetch('/api/waitlist/count')
      .then((res) => res.json())
      .then((data) => setWaitlistCount(data.count))
      .catch(() => setWaitlistCount(null));
  }, []);

  return (
    <section ref={ref} className="py-24 px-6 bg-orange">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto text-center"
      >
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-3">
          Be the first to borrow Lenny&apos;s intuition
        </h2>

        {waitlistCount !== null && waitlistCount > 0 && (
          <p className="text-white/90 text-lg mb-2">
            Join {waitlistCount.toLocaleString()} PM{waitlistCount !== 1 ? 's' : ''} upgrading their workflow
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
```

- [ ] **Step 2: Add to page.js**

```jsx
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import FeatureShowcase from '@/components/FeatureShowcase';
import SocialProof from '@/components/SocialProof';
import DemoPreview from '@/components/DemoPreview';
import WaitlistCTA from '@/components/WaitlistCTA';

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <FeatureShowcase />
      <SocialProof />
      <DemoPreview />
      <WaitlistCTA />
    </main>
  );
}
```

- [ ] **Step 3: Verify** — orange section, dynamic counter shows (or hides if 0), inverted form works, confetti fires.

- [ ] **Step 4: Commit**

```bash
git add landing/components/WaitlistCTA.jsx landing/app/page.js
git commit -m "feat(landing): WaitlistCTA section with dynamic counter from Supabase"
```

---

## Task 12: Footer Section

**Files:**
- Create: `landing/components/Footer.jsx`
- Modify: `landing/app/page.js`

- [ ] **Step 1: Create Footer component**

Create `landing/components/Footer.jsx`:

```jsx
export default function Footer() {
  return (
    <footer className="bg-dark py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          {/* Left — brand */}
          <div className="text-center md:text-left">
            <h3 className="text-white font-serif text-xl font-bold mb-1">Lenny Live</h3>
            <p className="text-gray-500 text-sm">Compounded experience. Borrowed intuition.</p>
          </div>

          {/* Center — challenge */}
          <p className="text-gray-500 text-sm text-center">
            Built for the Lenny Rachitsky Data Challenge 2026
          </p>

          {/* Right — author */}
          <p className="text-gray-500 text-sm text-center md:text-right">
            Built by Rajat Sharma, Mumbai
          </p>
        </div>

        <div className="border-t border-gray-800 pt-6">
          <p className="text-gray-600 text-xs text-center">
            Made with real podcast episodes, not AI-generated advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Final page.js with all 7 sections**

```jsx
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import FeatureShowcase from '@/components/FeatureShowcase';
import SocialProof from '@/components/SocialProof';
import DemoPreview from '@/components/DemoPreview';
import WaitlistCTA from '@/components/WaitlistCTA';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <FeatureShowcase />
      <SocialProof />
      <DemoPreview />
      <WaitlistCTA />
      <Footer />
    </main>
  );
}
```

- [ ] **Step 3: Verify** — dark footer renders, 3-column layout on desktop, stacks on mobile.

- [ ] **Step 4: Commit**

```bash
git add landing/components/Footer.jsx landing/app/page.js
git commit -m "feat(landing): Footer section — complete page with all 7 sections"
```

---

## Task 13: Full E2E Verification + Polish

**Files:**
- Possibly modify any component for fixes

- [ ] **Step 1: Full scroll test in browser**

Open http://localhost:3000 and verify each section:
1. Hero: staggered word animation, pill bounce, postcard slide-in, form submits
2. How It Works: steps stagger in, connector draws, icons animate
3. Feature Showcase: cards stagger in, hover lift works
4. Social Proof: anchor quote fades in, pills float, numbers count up
5. Demo: animation loops correctly (badge → postcard → save → dismiss)
6. Waitlist CTA: counter shows, inverted form works
7. Footer: dark, 3-col layout

- [ ] **Step 2: Mobile test**

Open Chrome DevTools → toggle device toolbar → test at 375px (iPhone SE) and 768px (iPad):
- All sections stack vertically
- Text is readable, no overflow
- Forms have 44px+ tap targets
- Postcard mockup scales down

- [ ] **Step 3: Reduced motion test**

In Chrome DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion" → "reduce":
- No floating pills
- No count-up animation (shows final number instantly)
- Demo section shows static postcard
- No stagger delays

- [ ] **Step 4: Fix any issues found**

Address bugs, alignment issues, or animation glitches.

- [ ] **Step 5: Commit**

```bash
git add -A landing/
git commit -m "fix(landing): E2E polish — mobile, reduced motion, animation fixes"
```

---

## Task 14: Deploy to Vercel

- [ ] **Step 1: Verify Vercel CLI is available**

```bash
vercel --version
```

- [ ] **Step 2: Deploy preview**

```bash
cd /Users/rajat/AntiGravity/LennyLive/landing
vercel --yes
```

When prompted for settings:
- Project name: `lennylive-landing`
- Root directory: `.` (since we're already in `landing/`)
- Framework: Next.js (auto-detected)

- [ ] **Step 3: Set environment variables on Vercel**

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Enter: https://kjbeubcbhbjrnbnztwap.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Enter: sb_publishable_H6QbLUuEBB49f-Hyf0Tybw_GT7bxwqr
```

- [ ] **Step 4: Deploy to production**

```bash
vercel --prod
```

- [ ] **Step 5: Verify production URL**

Open the Vercel URL in browser. Test:
- Page loads, all sections render
- Waitlist form submits successfully
- Dynamic counter works
- Animations play

- [ ] **Step 6: Commit any deploy config changes**

```bash
git add landing/
git commit -m "chore(landing): Vercel deployment config"
```
