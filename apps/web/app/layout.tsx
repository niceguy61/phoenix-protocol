import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Phoenix Protocol',
  description: 'Infrastructure recovery verification',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
