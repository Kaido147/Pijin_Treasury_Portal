import { Suspense } from "react";
import { LoginForm } from "@/components/domain/auth/LoginForm";
import { SecurityNotice } from "@/components/domain/auth/SecurityNotice";

export default function LoginPage() {
  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div className="flex flex-col gap-8 py-8">
        {/* Heading */}
        <div className="flex flex-col gap-3 text-center lg:text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Sign In
          </h1>
          <p className="text-sm text-muted-foreground/90 leading-relaxed">
            Authorized personnel only. This system is restricted to network
            administrators. Contact your IT department to request access
            credentials.
          </p>
        </div>

        {/* Interactive form — Client Component boundary */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        {/* Security disclaimer — static, server-rendered */}
        <SecurityNotice />
      </div>
    </div>
  );
}


