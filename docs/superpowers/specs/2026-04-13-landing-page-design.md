# Lenny Live — Landing Page Design Spec

**Date:** 2026-04-13
**Status:** Approved
**Author:** Rajat + Claude

---

## Overview

A conversion-focused landing page for Lenny Live — a Chrome extension that brings Lenny Rachitsky's voice and wisdom into a PM's workflow. The page targets early-stage PMs (0–3 years) and drives waitlist email signups ahead of the April 15, 2026 launch.

**Tone:** Playful, energetic, interactive — think Duolingo meets product tool.
**Primary CTA:** Waitlist email capture (appears twice: hero + bottom).

---

## Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Components:** 21st.dev component library (React + Tailwind)
- **Deployment:** Vercel
- **Email storage:** Supabase `waitlist` table
- **Location:** `landing/` directory within the LennyLive repo (separate from the extension codebase)

---

## Visual Identity

| Element | Value |
|---------|-------|
| Background | Warm cream `#fdfcf6` |
| Primary accent | Orange `#ff6e40` |
| Dark accent | Burnt orange `#a23f1d` |
| Text primary | `#1a1c1c` |
| Text muted | `#5e5e5e` |
| CTA section bg | `#ff6e40` (orange) |
| Footer bg | `#1a1a1a` |
| Social proof bg | Light orange tint `#fff8f5` |
| Serif font | Georgia (headlines, quotes, editorial) |
| Sans font | System stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`) |
| Border radius | 16px cards, 12px inputs, 999px pills |

---

## Sections

### 1. Hero (full viewport height)

**Layout:** Centered content, full viewport height. Cream background.

**Content:**
- **Eyebrow pill badge:** "Powered by 300+ Lenny Podcast episodes" (subtle bounce-in animation)
- **Headline:** "Compounded experience. Borrowed intuition." (large, bold, staggered word fade-up at 0.1s per word)
- **Subtitle:** "An ambient Chrome extension that brings Lenny Rachitsky's voice into your PM workflow — exactly when you need it." (fade-in at 0.5s delay)
- **Waitlist input:** Email field + orange CTA button "Join the waitlist" (slides up at 0.6s delay)
- **Hero visual:** Animated mockup of the Lenny postcard sliding in from bottom-right with spring physics (0.8s delay). Blurred Notion-like background behind it.

**Animations:**
- Pill badge: bounce-in (0.3s)
- Headline words: staggered fade-up (0.1s per word)
- Subtitle: fade-in (0.5s delay)
- Input: slide-up (0.6s delay)
- Postcard mockup: slide in from bottom-right with spring physics (0.8s delay)

**Interactions:**
- Empty submit → playful shake + inline error "Enter your email first!"
- Invalid email → inline validation, burnt orange (`#a23f1d`) error text (WCAG AA compliant on cream)
- Success → confetti burst animation + "You're in! We'll be in touch." message
- Duplicate email → "You're already on the list!" with checkmark (not an error)

---

### 2. How It Works (3 steps)

**Layout:** 3 columns on desktop, stacked on mobile. Dotted animated connector line links the 3 steps.

**Steps:**

1. **"Read or write — just work"**
   - Icon: split screen showing highlighted text + cursor typing
   - Description: "Work in Notion, Google Docs, Linear, or Jira. Lenny senses PM moments whether you're drafting a PRD or reviewing a strategy doc."

2. **"Lenny appears"**
   - Icon: orange badge pill animating in
   - Description: "When you hit retention, prioritization, GTM, or any PM concept — a gentle nudge appears. Double-tap Ctrl anytime to ask directly."

3. **"Listen & learn"**
   - Icon: postcard with sound waves
   - Description: "Hear real stories from 300+ product leaders. One insight, one voice, exactly when your brain is in the problem."

**Animations:**
- Each step: fade + slide-up on scroll (staggered 0.2s)
- Connector line: draws itself as user scrolls into view
- Icons: subtle loop animations (cursor blinks, pill pulses, sound waves oscillate)

**Style:** Large step numbers (1, 2, 3) in orange with a playful hand-drawn circle. Georgia/serif for step titles, sans-serif for descriptions.

---

### 3. Feature Showcase (2×2 grid)

**Layout:** 2×2 grid on desktop, stacked on mobile. White card backgrounds on cream page.

**Cards:**

1. **"Real voices, not AI slop"**
   - Icon: microphone with sound waves
   - "Every insight comes from a real guest on a real episode. Lenny's voice delivers it. Zero hallucination."

2. **"Ambient, not annoying"**
   - Icon: eye with a gentle glow
   - "No popups, no chat windows. A quiet nudge in the corner — only when it's relevant to what you're working on."

3. **"300+ episodes distilled"**
   - Icon: library/bookshelf
   - "280 curated moments from guests like Shreyas Doshi, Shishir Mehrotra, Reforge founders — searchable by your context."

4. **"Works where you work"**
   - Icon: grid of logos (Notion, Google Docs, Linear, Jira)
   - "Notion, Google Docs, Linear, Jira — and any text editor on the web."

**Animations:**
- Cards stagger in on scroll (0.15s apart)
- Hover: card lifts (translateY -4px) + shadow increase + icon playful bounce
- Subtle orange gradient border on hover

**Style:** White backgrounds, 16px rounded corners, orange accent icons.

---

### 4. Social Proof

**Layout:** Full-width, light orange tint background (`#fff8f5`).

**Content:**
- **Headline:** "Wisdom from the best in product" (centered, serif)
- **Anchor quote:** One large, powerful pull quote centered prominently — sourced from the real corpus (e.g., a Shreyas Doshi insight on product sense). Georgia italic, 24px+, with guest attribution below. This grounds the floating pills with actual authority.
- **Guest name pills:** 15–20 floating/bouncing pill badges with real guest names from the corpus. Each pill drifts with a gentle sine-wave motion on different phases (organic, not robotic). Pills orbit around the anchor quote.
- **Stats row (3 big numbers):**
  - "300+" — episodes indexed
  - "280+" — curated PM moments
  - "50+" — product leaders featured

**Animations:**
- Anchor quote: fade-in + slight scale-up on scroll
- Guest pills: gentle sine-wave floating motion (randomized phases)
- Stats: count-up animation when scrolled into view (0 → target over 1.5s)
- Section: soft fade-in

---

### 5. Demo/Preview

**Layout:** Centered, full-width, generous padding. Cream background.

**Content:**
- **Headline:** "See it in action" (centered)
- **Animated mockup:** Stylized browser window with a blurred Notion-like page inside. Animation sequence on ~8s loop:
  1. Orange badge pill appears ("Lenny has thoughts →")
  2. Postcard slides in from bottom-right (pull quote, guest name, episode title)
  3. Sound wave animation plays on postcard
  4. Save button clicked → checkmark appears
  5. Postcard auto-dismisses
  6. Pause, then loop restarts

**Implementation:** Pure CSS/Framer Motion animation — no video, no GIF. Crisp at any resolution.

**Style:** Browser window has subtle drop shadow + rounded corners. The Notion page inside must show **real, legible PM text** (e.g., a draft titled "Improving Day-30 Retention" with visible paragraph content about cohort analysis). This creates the "aha" moment — the user sees *why* Lenny appeared based on the visible context. The postcard insight should directly relate to the visible text (retention topic).

---

### 6. Waitlist CTA Repeat

**Layout:** Centered, tight section. Orange background (`#ff6e40`).

**Content:**
- **Headline:** "Be the first to borrow Lenny's intuition" (white, serif, large)
- **Dynamic counter:** "Join [N] PMs upgrading their workflow" — pulls real count from Supabase `waitlist` table. Starts at 0 honestly; grows into the most powerful social proof element on the page as signups accumulate.
- **Subtitle:** "Launching April 15, 2026." (white, smaller)
- **Email input + button:** White input field, dark button "Get early access"
- **Trust line:** "Free forever. No spam. Just PM wisdom." (small, white, muted)

**Animations:**
- Section: subtle scale-up on scroll (1.0 → 1.02)
- Input field: soft white glow pulse
- Success: same confetti burst as hero

**Same validation behavior as hero** (empty, invalid, duplicate handling).

---

### 7. Footer

**Layout:** Dark background (`#1a1a1a`). Minimal.

**Content:**
- **Left:** "Lenny Live" wordmark + tagline "Compounded experience. Borrowed intuition." (muted gray)
- **Center:** "Built for the Lenny Rachitsky Data Challenge 2026"
- **Right:** "Built by Rajat Sharma, Mumbai" + GitHub link
- **Bottom line:** "Made with real podcast episodes, not AI-generated advice." (small, muted)

**Style:** No animation. Quiet, grounded.

---

## Database

### `waitlist` table (Supabase)

```sql
create table if not exists waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  created_at  timestamptz not null default now()
);
```

- `email` has a unique constraint → duplicate submissions return a friendly message, not an error.
- API routes:
  - `POST /api/waitlist` — validates email format server-side, inserts into Supabase, returns `{ status: 'success' | 'duplicate' | 'error' }`.
  - `GET /api/waitlist/count` — returns `{ count: N }` from Supabase. Used by the bottom CTA's dynamic counter. Cached with 60s revalidation.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Empty email submit | Shake animation + "Enter your email first!" inline |
| Invalid email format | Inline validation, burnt orange (`#a23f1d`) error text for WCAG AA compliance, no submit |
| Duplicate email | "You're already on the list!" + checkmark (not error) |
| Mobile | All sections stack, guest pills reduced to 8–10, browser mockup scales down, 44px min tap targets |
| Slow connection | Fonts async with system fallbacks, no layout shift, animations trigger after paint |
| `prefers-reduced-motion` | Floating pills stop, count-ups instant, postcard loop disabled, fade-ins become instant |
| Supabase down | Graceful error: "Something went wrong. Try again in a moment." — no stack trace exposed |
| Very long email | Truncate at 320 chars server-side, input has `maxLength={320}` |

---

## Guest Names for Social Proof Pills

Source from the corpus (real guests):
Shreyas Doshi, Shishir Mehrotra, Gokul Rajaram, Bangaly Kaba, Casey Winters, Elena Verna, Deb Liu, Jeff Weinstein, Maggie Crowley, Lenny Rachitsky, Merci Victoria Grace, Nikita Bier, Paul Adams, Ravi Mehta, Scott Belsky, Jackie Bavaro, Mihika Kapoor, Wes Kao, Adam Nash, Julie Zhuo

---

## File Structure

```
landing/
├── app/
│   ├── layout.js
│   ├── page.js
│   ├── globals.css
│   └── api/
│       └── waitlist/
│           └── route.js        # POST handler → Supabase insert
├── components/
│   ├── Hero.jsx
│   ├── HowItWorks.jsx
│   ├── FeatureShowcase.jsx
│   ├── SocialProof.jsx
│   ├── DemoPreview.jsx
│   ├── WaitlistCTA.jsx
│   ├── Footer.jsx
│   ├── WaitlistForm.jsx        # Shared email form (used in Hero + CTA)
│   ├── PostcardMockup.jsx      # Animated postcard for hero + demo
│   └── CountUp.jsx             # Animated number counter
├── lib/
│   └── supabase.js             # Supabase client init
├── public/
│   └── (icons, OG image)
├── tailwind.config.js
├── next.config.js
├── package.json
└── .env.local                  # SUPABASE_URL, SUPABASE_ANON_KEY
```

---

## Out of Scope

- Chrome Web Store link (not published yet)
- Pricing section (free product)
- Blog / changelog
- Login / dashboard
- Analytics integration (separate task)
