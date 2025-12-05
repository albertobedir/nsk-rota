import Logo from "@/components/logo";
import Image from "next/image";
import Link from "next/link";

interface Props {
   children: React.ReactNode;
}

export default function layout({ children }: Props) {
   return (
      <main className="h-full flex flex-col">
         <div className="relative h-full flex flex-col">
            <div className="absolute w-full h-full top-0 left-0">
               <Image
                  src="/auth-layout-bg.png"
                  alt="auth layout bg"
                  width={1000}
                  height={1000}
                  className="w-full h-full object-cover"
               />
               <div className="h-32 bg-muted absolute bottom-0 left-0 w-full"></div>
            </div>
            <div className="relative z-10 h-full flex flex-col justify-end items-center container pt-40 gap-10">
               <header className="w-full flex flex-col items-center gap-4 text-center text-white">
                  <h1 className="text-5xl font-black">
                     Yetenekleriniz{" "}
                     <span className="text-secondary">Burada</span> Değerli
                  </h1>
                  <p className="text-xl max-w-5xl">
                     Lorem Ipsum, dizgi ve baskı endüstrisinde kullanılan mıgır
                     metinlerdir. Lorem Ipsum, adı bilinmeyen lorem Ipsum, dizgi
                     ve baskı endüstrisinde kullanılan mıgır metinlerdir. Lorem
                     Ipsum, adı bilinmeyen.
                  </p>
               </header>
               <div className="w-full flex items-end justify-center flex-1">
                  {children}
               </div>
            </div>
         </div>
         <footer className="bg-muted text-muted-foreground py-7">
            <div className="container">
               <div>
                  <Logo className="max-w-40 w-full" />
               </div>
               <hr className="border-x-0 border-y border-solid border-muted-foreground/30 my-4" />
               <div className="flex items-center justify-between">
                  <ul className="flex items-center gap-4">
                     <li>
                        <Link href="/">Çerez Politikası</Link>
                     </li>
                     <li>
                        <Link href="/"> Gizlilik Politikası</Link>
                     </li>
                     <li>
                        <Link href="/">KVKK Aydınlatma Metni</Link>
                     </li>
                  </ul>
                  <span>© 2022 NSK Group, tüm hakları sakldır.</span>
                  <span>
                     made by <b>BABEL</b>
                  </span>
               </div>
            </div>
         </footer>
      </main>
   );
}
