"use client";

import { Card, CardContent } from "@/components/ui/card";
import { loginSchema, LoginSchemaInput } from "@/schemas/zod";
import { useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/axios";
import { toast } from "sonner";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  register: keyof LoginSchemaInput;
  label?: string;
}

const formFields: FormFieldProps[] = [
  {
    register: "email",
    type: "email",
    autoComplete: "email",
    required: true,
    label: "Email",
  },
  {
    register: "password",
    type: "password",
    autoComplete: "password",
    required: true,
    label: "Password",
  },
];

export default function Page() {
  const router = useRouter();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: z.infer<typeof loginSchema>) => {
      await auth.login(values);
    },
    onSuccess: () => {
      router.push("/");
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
    <section className="flex bg-white md:bg-transparent flex-col gap-4 sm:gap-0 py-5 sm:px-0 px-3">
      <header>
        <div className="flex flex-col sm:items-center items-start  justify-center sm:text-center gap-2 sm:text-white text-foreground">
          <h1 className="text-4xl text-center sm:text-start font-black">
            Yetenekleriniz <span className="text-secondary">Burada</span>{" "}
            Değerli
          </h1>
          <p className="sm:w-[60%] text-center w-full text-sm">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Quae
            dolore, aspernatur consequuntur nisi ut, veniam omnis sapiente
            eligendi enim ipsa cum debitis molestias et possimus ipsum nemo
            fugit voluptates
          </p>
        </div>
      </header>
      <main className="sm:absolute sm:inset-0 sm:z-10 sm:top-6 w-full flex h-fit m-auto flex-1 sm:flex-none">
        <Card className="sm:w-[30%] w-full border-none sm:border-card bg-background sm:bg-card shadow-none sm: shadow-card sm:top-6 sm:aspect-square m-auto rounded-lg">
          <CardContent className="h-full w-full flex flex-col">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(
                  (values: z.infer<typeof loginSchema>) => {
                    mutate(values);
                  }
                )}
                className="flex flex-col gap-8 justify-center h-full w-full"
              >
                {formFields.map((field) => (
                  <FormField
                    key={field.register}
                    control={form.control}
                    name={field.register}
                    render={({ field: innerField }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-[0.95rem]">
                          {field.label}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type={field.type || "text"}
                            className="w-full rounded-lg border border-muted-foreground/30"
                            {...innerField}
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
                  className="rounded-lg cursor-pointer"
                >
                  {isPending ? <Spinner /> : "Submit"}
                </Button>
              </form>
            </Form>
            <span className="text-center w-full">
              Are you new here?{" "}
              <Link href={"/auth/subs"} className="text-primary">
                Subscribe now
              </Link>
            </span>
          </CardContent>
        </Card>
      </main>
    </section>
  );
}
