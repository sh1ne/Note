import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import OfflineChunkFallback from "@/components/common/OfflineChunkFallback";

export const metadata: Metadata = {
  title: "Note App",
  description: "A modern note-taking app for iPhone",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Temporary diagnostic: Track document navigations
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      console.warn('[NAV][beforeunload] full document navigation');
    });
  }
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <OfflineChunkFallback />
        <Providers>{children}</Providers>
        {/* Build timestamp for cache busting - helps identify if deployment updated */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__BUILD_TIMESTAMP__ = "${process.env.VERCEL_GIT_COMMIT_SHA || Date.now()}";
// Global error handler for IndexedDB VersionErrors from old cached code
// AND ChunkLoadError handler for offline black screen prevention
if (typeof window !== 'undefined') {
  // Handle unhandled promise rejections (VersionErrors from old cached code)
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.name === 'VersionError') {
      const errorMessage = event.reason.message || '';
      if (errorMessage.includes('version (2)') || errorMessage.includes('version (3)')) {
        console.warn('[Global Handler] Caught VersionError from old cached code, ignoring:', errorMessage);
        event.preventDefault(); // Prevent error from showing in console
        // The new code will handle IndexedDB properly with version 4
        return;
      }
    }
    
    // Handle ChunkLoadError (offline black screen prevention)
    if (event.reason && (event.reason.message?.includes('ChunkLoadError') || event.reason.message?.includes('Failed to fetch'))) {
      const isOffline = !navigator.onLine;
      if (isOffline) {
        console.warn('[Global Handler] ChunkLoadError while offline - showing offline fallback');
        event.preventDefault();
        // Show offline fallback UI
        const fallback = document.getElementById('offline-chunk-fallback');
        if (fallback) {
          fallback.style.display = 'block';
        }
        return;
      }
    }
  });
  
  // Also handle regular errors
  window.addEventListener('error', (event) => {
    if (event.error && event.error.name === 'VersionError') {
      const errorMessage = event.error.message || '';
      if (errorMessage.includes('version (2)') || errorMessage.includes('version (3)')) {
        console.warn('[Global Handler] Caught VersionError from old cached code, ignoring:', errorMessage);
        event.preventDefault(); // Prevent error from showing in console
        return;
      }
    }
    
    // Handle ChunkLoadError (offline black screen prevention)
    if (event.error && (event.error.message?.includes('ChunkLoadError') || event.error.message?.includes('Failed to fetch'))) {
      const isOffline = !navigator.onLine;
      if (isOffline) {
        console.warn('[Global Handler] ChunkLoadError while offline - showing offline fallback');
        event.preventDefault();
        // Show offline fallback UI
        const fallback = document.getElementById('offline-chunk-fallback');
        if (fallback) {
          fallback.style.display = 'block';
        }
        return;
      }
    }
  });
}`,
          }}
        />
      </body>
    </html>
  );
}

