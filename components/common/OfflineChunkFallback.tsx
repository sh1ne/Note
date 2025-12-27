'use client';

export default function OfflineChunkFallback() {
  return (
    <div
      id="offline-chunk-fallback"
      style={{ display: 'none' }}
      className="fixed inset-0 bg-black text-white flex items-center justify-center z-50 p-4"
    >
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-4">⚠️ Offline</h1>
        <p className="mb-4">
          You're offline and this page isn't cached. Please go back to a page you've visited before, or go online to load this page.
        </p>
        <button
          onClick={() => {
            window.history.back();
            const fallback = document.getElementById('offline-chunk-fallback');
            if (fallback) {
              fallback.style.display = 'none';
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

