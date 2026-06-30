import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { WalletProvider } from "@/core/providers/WalletProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pijin Treasury Portal",
  description:
    "Universal Web3 Liquidity Admin Interface for the Pijin Network. Manage gateway nodes, distribute liquidity, and monitor transactions on the Stellar network.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <WalletProvider>
          {children}
        </WalletProvider>
        <Toaster />
      </body>
    </html>
  );
}
