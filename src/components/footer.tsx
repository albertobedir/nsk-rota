"use client";

import Image from "next/image";
import Link from "next/link";
import Icons from "./icons";
import Logo from "./logo";

const categories = [
   {
      name: "Kurumsal",
      items: [
         { name: "Hakkımızda", href: "/" },
         { name: "Yönetim Ekibi", href: "/" },
         { name: "Kariyer", href: "/" },
         { name: "Sürdürülebilirlik", href: "/" },
         { name: "Fuarlar", href: "/" },
         { name: "Haberler", href: "/" },
         { name: "Üyelikler", href: "/" },
         { name: "Şirketler Ticari Sicil Bilgileri", href: "/" },
         { name: "Politikalar", href: "/" },
      ],
   },
   {
      name: "Ürünler",
      items: [
         { name: "Ürün Grupları", href: "/" },
         { name: "Ürün Arama", href: "/" },
         { name: "Katalog & Broşür", href: "/" },
      ],
   },
   {
      name: "Üretim",
      items: [
         {
            name: "Direksiyon, Süspansiyon ve Hidrolik Parçalar Fabrikası",
            href: "/",
         },
         { name: "Sıcak Metal Dövme Fabrikası", href: "/" },
         { name: "Test Yetenekleri", href: "/" },
         { name: "OEM / OES Referanslar", href: "/" },
      ],
   },
   {
      name: "İletişim",
      items: [
         { name: "Bize Ulaşın", href: "/" },
         { name: "Adreslerimiz", href: "/" },
         { name: "Yurtiçi Satış Bayileri", href: "/" },
      ],
   },
];

export default function Footer() {
   return (
      <div>
         <div className="bg-muted pt-2 mt-20">
            <div className="container">
               <div className="flex items-center justify-between">
                  <Logo className="max-w-40 w-full" />
                  <div className="bg-primary -translate-y-20 relative rounded-xl overflow-hidden">
                     <Image
                        src="/footer-overlay.png"
                        alt="footer overlay"
                        width={1000}
                        height={1000}
                        className="h-full object-cover absolute top-0 left-0"
                     />
                     <div className="flex max-w-2xl items-center gap-4 py-10 px-8 text-white relative z-10">
                        <Icons name="mail-open" width={63} height={63} />
                        <div>
                           <h2 className="text-xl font-semibold">
                              E-Bülten Listemize{" "}
                              <span className="text-secondary">
                                 Kayıt Olun!
                              </span>
                           </h2>
                           <p className="text-[#989898]">
                              Yeni çıkan ürünler ve güncel haberler için e-posta
                              listemize kayıt olabilirsiniz.
                           </p>
                        </div>
                        <button className="flex items-center gap-2 whitespace-nowrap cursor-pointer">
                           <span>Kayıt Ol</span>
                           <Icons
                              className="text-secondary"
                              name="move-right"
                              width={20}
                              height={20}
                           />
                        </button>
                     </div>
                  </div>
               </div>
               <div className="grid grid-cols-4 gap-4">
                  {categories.map((category) => (
                     <div key={category.name}>
                        <h3 className="text-xl font-bold py-2">
                           {category.name}
                        </h3>
                        <ul className="flex flex-col">
                           {category.items.map((item) => (
                              <li key={item.name} className="text-base py-1">
                                 <Link
                                    className="hover:text-secondary transition-colors"
                                    href={item.href}
                                 >
                                    {item.name}
                                 </Link>
                              </li>
                           ))}
                        </ul>
                     </div>
                  ))}
               </div>
               <hr className="border-x-0 border-y border-solid border-muted-foreground/30 my-6" />
               <div className="flex items-center justify-between pb-6 text-muted-foreground">
                  <ul className="flex items-center gap-4"></ul>
                  <span>© 2022 NSK Group, tüm hakları sakldır.</span>
                  <span>
                     made by <b>BABEL</b>
                  </span>
               </div>
            </div>
         </div>
      </div>
   );
}
