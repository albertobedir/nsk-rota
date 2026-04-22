/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

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
import { auth } from "@/lib/axios";
import { loginSchema } from "@/schemas/login.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  register: keyof z.infer<typeof loginSchema>;
  label?: string;
}

const formFields: FormFieldProps[] = [
  {
    register: "email",
    type: "email",
    autoComplete: "email",
    required: true,
    label: "Email",
    placeholder: "Email",
  },
  {
    register: "password",
    type: "password",
    autoComplete: "password",
    required: true,
    label: "Password",
    placeholder: "Password",
  },
];

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: z.infer<typeof loginSchema>) => auth.login(values),
    onSuccess: (data) => {
      const redirect = data?.redirect || searchParams.get("redirect") || "/";
      // Full reload to ensure cookies are read by middleware/layout
      window.location.href = redirect;
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        toast.error(error.message);
      } else if (error && typeof error === "object" && "data" in error) {
        const msg = (error as { data?: { message?: string } }).data?.message;
        toast.error(msg || "Invalid email or password. Please try again.");
      } else {
        toast.error("Invalid email or password. Please try again.");
      }
    },
  });

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
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(
              (values: z.infer<typeof loginSchema>) => {
                mutate(values);
              },
            )}
            className="flex flex-col gap-6 justify-center h-full w-full p-0"
          >
            {formFields.map((field) => (
              <FormField
                key={field.register}
                control={form.control}
                name={field.register}
                render={({ field: innerField }) => (
                  <FormItem className="gap-0.5">
                    <FormLabel className="font-bold text-[0.95rem] mb-1">
                      {field.label}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type={field.type || "text"}
                        className="w-full rounded-lg border border-muted-foreground/30"
                        {...innerField}
                        placeholder={field.placeholder}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <Button
              type="submit"
              disabled={isPending}
              size={"lg"}
              className="rounded-lg cursor-pointer py-6 font-medium text-base"
            >
              {isPending ? <Spinner /> : "Login"}
            </Button>
          </form>
        </Form>

        <div className="text-center w-full mt-10 space-y-3">
          <div className="text-xl">
            Are you new here?{" "}
            <Link href={"/auth/subscribe"} className="text-secondary">
              Create an account
            </Link>
          </div>
          <div className="text-sm">
            <Link
              href="/auth/forgot-password"
              className="text-secondary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
