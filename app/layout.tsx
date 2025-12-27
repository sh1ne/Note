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
            __html: `window.__BUILD_TIMESTAMP__ = "${process.env.VERCEL_GIT_COMMIT_SHA || Date.now()}";`,
          }}
        />
      </body>
    </html>
  );
}

