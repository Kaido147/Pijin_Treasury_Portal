import type { Metadata } from "next";
import DashboardShell from "./DashboardShell";
import { WalletProvider } from "@/core/providers/WalletProvider";

export const metadata: Metadata = {
  title: "Pijin Treasury Portal — Dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <DashboardShell>{children}</DashboardShell>
    </WalletProvider>
  );
}
