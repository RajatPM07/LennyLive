# Lenny Live — Full Website Design Spec

**Date:** 2026-04-16
**Author:** Rajat + Claude
**Status:** Approved

---

## Overview

Transform the existing Lenny Live landing page + privacy page into a full product website where users can download the extension, learn to install it, and understand how to use it. The site should feel like a premium editorial publication — warm, authoritative, and distinctly not-generic-AI.

## Current State

- **Landing page** (`/`) — Hero, HowItWorks, FeatureShowcase, SocialProof, DemoPreview, WaitlistCTA, Footer
- **Privacy page** (`/privacy`) — Long-form policy with editorial styling
- **Stack:** Next.js 16 App Router, Tailwind v4, Framer Motion, JSX components
- **Design tokens:** cream `#fdfcf6`, orange `#ff6e40`, orange-dark `#a23f1d`, dark `#1a1a1a`, text-primary `#1a1c1c`, text-muted `#5e5e5e`, proof `#fff8f5`
- **Typography:** Georgia serif headings, system-ui sans body
- **Motion:** Framer Motion spring physics, scroll-triggered reveals, animated SVG icons

## New Pages

### 1. Download Page (`/download`)

**Purpose:** Single clear action — download the extension zip.

**Content:**
- Section hero: "Get Lenny Live" headline, short subtitle about what they're downloading
- Primary CTA: large download button with version (1.0.0), file size (49KB), Chrome icon
- Requirements pill: "Requires Chrome 120+ on macOS, Windows, or Linux"
- What's included: brief 3-item list (312 curated moments, Lenny's voice, gamification)
- Next step nudge: "Downloaded? Follow the install guide →" link to `/install`

**Download source:** Static asset at `/lenny-live-1.0.0.zip` in Next.js `/public` folder. Direct `<a href download>`.

**Design notes:**
- The download button should be bold and impossible to miss (`/bolder`)
- Minimal page — don't bury the CTA under content
- Warm illustration or the PostcardMockup component as visual anchor

### 2. Installation Guide (`/install`)

**Purpose:** Step-by-step visual walkthrough to install the Chrome extension from a zip file.

**Steps:**
1. Download the zip (link back to `/download` if they haven't)
2. Unzip the file — show Finder/Explorer with the extracted folder
3. Open `chrome://extensions` in Chrome — show browser URL bar mockup
4. Enable "Developer mode" toggle — show the toggle in top-right
5. Click "Load unpacked" — show the button
6. Select the unzipped `LennyLive/` folder — show file picker
7. Pin the extension — show the puzzle-piece icon → pin action
8. Success state — "You're ready!" with the extension icon visible in toolbar

**Design notes:**
- Each step: number badge (left) + coded browser mockup (center, styled divs like DemoPreview — NOT static screenshots) + instruction text (right), alternating layout on desktop (`/layout`)
- Browser mockups styled like the existing DemoPreview component (gray chrome bar, traffic lights, URL bar)
- Progressive reveal: steps animate in on scroll (`/animate`, `/design-motion-principles`)
- Step 8 gets a celebratory moment — subtle glow or confetti (`/delight`)
- Mobile: single column, illustration above text
- "Having trouble?" footer with link to email support

### 3. Getting Started Guide (`/guide`)

**Purpose:** Teach users how to use the extension after installing it.

**Sections:**

**A. The Selection Dot**
- Explain: highlight PM-related text on any page → orange dot appears at selection
- Animated demo (like DemoPreview): show text being selected, dot appearing, click → postcard slides in
- Key detail: works on Notion, Google Docs, Linear, Jira, any web page

**B. The Write+Pause Badge**
- Explain: typing in a text editor, pause for 1.5s → "Lenny has thoughts" pill appears
- Animated demo: show typing in a Notion-like editor, pause, pill slides up

**C. Double-Tap Ctrl**
- Explain: anytime shortcut, 300ms window
- Simple icon + text — no complex animation needed

**D. The Postcard**
- Explain: the insight card that appears — real quote, real guest, real episode
- Show the PostcardMockup with labels pointing to each part (guest name, quote, save button, audio waveform, source link)

**E. Save, Streak, Level Up**
- Explain gamification: save insights → earn XP → build streaks → level up from Intern to Group PM
- Show the PM level progression (visual bar or badge strip)
- Show the popup knowledge map preview

**F. The Popup**
- Explain: click the extension icon → library of saved insights, knowledge map, search
- Screenshot or mockup of the popup

**Design notes:**
- Each section is a full-width content block with animated demo + explanation
- Alternating layout: demo left/text right, then text left/demo right (`/layout`)
- Scroll-based progressive disclosure — don't show everything at once
- Warm, encouraging tone: "Here's where it gets fun" not "Step 3: Configure"

### 4. Shared Navigation

**Structure:**
- Sticky top bar, transparent on hero → solid cream on scroll
- Left: Logo (link to `/`)
- Center: Home, Download, Install, Guide, Privacy
- Right: Primary "Download" CTA button (orange pill)
- Mobile: hamburger menu with slide-out panel

**Design notes:**
- Nav should feel light — not a heavy corporate navbar
- Active page indicator: subtle orange underline or dot
- Scroll transition: use Framer Motion for background opacity shift
- The nav wraps all pages via `layout.js`

### 5. Home Page Updates

**Changes:**
- Replace `WaitlistCTA` section with a "Download now" CTA pointing to `/download`
- Replace `WaitlistForm` in Hero with a download button + "See how it works →" secondary link to `/guide`
- Update any "coming soon" / "waitlist" copy to "available now"
- Keep all existing sections (HowItWorks, FeatureShowcase, SocialProof, DemoPreview) — they still work for a live product

## Design System Extensions

**New tokens needed:**
- `--color-code-bg`: warm-tinted code/terminal background for install guide (e.g., `#faf5ee`)
- `--color-success`: green for success states (`#22c55e` or similar)
- `--color-nav-bg`: `rgba(253, 252, 246, 0.95)` for sticky nav backdrop blur

**New shared components:**
- `NavBar` — sticky navigation
- `MobileMenu` — hamburger slide-out
- `BrowserMockup` — reusable browser chrome frame (extracted from DemoPreview patterns)
- `StepCard` — numbered step with illustration + text (for install guide)
- `AnimatedDemo` — looping state-machine demo (extracted from DemoPreview patterns)
- `PageHeader` — consistent page hero with eyebrow + headline + subtitle

**Typography scale (to be refined by `/typeset`):**
- Hero: 4xl–6xl Georgia
- Section heading: 3xl–4xl Georgia
- Subsection: xl–2xl Georgia
- Body: base system-ui
- Caption/meta: sm system-ui text-muted
- Code: sm monospace on warm background

## Technical Decisions

- All new pages under `landing/app/` (e.g., `landing/app/download/page.js`)
- All new components in `landing/components/`
- `'use client'` only for components with Framer Motion or interactivity
- Server Components for static content pages
- `next/image` not used currently (raw `<img>`) — keep consistent, don't introduce mid-build
- No new dependencies — Framer Motion + Tailwind cover everything needed
- Responsive breakpoints: 375px (mobile), 768px (tablet), 1280px (desktop)
- `prefers-reduced-motion` respected on all new animations

## Page Flow (User Journey)

```
Home (/) → "Download" CTA
  ↓
Download (/download) → download zip → "Next: Install guide →"
  ↓
Install (/install) → follow steps → "You're ready! Learn how to use it →"
  ↓
Guide (/guide) → learn features → start using the extension
```

Nav is always available for non-linear navigation. Footer appears on all pages.

## Skill Usage Plan

| Phase | Skills |
|-------|--------|
| Design system setup | `/impeccable craft`, `/stitch-design-taste`, `/design-taste-frontend` |
| Per-page build | `/typeset`, `/layout`, `/colorize`, `/animate`, `/design-motion-principles`, `/delight`, `/bolder` |
| Per-page review | `/audit`, `/polish`, `/high-end-visual-design` |
| Final site review | `/critique`, `/optimize` |

## Out of Scope

- User accounts / authentication
- Server-side download tracking / analytics (PostHog will be added separately)
- Auto-update mechanism
- Chrome Web Store listing (separate effort)
- Blog / changelog pages
