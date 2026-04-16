export const metadata = {
  title: 'Privacy Policy — Lenny Live',
  description:
    'How Lenny Live handles the text you highlight, what leaves your browser, and what stays local.',
};

const LAST_UPDATED = 'April 15, 2026';
const CONTACT_EMAIL = 'sharma.rajat70@gmail.com';

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-cream text-text-primary pt-20">
      <div className="max-w-2xl mx-auto px-6 py-16 md:py-24">
        <header className="mb-12">
          <p className="text-xs uppercase tracking-[0.14em] text-orange-dark font-semibold mb-4">
            Privacy Policy
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight tracking-tight mb-4">
            What leaves your browser, and what stays put.
          </h1>
          <p className="text-text-muted text-sm">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="prose-lenny space-y-10 text-[17px] leading-[1.7]">
          <section>
            <p className="text-text-muted">
              Lenny Live is a Chrome extension that surfaces real insights from
              Lenny Rachitsky&apos;s podcast archive while you work. This page
              explains exactly what data the extension handles, where it goes,
              and what stays on your device. We wrote it the way we&apos;d want
              to read it.
            </p>
          </section>

          <Section title="TL;DR">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                The extension only acts when you explicitly activate it —
                highlighting text and clicking our dot, clicking the
                &ldquo;Lenny has thoughts&rdquo; pill, or double-tapping Ctrl.
              </li>
              <li>
                On activation, the text you selected (plus a small amount of
                surrounding context) is sent to our retrieval pipeline so we
                can match it to a relevant insight and narrate it.
              </li>
              <li>
                Your saved insights, XP, streaks, and preferences live in your
                browser&apos;s local storage. They never leave your device.
              </li>
              <li>
                We do not collect your name, email, browsing history, location,
                or any personally identifiable information.
              </li>
              <li>We do not sell or transfer user data to third parties.</li>
            </ul>
          </Section>

          <Section title="What data we handle">
            <p>
              <strong>Selected text and surrounding context</strong> — when you
              activate the extension, we read the text you have selected and a
              small amount of context around it (the paragraph you are typing
              in, or the element you selected from). This is used only to
              retrieve a relevant insight and generate audio narration.
            </p>
            <p>
              <strong>Anonymous usage identifier</strong> — a random, locally
              generated ID (stored in your browser) is used to keep your saved
              insights library, XP, and streak separate from other users of
              the same backend. It is not tied to your name, email, Google
              account, or any identifier you use elsewhere.
            </p>
            <p>
              <strong>Engagement events (optional, analytics)</strong> — if
              product analytics are enabled, we record anonymous events such
              as &ldquo;extension activated,&rdquo; &ldquo;insight saved,&rdquo;
              or &ldquo;source opened.&rdquo; These events do not contain the
              text you selected or any personal information. They help us
              understand which parts of the extension are useful.
            </p>
            <p>
              <strong>Saved insights, XP, streaks, preferences</strong> —
              stored in your browser via <code>chrome.storage.local</code>.
              This data stays on your device.
            </p>
          </Section>

          <Section title="What we do not collect">
            <ul className="list-disc pl-5 space-y-2">
              <li>Your name, email address, or any account identifier.</li>
              <li>Your browsing history or list of visited pages.</li>
              <li>
                The content of pages you have not explicitly activated the
                extension on.
              </li>
              <li>Passwords, authentication tokens, or payment information.</li>
              <li>Your location, IP-derived geodata, or device identifiers.</li>
              <li>Keystrokes, mouse movements, or screen recordings.</li>
            </ul>
          </Section>

          <Section title="Who we share data with">
            <p>
              To retrieve and narrate an insight, the text you select is sent
              to the following service providers, strictly for the purpose of
              processing that single request:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Google AI</strong> — generates a numerical embedding
                of your selected text so we can find semantically similar
                podcast moments.
              </li>
              <li>
                <strong>Groq</strong> — classifies whether the page is
                PM-related and abstracts the selection into a cleaner query.
              </li>
              <li>
                <strong>Supabase</strong> — stores the embedded podcast
                archive and runs the vector search that returns the matching
                insight.
              </li>
              <li>
                <strong>ElevenLabs</strong> — converts the selected insight
                into an audio clip narrated in Lenny&apos;s voice (used with
                his explicit permission).
              </li>
              <li>
                <strong>PostHog</strong> (if analytics are enabled) — records
                anonymous product-usage events as described above.
              </li>
            </ul>
            <p>
              We do not sell, rent, or transfer user data to third parties for
              their own marketing, advertising, or modeling purposes. The
              providers listed above act as data processors on our behalf.
            </p>
          </Section>

          <Section title="How long we keep data">
            <p>
              Queries sent to the retrieval pipeline are processed in real
              time and are not durably stored alongside your identifier.
              Analytics events, if enabled, are retained by PostHog for up to
              12 months and then deleted.
            </p>
            <p>
              Anything stored locally in your browser (saved insights, XP,
              streaks, preferences) is removed the moment you uninstall the
              extension or clear your browser storage.
            </p>
          </Section>

          <Section title="Your choices">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                You can mute the voice narration and disable streak
                notifications from the extension popup.
              </li>
              <li>
                You can delete all local data at any time by removing the
                extension from Chrome.
              </li>
              <li>
                You can opt out of audio generation by keeping the extension
                muted; retrieval will still work silently.
              </li>
            </ul>
          </Section>

          <Section title="Children">
            <p>
              Lenny Live is intended for working product managers and is not
              directed at children under 13. We do not knowingly collect data
              from children.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              If we make material changes to how the extension handles data,
              we will update this page and bump the &ldquo;Last updated&rdquo;
              date at the top. Continued use of the extension after a change
              means you accept the updated policy.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions, concerns, or deletion requests:{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-orange-dark underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <footer className="mt-20 pt-8 border-t border-text-primary/10">
          <p className="text-xs text-text-muted">
            Lenny Live — Built by Rajat Sharma for the Lenny Rachitsky Data
            Challenge, April 2026.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-serif text-2xl md:text-[28px] tracking-tight mb-4">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
