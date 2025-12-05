"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

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

export default function NavbarModal({ open, setOpen }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, setOpen]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-20 transition-opacity duration-300",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
      />
      <div
        ref={modalRef}
        className={cn(
          "absolute bottom-0 w-full flex items-center justify-center  translate-y-full bg-white z-30 transition-transform duration-300 ease-in-out",
          open ? "flex" : "hidden"
        )}
      >
        <div className="grid grid-cols-4 gap-4">
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
      </div>
    </>
  );
}
