"use client";

import { useSearchParams } from "next/navigation";
import ResetPasswordForm from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const shopifyResetUrl = searchParams.get("url");

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <ResetPasswordForm shopifyResetUrl={shopifyResetUrl} />
    </div>
  );
}
