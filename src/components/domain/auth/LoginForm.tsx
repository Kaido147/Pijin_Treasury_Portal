"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { loginSchema, type LoginFormValues } from "@/core/validators/auth";
import { createClient } from "@/infrastructure/supabase/client";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: LoginFormValues) {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      form.setError("root", {
        message: error.message,
      });
      return;
    }

    // Redirect to original destination or dashboard
    const next = searchParams.get("next") || "/command-center";
    router.push(next);
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Email Field */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-xs font-semibold tracking-wider text-muted-foreground/80 uppercase">
                Work Email Address
              </FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="admin@pijin.com"
                  autoComplete="email"
                  className="h-12 px-4 text-base transition-all focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password Field */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-xs font-semibold tracking-wider text-muted-foreground/80 uppercase">
                Password
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••••••••••"
                  autoComplete="current-password"
                  className="h-12 px-4 text-base transition-all focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Keep signed in + Forgot password row */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="keep-signed-in"
              checked={keepSignedIn}
              onCheckedChange={(checked) =>
                setKeepSignedIn(checked === true)
              }
            />
            <Label
              htmlFor="keep-signed-in"
              className="cursor-pointer text-sm font-normal text-muted-foreground transition-colors hover:text-foreground"
            >
              Keep me signed in
            </Label>
          </div>
          <a
            href="#"
            className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            Forgot Password?
          </a>
        </div>

        {/* Root-level auth error */}
        {form.formState.errors.root && (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        {/* Submit */}
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base font-semibold tracking-wide bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm transition-all active:scale-[0.99]"
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Sign In Securely
        </Button>
      </form>
    </Form>
  );
}
