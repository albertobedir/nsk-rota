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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { auth } from "@/lib/axios";
import { subscribeSchema } from "@/schemas/subscribe.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { useState } from "react";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  register: keyof z.infer<typeof subscribeSchema>;
  label?: string;
}

const formFields: FormFieldProps[] = [
  {
    register: "firstName",
    type: "text",
    placeholder: "First Name",
    label: "First Name",
  },
  {
    register: "lastName",
    type: "text",
    placeholder: "Last Name",
    label: "Last Name",
  },
  {
    register: "email",
    type: "email",
    placeholder: "Email",
    label: "Email",
  },
  {
    register: "companyName",
    type: "text",
    placeholder: "Company Name",
    label: "Company Name",
  },
  {
    register: "country",
    label: "Country",
  },
  {
    register: "address1",
    type: "text",
    placeholder: "Street Address",
    label: "Address",
  },
  {
    register: "city",
    type: "text",
    placeholder: "City",
    label: "City",
  },
  {
    register: "state",
    type: "text",
    placeholder: "State (IL, NY, etc)",
    label: "State",
  },
  {
    register: "zip",
    type: "text",
    placeholder: "Zip Code",
    label: "Zip Code",
  },
];

export default function Page() {
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<z.infer<typeof subscribeSchema>>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: {
      email: "",
      country: "US",
      firstName: "",
      lastName: "",
      companyName: "",
      address1: "",
      city: "",
      state: "",
      zip: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: z.infer<typeof subscribeSchema>) => {
      await auth.subscribe(values);
    },
    onSuccess: () => {
      form.reset();
      setIsSuccess(true);
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Something went wrong.");
      }
    },
  });

  // 🔥 BURASI ÖNEMLİ: country en sona atılıyor
  const sortedFields = [
    ...formFields.filter((f) => f.register !== "country"),
    formFields.find((f) => f.register === "country"),
  ].filter(Boolean) as FormFieldProps[];

  return (
    <Card className="border-none max-w-xl w-full px-12 py-24">
      <CardContent className="h-full w-full flex flex-col p-0">
        {isSuccess ? (
          <div className="flex flex-col gap-6 justify-center h-full w-full">
            <h2 className="text-2xl font-bold">Account Creation Successful!</h2>
            <Link href="/auth/login">Return to Login</Link>
          </div>
        ) : (
          <>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => mutate(values))}
                className="flex flex-col gap-6"
              >
                {sortedFields.map((field) => (
                  <FormField
                    key={field.register}
                    control={form.control}
                    name={field.register}
                    render={({ field: innerField }) => (
                      <FormItem>
                        <FormLabel>{field.label}</FormLabel>
                        <FormControl>
                          {field.register === "country" ? (
                            <Select
                              onValueChange={innerField.onChange}
                              value={innerField.value}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="US">
                                  United States
                                </SelectItem>
                                <SelectItem value="CA">Canada</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              {...innerField}
                              type={field.type || "text"}
                              placeholder={field.placeholder}
                            />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}

                <Button type="submit" disabled={isPending}>
                  {isPending ? <Spinner /> : "Send"}
                </Button>
              </form>
            </Form>

            <span className="text-center mt-6">
              Already have an account? <Link href="/auth/login">Login</Link>
            </span>
          </>
        )}
      </CardContent>
    </Card>
  );
}
