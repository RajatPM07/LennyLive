'use client';

import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import StepCard from '@/components/StepCard';
import BrowserMockup from '@/components/BrowserMockup';
import Footer from '@/components/Footer';
import Link from 'next/link';

/* ─── Inline illustration components ─── */

function DownloadIllustration() {
  return (
    <div className="bg-white rounded-card p-6 shadow-sm border border-gray-100 text-center">
      {/* Download icon */}
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl bg-orange/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M16 4v18M10 16l6 6 6-6" stroke="#ff6e40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 26h20" stroke="#ff6e40" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <p className="font-mono text-sm font-semibold text-text-primary mb-1">lenny-live-1.0.0.zip</p>
      <p className="text-xs text-text-muted mb-3">49 KB</p>
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success text-xs font-semibold rounded-full border border-success/30">
        Downloaded ✓
      </span>
    </div>
  );
}

function UnzipIllustration() {
  return (
    <div className="flex flex-col gap-4">
      {/* Zip to folder */}
      <div className="flex items-center justify-center gap-4">
        {/* Zip file */}
        <div className="w-16 h-20 rounded-lg bg-orange/10 border border-orange/20 flex flex-col items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="2" width="16" height="20" rx="2" stroke="#ff6e40" strokeWidth="1.5" />
            <path d="M10 6h4M10 10h4M10 14h4" stroke="#ff6e40" strokeWidth="1" strokeLinecap="round" />
          </svg>
          <p className="text-[10px] text-orange font-medium mt-1">.zip</p>
        </div>
        {/* Arrow */}
        <svg width="32" height="16" viewBox="0 0 32 16" fill="none" aria-hidden="true">
          <path d="M2 8h24M22 3l5 5-5 5" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Folder */}
        <div className="w-16 h-20 rounded-lg bg-orange/10 border border-orange/20 flex flex-col items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" stroke="#ff6e40" strokeWidth="1.5" />
          </svg>
          <p className="text-[10px] text-orange font-medium mt-1">Folder</p>
        </div>
      </div>
      {/* File tree */}
      <div className="bg-code-bg rounded-lg p-4 font-mono text-xs leading-6 text-text-muted border border-orange/10">
        <p className="text-text-primary font-semibold">LennyLive/</p>
        <p className="pl-4">manifest.json</p>
        <p className="pl-4">background/</p>
        <p className="pl-4">content/</p>
        <p className="pl-4">popup/</p>
        <p className="pl-4">data/</p>
      </div>
    </div>
  );
}

function ChromeExtensionsIllustration() {
  return (
    <BrowserMockup url="chrome://extensions">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h4 className="font-serif text-lg font-bold text-text-primary">Extensions</h4>
          {/* Developer mode toggle — ON state */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Developer mode</span>
            <div className="w-10 h-5 bg-orange rounded-full relative cursor-default">
              <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm" />
            </div>
          </div>
        </div>
        {/* Load unpacked button with pulse */}
        <motion.button
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="px-4 py-2 bg-white border-2 border-orange text-orange font-semibold text-sm rounded-lg shadow-sm"
        >
          Load unpacked
        </motion.button>
      </div>
    </BrowserMockup>
  );
}

function PinToolbarIllustration() {
  return (
    <div className="bg-white rounded-card p-6 shadow-sm border border-gray-100">
      {/* Toolbar area */}
      <div className="flex items-center justify-end gap-3 mb-4 pb-4 border-b border-gray-100">
        <span className="text-xs text-text-muted">Chrome toolbar</span>
        {/* Puzzle piece icon with pulse */}
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M7 1v2a2 2 0 01-2 2H3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 012 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 012-2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 01-2-2V1" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </motion.div>
      </div>
      {/* Dropdown */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-orange/5 border-l-2 border-orange">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-orange/20 flex items-center justify-center">
              <span className="text-orange text-[10px] font-bold">L</span>
            </div>
            <span className="text-sm font-semibold text-text-primary">Lenny Live</span>
          </div>
          {/* Animated pin icon */}
          <motion.div
            animate={{ rotate: [0, 15, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 2L6 6l-3 1 6 6 1-3 4-4M6 10l-4 4" stroke="#ff6e40" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 opacity-40">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gray-200" />
            <span className="text-sm text-text-muted">Other Extension</span>
          </div>
          <div className="w-4 h-4 rounded-full border border-gray-300" />
        </div>
      </div>
    </div>
  );
}

function SuccessIllustration() {
  return (
    <div className="bg-white rounded-card p-8 shadow-sm border-2 border-success/30 text-center">
      {/* Animated checkmark circle */}
      <div className="flex justify-center mb-4">
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center"
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <motion.path
              d="M12 20l6 6 10-12"
              stroke="#22c55e"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>
      </div>
      <p className="font-serif text-xl font-bold text-text-primary mb-1">You&apos;re all set!</p>
      <p className="text-sm text-text-muted">Lenny Live is ready to go.</p>
    </div>
  );
}

/* ─── Page ─── */

export default function InstallPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Installation Guide"
        headline="Install in under a minute."
        subtitle="No Chrome Web Store needed. Load the extension directly from the zip file."
      />

      <section className="px-6 pb-8 bg-cream">
        <StepCard
          number={1}
          title="Download the extension"
          description="Grab the latest zip file from the download page. It's a small file — under 50 KB."
          illustration={<DownloadIllustration />}
          tip="Your browser may warn about the download — click 'Keep' to proceed."
        />

        <StepCard
          number={2}
          title="Unzip the file"
          description="Extract the zip to get the LennyLive folder. Double-click on macOS or right-click → Extract on Windows."
          illustration={<UnzipIllustration />}
          tip="Keep this folder somewhere permanent — Chrome needs it to stay there."
        />

        <StepCard
          number={3}
          title="Open Chrome Extensions"
          description="Navigate to chrome://extensions in your address bar, then turn on Developer mode using the toggle in the top right."
          illustration={<ChromeExtensionsIllustration />}
          tip="You can also get there from Chrome menu → Extensions → Manage Extensions."
        />

        <StepCard
          number={4}
          title="Load the extension"
          description="Click 'Load unpacked', navigate to the LennyLive folder you extracted, and select it."
          illustration={<ChromeExtensionsIllustration />}
          tip="Select the folder itself, not a file inside it."
        />

        <StepCard
          number={5}
          title="Pin it to your toolbar"
          description="Click the puzzle piece icon in Chrome's toolbar, find Lenny Live, and click the pin icon to keep it visible."
          illustration={<PinToolbarIllustration />}
          tip="Pinning makes it easy to open your saved insights and check your PM level."
        />

        <StepCard
          number={6}
          title="You're ready!"
          description="Lenny Live is now installed. Visit any product page, select text about a PM concept, and watch the magic happen."
          illustration={<SuccessIllustration />}
          tip="Try selecting text about 'product-market fit' on any article to see your first insight."
        />
      </section>

      {/* Next step nudge */}
      <section className="py-16 px-6 bg-proof">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <p className="font-serif text-2xl font-bold text-text-primary mb-3">
              Installed? Learn how to use it.
            </p>
            <Link
              href="/guide"
              className="inline-flex items-center gap-2 text-orange font-semibold hover:text-orange-dark transition-colors"
            >
              Read the getting started guide
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Trouble section */}
      <section className="py-12 px-6 bg-cream">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-text-muted mb-2">Having trouble?</p>
          <a
            href="mailto:sharma.rajat70@gmail.com"
            className="text-orange font-semibold hover:text-orange-dark transition-colors"
          >
            Email us
          </a>
        </div>
      </section>

      <Footer />
    </main>
  );
}
