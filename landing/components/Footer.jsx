export default function Footer() {
  return (
    <footer className="bg-dark py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="text-center md:text-left">
            <p className="text-white font-serif text-xl font-bold mb-1">Lenny Live</p>
            <p className="text-gray-500 text-sm">Compounded experience. Borrowed intuition.</p>
          </div>

          <p className="text-gray-500 text-sm text-center">
            Built for the Lenny Rachitsky Data Challenge 2026
          </p>

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
