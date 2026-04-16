/**
 * Reusable browser chrome frame — renders children inside a macOS-style browser window.
 */
export default function BrowserMockup({ url, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden ${className}`}>
      {/* Chrome bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-yellow-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        <div className="ml-2 flex-1 max-w-sm">
          <div className="bg-white rounded-md px-3 py-1 text-xs text-text-muted border border-gray-200 truncate">
            {url}
          </div>
        </div>
      </div>
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
