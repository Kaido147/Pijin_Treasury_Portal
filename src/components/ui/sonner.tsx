"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-white group-[.toaster]:border-slate-200/80 group-[.toaster]:text-slate-900 group-[.toaster]:shadow-xl group-[.toaster]:shadow-slate-100/40 group-[.toaster]:rounded-xl group-[.toaster]:p-4",
          title: "text-slate-900 font-semibold text-sm tracking-tight",
          description: "text-slate-600 text-xs leading-relaxed mt-1",
          error: "group-[.toast]:bg-red-50/60 group-[.toast]:border-red-100 group-[.toast]:text-red-900 [&_[data-icon]]:text-red-600",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
