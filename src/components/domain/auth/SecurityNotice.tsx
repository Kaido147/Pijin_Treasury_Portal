import { Lock } from "lucide-react";

export function SecurityNotice() {
  return (
    <div className="flex gap-3 rounded-lg border border-border p-4">
      <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">
          Security Notice:
        </span>{" "}
        All active sessions are end-to-end encrypted and continuously logged
        for auditing purposes. Unauthorized access attempts violate company
        policy and will be flagged immediately.
      </p>
    </div>
  );
}
