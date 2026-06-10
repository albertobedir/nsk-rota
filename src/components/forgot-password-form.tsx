"use client";

import { useState } from "react";
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

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleSubmit = async (values: ForgotPasswordFormValues) => {
    setStatus("loading");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("done");
        setMessage(data.message);
        toast.success("Check your email for reset instructions");
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
          <h1 className="text-3xl font-bold mb-2">Forgot your password?</h1>
          <p className="text-gray-600">
            No worries. We will send you reset instructions.
          </p>
        </div>

        {status === "done" ? (
          <div className="rounded-lg bg-green-50 p-4 border border-green-200">
            <p className="text-sm font-medium text-green-800">{message}</p>
            <p className="mt-2 text-xs text-green-700">
              Check your email for a link to reset your password.
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
                name="email"
                render={({ field }) => (
                  <FormItem className="gap-0.5 w-full">
                    <FormLabel className="font-bold text-[0.95rem] mb-1">
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        className="w-full rounded-lg border border-muted-foreground/30 px-4 py-2.5"
                        placeholder="your@email.com"
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
                {status === "loading" ? <Spinner /> : "Send Reset Link"}
              </Button>
            </form>
          </Form>
        )}

        <div className="text-center w-full mt-10 space-y-3">
          <div className="text-sm">
            Remember your password?{" "}
            <Link href={"/auth/login"} className="text-secondary font-medium">
              Sign in here
            </Link>
          </div>
          <div className="text-sm">
            <Link
              href={"/auth/subscribe"}
              className="text-secondary hover:underline"
            >
              Create an account
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
