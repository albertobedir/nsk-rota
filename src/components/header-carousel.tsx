"use client";

import React from "react";
import Link from "next/link";
import type { CarouselApi } from "@/components/ui/carousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Image from "next/image";

interface BannerItem {
  id: string;
  content_img: string | null;
  bg_img: string | null;
  mobile_img: string | null;
  type: string;
  link: { text: string; url: string } | null;
}

export default function HeaderCarousel() {
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  const [selected, setSelected] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [banners, setBanners] = React.useState<BannerItem[]>([]);
  const AUTOPLAY_MS = 6000;

  // fetch banners from Shopify metaobjects
  React.useEffect(() => {
    fetch("/api/shopify/carousel-contents")
      .then((r) => r.json())
      .then((data) => {
        console.log(
          "[CarouselContents raw data]",
          JSON.stringify(data, null, 2),
        );
        if (data?.results?.length) setBanners(data.results);
      })
      .catch((e) => console.error("[CarouselContents fetch error]", e));
  }, []);

  React.useEffect(() => {
    if (!api) return;

    const update = () => setSelected(api.selectedScrollSnap());
    update();
    api.on("select", update);
    api.on("reInit", update);

    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  // autoplay: advance every AUTOPLAY_MS milliseconds
  React.useEffect(() => {
    if (!api || banners.length === 0) return;

    const id = setInterval(() => {
      if (paused) return;
      try {
        const next = (api.selectedScrollSnap() + 1) % banners.length;
        api.scrollTo(next);
      } catch {
        // ignore if api isn't ready
      }
    }, AUTOPLAY_MS);

    return () => clearInterval(id);
  }, [api, paused, banners.length]);

  if (banners.length === 0) return null;

  return (
    <div
      className="w-full overflow-hidden bg-transparent relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Carousel className="relative h-full w-full" setApi={setApi}>
        <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-30" />
        <CarouselContent className="flex">
          {banners.map((item, i) => {
            const inner = (
              <div className="w-full relative aspect-[4/5] md:aspect-auto md:h-96 lg:h-[32rem] overflow-hidden">
                {item.bg_img && (
                  <Image
                    src={item.bg_img}
                    fill
                    alt={`banner-bg-${i}`}
                    className={`absolute inset-0 h-full w-full object-cover z-0${item.mobile_img ? " hidden md:block" : ""}`}
                  />
                )}
                {item.content_img && (
                  <Image
                    src={item.content_img}
                    fill
                    alt={item.link?.text ?? `banner-content-${i}`}
                    className={`absolute inset-0 h-full w-full object-contain z-10${item.mobile_img ? " hidden md:block" : ""}`}
                    style={{ objectPosition: "center" }}
                  />
                )}
                {item.mobile_img && (
                  <Image
                    src={item.mobile_img}
                    fill
                    alt={item.link?.text ?? `banner-mobile-${i}`}
                    className="absolute inset-0 h-full w-full object-contain z-10 md:hidden"
                    style={{ objectPosition: "center" }}
                  />
                )}
              </div>
            );

            return (
              <CarouselItem key={item.id}>
                {item.type === "link" && item.link?.url ? (
                  <Link href={item.link.url} className="block w-full">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-30" />
      </Carousel>

      {/* indicators */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-30 flex items-center gap-3">
        {banners.map((_, i) => {
          const isActive = i === selected;
          return (
            <button
              key={i}
              aria-current={isActive}
              onClick={() => api?.scrollTo(i)}
              className={
                "transition-all duration-200 inline-flex items-center justify-center focus:outline-none" +
                (isActive
                  ? " w-10 sm:w-8 h-2.5 rounded-full bg-white/90 ring-1 ring-black/10 shadow-lg"
                  : " w-2.5 h-2.5 rounded-full bg-black/50 ring-1 ring-white/20")
              }
              style={{ WebkitTapHighlightColor: "transparent" }}
            />
          );
        })}
      </div>
    </div>
  );
}
