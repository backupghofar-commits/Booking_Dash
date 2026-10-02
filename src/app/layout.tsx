import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TAMIMA Hotel Booking',
  description: 'TAMIMA Hotel Booking Management System — PT Tamima Jaya Wisata',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-512.png',
    apple: '/icons/icon-512.png',
  },
};

export const viewport = {
  themeColor: '#0B1F3A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="TAMIMA Hotel" />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
