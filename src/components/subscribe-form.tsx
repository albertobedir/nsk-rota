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
import { subscribeSchema } from "@/schemas/subscribe.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  register: keyof z.infer<typeof subscribeSchema>;
  label?: string;
}

const formFields: FormFieldProps[] = [
  {
    register: "firstName",
    type: "text",
    placeholder: "First Name",
    autoComplete: "first-name",
    required: true,
    label: "First Name",
  },
  {
    register: "lastName",
    type: "text",
    placeholder: "Last Name",
    autoComplete: "last-name",
    required: true,
    label: "Last Name",
  },
  {
    register: "email",
    type: "email",
    placeholder: "Email",
    autoComplete: "email",
    required: true,
    label: "Email",
  },
];

export default function Page() {
  const form = useForm<z.infer<typeof subscribeSchema>>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: z.infer<typeof subscribeSchema>) => {
      await auth.subscribe(values);
    },
    onSuccess: () => {
      form.reset();
      toast("hesap olusturma talebi gonderildi");
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        toast(error.message);
      } else {
        toast("Bir hata oluştu");
      }
    },
  });
  return (
    <Card className="shadow-none border-none max-w-xl w-full px-12 py-24">
      <CardContent className="h-full w-full flex flex-col p-0">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(
              (values: z.infer<typeof subscribeSchema>) => {
                mutate(values);
              }
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
              {isPending ? <Spinner /> : "Send"}
            </Button>
          </form>
        </Form>
        <span className="text-center w-full mt-10 text-xl">
          Already have an Account?{" "}
          <Link href={"/auth/login"} className="text-secondary">
            Login now
          </Link>
        </span>
      </CardContent>
    </Card>
  );
}
