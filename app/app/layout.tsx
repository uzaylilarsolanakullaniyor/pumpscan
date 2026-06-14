import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PumpScan',
  description:
    'Scan Solana tokens by volume, momentum and safety — powered by DexScreener + RugCheck.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="relative min-h-screen overflow-x-hidden bg-base text-slate-200 antialiased">
        {/* Ambient gradient blobs — camın kıracağı renkli arka plan */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-[36rem] w-[36rem] rounded-full bg-[#7c3aed]/25 blur-[120px]" />
          <div className="absolute -right-40 top-20 h-[32rem] w-[32rem] rounded-full bg-[#14f195]/20 blur-[130px]" />
          <div className="absolute bottom-[-12rem] left-1/3 h-[34rem] w-[34rem] rounded-full bg-[#06b6d4]/15 blur-[140px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
