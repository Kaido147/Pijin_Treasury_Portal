import type { Metadata } from "next";

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
      <section className="relative hidden w-full overflow-hidden bg-[#e8edf3] lg:block lg:w-1/2">
        {/* Logo */}
        <div className="absolute left-8 top-6 z-10">
          <span className="text-2xl font-bold tracking-[0.25em] text-foreground">
            p i j i n
          </span>
        </div>

        {/* Illustration — full bleed */}
        <img
          src="/images/login-illustration.png"
          alt="Pijin isometric city illustration"
          className="h-full w-full object-cover"
        />
      </section>

      {/* ── Right Panel: Auth Content ────────────────────── */}
      <section className="flex w-full flex-col items-center justify-between bg-background px-6 py-8 lg:w-1/2 lg:px-12">
        {/* Mobile logo — visible only on small screens */}
        <div className="mb-8 lg:hidden">
          <span className="text-2xl font-bold tracking-[0.25em] text-foreground">
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
        <footer className="mt-8 text-center text-xs text-muted-foreground">
          © 2026 pijin Technologies, Inc. All rights reserved. |{" "}
          <a href="#" className="hover:underline">
            Privacy Policy
          </a>{" "}
          |{" "}
          <a href="#" className="hover:underline">
            Terms of Service
          </a>
        </footer>
      </section>
    </main>
  );
}
