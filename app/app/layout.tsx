import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOL MEME TRENCHES",
  description:
    "Live Solana meme coin radar for volume acceleration, liquidity quality, and verifiable security signals.",
  applicationName: "SOL MEME TRENCHES",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
