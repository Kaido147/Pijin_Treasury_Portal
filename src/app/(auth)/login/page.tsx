import { Suspense } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { LoginForm } from "@/components/domain/auth/LoginForm";
import { SecurityNotice } from "@/components/domain/auth/SecurityNotice";

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md border shadow-[var(--shadow-card)]">
      <CardContent className="flex flex-col gap-6 px-10 py-10">
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Sign In</h1>
          <p className="mt-2 text-sm text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}
