import Footer from "@/components/footer";
import Image from "next/image";

interface Props {
  children: React.ReactNode;
}

export default function layout({ children }: Props) {
  return (
    <main className="h-full flex bg-[#f3f3f3] flex-col gap-30">
      <div className="relative h-full flex flex-col">
        <div className="absolute w-full h-full top-0 left-0">
          <Image
            src="/auth-bg.webp"
            alt="auth layout bg"
            fill
            className="w-full h-full object-cover"
          />
          <div className="h-32 bg-muted absolute bottom-0 left-0 w-full"></div>
        </div>
        <div className="relative z-10 pt-3 w-full flex flex-col justify-end items-center container  gap-10">
          <header className="w-full flex flex-col items-center gap-4 text-center text-white px-4">
            <h1
              className="
    font-black
    text-2xl       /* mobile */
    xs:text-2xl    /* slightly larger phones */
    sm:text-3xl 
    md:text-4xl
    leading-tight
  "
            >
              ROTA North America B2B
            </h1>

            <p
              className="
    text-base sm:text-lg md:text-lg 
    max-w-md sm:max-w-xl md:max-w-2xl 
    leading-relaxed
  "
            >
              This platform is designated for orders shipped directly from our
              U.S. warehouse. If you already have an account, please “log in”
              using your e-mail and password. If you are new to our system,
              please click “Subscribe now” to complete your registration and
              request access.
            </p>
          </header>

          <div className="w-full flex items-end justify-center flex-1">
            {children}
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
