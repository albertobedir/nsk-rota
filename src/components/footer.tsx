/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import Logo from "./logo";

const BASE_URL =
  process.env.NEXT_PUBLIC_NSK_BASE_URL || "https://nskgroup.com.tr";

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const categories = [
  {
    name: "Corporate",
    path: "en/corporate",
    items: [
      { name: "About Us" },
      { name: "Management Team" },
      { name: "Career" },
      { name: "Sustainability" },
      { name: "Exhibitions" },
      { name: "News" },
      { name: "Memberships" },
      { name: "Companies Register Details" },
      { name: "Policies" },
    ],
  },
  {
    name: "Products",
    path: "en/products/catalogue-brochure",
    items: [
      { name: "Product Ranges" },
      { name: "Product Search" },
      { name: "Catalogue &Brochure" },
    ],
  },
  {
    name: "Production",
    path: "en/production/oem-oes-references",
    items: [
      { name: "Steering, Suspension and Hydraulic Parts Factory" },
      { name: "Hot Metal Forging Factory" },
      { name: "Test Skills" },
      { name: "OEM/OES References" },
    ],
  },
  {
    name: "Contact Us",
    path: "en/contact-us",
    items: [
      { name: "Contact Us" },
      { name: "Our Addresses" },
      { name: "Resellers in Turkey" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#f3f3f3] md:px-30 px-4 pt-10 mt-10">
      <div className="container">
        {/* MOBILE - LOGO */}
        <div className="flex justify-center mb-6 md:hidden">
          <Logo className="max-w-32 text-[#989898]" />
        </div>

        {/* NEWSLETTER SECTION */}

        {/* DESKTOP LOGO */}
        <div className="hidden md:flex items-center justify-between mb-5">
          <Logo className="max-w-40 w-full text-[#989898]" />
        </div>

        {/* CATEGORIES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-9">
          {categories.map((category) => (
            <div key={category.name}>
              <h3 className="text-xl font-bold py-2">{category.name}</h3>
              <ul className="flex flex-col">
                {category.items.map((item) => {
                  const href =
                    (item as any).href && (item as any).href !== "/"
                      ? (item as any).href
                      : `${BASE_URL}/${category.path}/${slugify(item.name)}`;

                  const isExternal = href.startsWith("http");

                  return (
                    <li
                      key={item.name}
                      className="text-[1rem] font-semibold py-1 text-[#989898] hover:text-secondary transition-colors"
                    >
                      {isExternal ? (
                        <a
                          className="hover:text-secondary transition-colors"
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.name}
                        </a>
                      ) : (
                        <Link
                          className="hover:text-secondary transition-colors"
                          href={href}
                        >
                          {item.name}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <hr className="border-muted-foreground/30 my-6" />

        {/* BOTTOM COPYRIGHT */}
        <div className="pb-6 text-center md:text-left flex flex-col md:flex-row items-center  gap-3 text-muted-foreground">
          <span className="flex-1 text-center">
            © 2026 NSK Group, all rights reserved.
          </span>
          <span>
            make by <b>BABEL</b>
          </span>
        </div>
      </div>
    </footer>
  );
}
