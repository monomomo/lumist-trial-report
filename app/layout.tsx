import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '路觅教育｜试听课报告生成器',
  description: '路觅教育老师端试听课报告生成器'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
