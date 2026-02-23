import type { Metadata } from 'next';
import './globals.css';
import 'highlight.js/styles/github-dark-dimmed.css';

export const metadata: Metadata = {
  title: 'AI 챗봇',
  description: 'Claude AI 기반 개인 비서 챗봇',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
