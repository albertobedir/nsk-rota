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
    <footer className="bg-muted px-5 pt-10 mt-20">
      <div className="container">
        {/* MOBILE - LOGO */}
        <div className="flex justify-center mb-6 md:hidden">
          <Logo className="max-w-32" />
        </div>

        {/* NEWSLETTER SECTION */}
        <div className="relative bg-primary rounded-xl overflow-hidden w-full sm:ml-auto sm:-mt-[7rem] sm:w-[40rem] mb-10">
          <Image
            src="/footer-overlay.png"
            alt="footer overlay"
            width={1000}
            height={1000}
            className="h-full object-cover absolute top-0 left-0 opacity-30"
          />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-4 py-10 px-8 text-white">
            <Icons name="mail-open" width={63} height={63} />

            <div className="flex-1">
              <h2 className="text-lg md:text-xl font-semibold">
                E-Bülten Listemize{" "}
                <span className="text-secondary">Kayıt Olun!</span>
              </h2>
              <p className="text-[#cfcfcf] text-sm md:text-base mt-1">
                Yeni çıkan ürünler ve güncel haberler için e-posta listemize
                kayıt olabilirsiniz.
              </p>
            </div>

            <button className="flex items-center gap-2 text-white font-semibold whitespace-nowrap cursor-pointer">
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

        {/* DESKTOP LOGO */}
        <div className="hidden md:flex items-center justify-between mb-10">
          <Logo className="max-w-40 w-full" />
        </div>

        {/* CATEGORIES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {categories.map((category) => (
            <div key={category.name}>
              <h3 className="text-xl font-bold py-2">{category.name}</h3>
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

        <hr className="border-muted-foreground/30 my-6" />

        {/* BOTTOM COPYRIGHT */}
        <div className="pb-6 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-3 text-muted-foreground">
          <span>© 2022 NSK Group, tüm hakları saklıdır.</span>
          <span>
            made by <b>BABEL</b>
          </span>
        </div>
      </div>
    </footer>
  );
}
