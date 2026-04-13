'use client';

import { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import confetti from 'canvas-confetti';

// Hoisted outside component — RegExp is only constructed once (js-hoist-regexp)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * WaitlistForm — shared email capture form.
 *
 * variant: 'default'  → cream background context (white input + orange button)
 * variant: 'inverted' → orange background context (white input + dark button)
 */
export default function WaitlistForm({ variant = 'default' }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | duplicate | error
  const [errorMsg, setErrorMsg] = useState('');
  const controls = useAnimation();

  const isInverted = variant === 'inverted';

  function isValidEmail(value) {
    return EMAIL_RE.test(value.trim());
  }

  async function shake(message) {
    setErrorMsg(message);
    await controls.start({
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.4, ease: 'easeInOut' },
    });
  }

  function fireConfetti() {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff6e40', '#f59e0b', '#fbbf24', '#fde68a', '#1a1a1a'],
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Empty check
    if (!email.trim()) {
      shake('Enter your email first!');
      return;
    }

    // Format check
    if (!isValidEmail(email)) {
      shake("That doesn't look like an email address.");
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (res.status === 409 || data?.duplicate) {
        setStatus('duplicate');
        return;
      }

      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data?.message || 'Something went wrong. Try again in a moment.');
        return;
      }

      setStatus('success');
      fireConfetti();
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Try again in a moment.');
    }
  }

  // ── Post-submit states ──────────────────────────────────────────────────────

  if (status === 'success') {
    return (
      <p className={`text-center font-sans text-base font-medium ${isInverted ? 'text-white' : 'text-text-primary'}`}>
        🎉 You&apos;re in! We&apos;ll be in touch.
      </p>
    );
  }

  if (status === 'duplicate') {
    return (
      <p className={`text-center font-sans text-base font-medium ${isInverted ? 'text-white' : 'text-text-primary'}`}>
        ✓ You&apos;re already on the list!
      </p>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-md mx-auto">
      <motion.form
        animate={controls}
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col sm:flex-row gap-3"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errorMsg) setErrorMsg('');
          }}
          placeholder="your@email.com"
          maxLength={320}
          disabled={status === 'loading'}
          className={[
            'flex-1 min-w-0 px-4 py-3 text-sm font-sans rounded-input outline-none',
            'focus:ring-2 focus:ring-orange/50 transition-shadow',
            isInverted
              ? 'bg-white text-text-primary placeholder:text-text-muted shadow-md border-0'
              : 'bg-white text-text-primary placeholder:text-text-muted border border-gray-200',
            'disabled:opacity-60',
          ].join(' ')}
        />

        <button
          type="submit"
          disabled={status === 'loading'}
          className={[
            'px-6 py-3 text-sm font-sans font-semibold rounded-input whitespace-nowrap',
            'transition-opacity disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed',
            isInverted
              ? 'bg-dark text-white hover:opacity-90'
              : 'bg-orange text-white hover:opacity-90',
          ].join(' ')}
        >
          {status === 'loading'
            ? 'Joining...'
            : isInverted
            ? 'Get early access'
            : 'Join the waitlist'}
        </button>
      </motion.form>

      {/* Error message */}
      {errorMsg && (
        <p
          role="alert"
          className={`mt-2 text-xs font-sans text-center ${
            isInverted ? 'text-red-200' : 'text-[#a23f1d]'
          }`}
        >
          {errorMsg}
        </p>
      )}
    </div>
  );
}
