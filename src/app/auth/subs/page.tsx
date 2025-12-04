"use client";
import { useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  subscribeSchema,
  SubscribeSchemaInput,
} from "@/schemas/zod/auth/subscribe.schema";
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
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { auth } from "@/lib/axios";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  register: keyof SubscribeSchemaInput;
  label?: string;
}

const formFields: FormFieldProps[] = [
  {
    register: "firstName",
    type: "text",
    placeholder: "Adınız",
    autoComplete: "first-name",
    required: true,
    label: "First Name",
  },
  {
    register: "lastName",
    type: "text",
    placeholder: "Soyadınız",
    autoComplete: "last-name",
    required: true,
    label: "Last Name",
  },
  {
    register: "email",
    type: "email",
    placeholder: "E-posta adresiniz",
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
    <section className="flex bg-white md:bg-transparent flex-col gap-4 sm:gap-0 py-5 sm:px-0 px-3">
      <header>
        <div className="flex  flex-col sm:items-center items-start  justify-center sm:text-center gap-2 sm:text-white text-foreground">
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
      <main className="sm:absolute sm:inset-0 sm:z-10 smLtop-6 w-full flex h-fit m-auto flex-1 sm:flex-none">
        <Card className="sm:w-[40%] md:w-[35%] lg:w-[30%] w-full border-none sm:border-card bg-background sm:bg-card shadow-none sm: shadow-card sm:top-6 sm:py-[3rem] m-auto rounded-lg">
          <CardContent className="h-full w-full flex flex-col">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(
                  (values: z.infer<typeof subscribeSchema>) => {
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
              Already have an Account?{" "}
              <Link href={"/auth/login"} className="text-primary">
                Login now
              </Link>
            </span>
          </CardContent>
        </Card>
      </main>
    </section>
  );
}
