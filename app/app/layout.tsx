import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Solana Token Tarayıcı',
  description:
    'DexScreener + RugCheck verisiyle Solana tokenlarını hacim, momentum ve güvenlik kriterlerine göre tarayan dashboard.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-base text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
