"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const resetPasswordSchema = z
  .object({
    password: z.string().min(5, "Password must be at least 5 characters"),
    confirm: z.string().min(5, "Password must be at least 5 characters"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
  shopifyResetUrl: string | null;
}

export default function ResetPasswordForm({
  shopifyResetUrl,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirm: "",
    },
  });

  if (!shopifyResetUrl) {
    return (
      <Card
        className="
       max-w-xl w-full
       border-none
      px-6 py-16
      md:shadow md:border 
      md:px-12 md:py-24
    "
      >
        <CardContent className="h-full w-full flex flex-col p-0 items-center justify-center min-h-96">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Invalid Reset Link
            </h1>
            <p className="text-gray-600 mb-6">
              The reset link is missing or has expired.
            </p>
            <Link
              href="/auth/forgot-password"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-black hover:bg-gray-800"
            >
              Request a new reset link
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (values: ResetPasswordFormValues) => {
    setStatus("loading");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopifyResetUrl, password: values.password }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("done");
        setMessage(data.message);
        toast.success("Password reset successfully!");
        setTimeout(() => router.push("/auth/login"), 2000);
      } else {
        setStatus("error");
        setMessage(data.message);
        toast.error(data.message);
      }
    } catch (error) {
      setStatus("error");
      setMessage("An error occurred. Please try again.");
      toast.error("An error occurred. Please try again.");
    }
  };

  return (
    <Card
      className="
     max-w-xl w-full
     border-none
    px-6 py-16
    md:shadow md:border 
    md:px-12 md:py-24
  "
    >
      <CardContent className="h-full w-full flex flex-col p-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Set a new password</h1>
          <p className="text-gray-600">
            Enter a new password for your account.
          </p>
        </div>

        {status === "done" ? (
          <div className="rounded-lg bg-green-50 p-4 border border-green-200">
            <p className="text-sm font-medium text-green-800">{message}</p>
            <p className="mt-2 text-xs text-green-700">
              Redirecting to login...
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="flex flex-col gap-6 w-full"
            >
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="gap-0.5 w-full">
                    <FormLabel className="font-bold text-[0.95rem] mb-1">
                      New Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        className="w-full rounded-lg border border-muted-foreground/30 px-4 py-2.5"
                        placeholder="At least 5 characters"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem className="gap-0.5 w-full">
                    <FormLabel className="font-bold text-[0.95rem] mb-1">
                      Confirm Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        className="w-full rounded-lg border border-muted-foreground/30 px-4 py-2.5"
                        placeholder="Confirm your password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {status === "error" && (
                <div className="rounded-lg bg-red-50 p-3 border border-red-200">
                  <p className="text-sm text-red-700">{message}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={status === "loading"}
                size={"lg"}
                className="rounded-lg cursor-pointer py-6 font-medium text-base"
              >
                {status === "loading" ? <Spinner /> : "Update Password"}
              </Button>
            </form>
          </Form>
        )}

        <div className="text-center w-full mt-10 space-y-3">
          <div className="text-sm">
            <Link
              href={"/auth/login"}
              className="text-secondary font-medium hover:underline"
            >
              Return to login
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
