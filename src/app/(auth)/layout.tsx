import React from "react";
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Sign In | Pijin Treasury Portal",
  description:
    "Authorized personnel only. This system is restricted to network administrators.",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* ── Left Panel: Illustration ─────────────────────── */}
      <section className="relative hidden w-full overflow-hidden bg-surface-raised lg:block lg:w-[60%]">
        {/* Logo */}
        <div className="absolute left-8 top-8 z-10">
          <span className="text-2xl font-semibold tracking-[0.3em] text-foreground">
            p i j i n
          </span>
        </div>

        {/* Illustration — full bleed */}
        <Image
          src="/images/login-illustration.webp"
          alt="Pijin isometric city illustration"
          fill
          priority
          sizes="60vw"
          className="object-cover"
        />
      </section>

      {/* ── Right Panel: Auth Content ────────────────────── */}
      <section className="flex w-full flex-col items-center justify-between bg-surface px-6 py-12 lg:px-16 lg:py-16 xl:px-24 lg:w-[40%]">
        {/* Mobile logo — visible only on small screens */}
        <div className="mb-8 lg:hidden">
          <span className="text-2xl font-semibold tracking-[0.3em] text-foreground">
              p i j i n
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Auth form slot */}
        {children}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-muted-foreground/65 tracking-wide">
          © 2026 pijin Technologies, Inc. All rights reserved.
          <div className="mt-2 flex justify-center gap-3 text-muted-foreground/50">
            <a href="#" className="transition-colors hover:text-foreground hover:underline">
              Privacy Policy
            </a>
            <span>•</span>
            <a href="#" className="transition-colors hover:text-foreground hover:underline">
              Terms of Service
            </a>
          </div>
        </footer>
      </section>
    </main>
  );
}
