import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Niragni — Offline AI for wildfire report drafting',
  description: 'Niragni drafts wildfire (karhutla) observation reports on-device with QVAC. No internet, no server. AI Yako · Offline AI Apps.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
