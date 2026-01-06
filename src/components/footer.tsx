"use client";

import Image from "next/image";
import Link from "next/link";
import Icons from "./icons";
import Logo from "./logo";

const categories = [
  {
    name: "Corporate",
    items: [
      { name: "About Us", href: "/" },
      { name: "Management Team", href: "/" },
      { name: "Careers", href: "/" },
      { name: "Sustainability", href: "/" },
      { name: "Trade Fairs", href: "/" },
      { name: "News", href: "/" },
      { name: "Memberships", href: "/" },
      { name: "Company Trade Registry Information", href: "/" },
      { name: "Policies", href: "/" },
    ],
  },
  {
    name: "Products",
    items: [
      { name: "Product Groups", href: "/" },
      { name: "Product Search", href: "/" },
      { name: "Catalog & Brochure", href: "/" },
    ],
  },
  {
    name: "Manufacturing",
    items: [
      {
        name: "Steering, Suspension and Hydraulic Parts Plant",
        href: "/",
      },
      { name: "Hot Forging Plant", href: "/" },
      { name: "Testing Capabilities", href: "/" },
      { name: "OEM / OES References", href: "/" },
    ],
  },
  {
    name: "Contact",
    items: [
      { name: "Contact Us", href: "/" },
      { name: "Our Addresses", href: "/" },
      { name: "Domestic Sales Dealers", href: "/" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#f3f3f3] md:px-30 px-4 pt-10 mt-20">
      <div className="container">
        {/* MOBILE - LOGO */}
        <div className="flex justify-center mb-6 md:hidden">
          <Logo className="max-w-32" />
        </div>

        {/* NEWSLETTER SECTION */}

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
          <span>© 2022 NSK Group. All rights reserved.</span>
          <span>
            made by <b>BABEL</b>
          </span>
        </div>
      </div>
    </footer>
  );
}
