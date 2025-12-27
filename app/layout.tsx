import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        {/* Build timestamp for cache busting - helps identify if deployment updated */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__BUILD_TIMESTAMP__ = "${process.env.VERCEL_GIT_COMMIT_SHA || Date.now()}";
// Global error handler for IndexedDB VersionErrors from old cached code
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
  });
}`,
          }}
        />
      </body>
    </html>
  );
}

