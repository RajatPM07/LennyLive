export default function Footer() {
  return (
    <footer className="bg-dark py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.svg" alt="" width={36} height={36} className="opacity-80" />
            <div>
              <p className="text-white font-serif text-xl font-bold mb-0.5">Lenny Live</p>
              <p className="text-gray-500 text-sm">Compounded experience. Borrowed intuition.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 text-center">
            <p className="text-gray-500 text-sm">
              Built for the Lenny Rachitsky Data Challenge 2026
            </p>
            <span className="hidden sm:inline text-gray-700">·</span>
            <p className="text-gray-500 text-sm">
              Built by Rajat Sharma, Mumbai
            </p>
          </div>
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
