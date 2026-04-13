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

        {/* Waitlist form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <WaitlistForm />
        </motion.div>
      </div>

      {/* Postcard mockup */}
      <div className="mt-12 md:absolute md:bottom-12 md:right-12">
        <PostcardMockup animate={true} />
      </div>
    </section>
  );
}
