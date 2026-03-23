import Footer from "@/components/footer";
import Navbar from "@/components/navbar";
import Image from "next/image";

interface Props {
  children: React.ReactNode;
}

export default function layout({ children }: Props) {
  return (
    <main className="relative min-h-screen flex  flex-col gap-30">
      <Navbar logoOnly sticky={true} />

      <div className="absolute inset-0 -z-10">
        <Image
          src="/auth-bg.webp"
          alt="auth layout bg"
          fill
          className="w-full h-full object-cover"
        />
        <div className="h-32 bg-muted absolute bottom-0 left-0 w-full" />
      </div>

      <div className="relative z-10 pt-3 w-full flex flex-col justify-end items-center container gap-10">
        <header className="w-full flex flex-col items-center gap-4 text-center text-white px-4">
          <h1 className="font-black text-2xl xs:text-2xl sm:text-3xl md:text-4xl leading-tight">
            ROTA North America <span className="text-secondary">B2B</span>
          </h1>

          <p className="text-base sm:text-lg md:text-lg max-w-md sm:max-w-xl md:max-w-2xl leading-relaxed">
            This platform is designated for{" "}
            <span className="font-bold">
              orders shipped directly from our U.S. warehouse.
            </span>
          </p>

          <p className="text-base sm:text-lg md:text-lg max-w-md sm:max-w-xl md:max-w-2xl leading-relaxed">
            If you already have an account, please{" "}
            <span className="font-bold">
              “log in” using your e-mail and password.
            </span>
          </p>

          <p className="text-base sm:text-lg md:text-lg max-w-md sm:max-w-xl md:max-w-2xl leading-relaxed">
            If you are new to our system, please click{" "}
            <span className="font-bold">
              “Subscribe now” to complete your registration and request access.
            </span>
          </p>
        </header>

        <div className="w-full flex items-end justify-center flex-1">
          {children}
        </div>
      </div>

      <Footer />
    </main>
  );
}
