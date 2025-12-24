"use client";
import "./globals.css";
import localFont from "next/font/local";
import Provider from "@/providers";

const aeonik = localFont({
  src: [
    {
      path: "../font/fonnts.com-Aeonik_Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../font/fonnts.com-Aeonik_Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../font/fonnts.com-Aeonik_Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../font/fonnts.com-Aeonik_Black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${aeonik.className} antialiased`}>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
