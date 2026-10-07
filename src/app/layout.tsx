import type { Metadata, Viewport } from 'next';

// Self-hosted variable fonts — only the weight axis, latin ranges.
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/source-serif-4/wght.css';
import './globals.css';

import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.organisation} — ${siteConfig.programName}`,
    template: `%s · ${siteConfig.organisation}`,
  },
  description: siteConfig.supportingMessage,
  applicationName: siteConfig.organisation,
  keywords: [
    'Final Year Project',
    'Innovation Development Program',
    'GIZMO DAN KAITA OFFICE PLUS',
    'entrepreneurship',
    'youth development',
    'community development',
  ],
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#142539',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-NG">
      <body className="flex min-h-dvh flex-col antialiased">
        {/* Keyboard users can jump straight past the navigation. */}
        <a
          href="#main-content"
          className="sr-only-focusable fixed left-4 top-4 z-50 rounded-md bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
