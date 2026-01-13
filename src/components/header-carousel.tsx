"use client";

import React from "react";
import type { CarouselApi } from "@/components/ui/carousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Image from "next/image";

const banners = [
  { bg: "none", content: "/cr1.jpg" },
  { bg: "/cr2bg.png", content: "/cr2.png" },
  { bg: "none", content: "/cr3.jpg" },
];

export default function HeaderCarousel() {
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  const [selected, setSelected] = React.useState(0);
  const AUTOPLAY_MS = 5000; // 5 seconds

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
    if (!api) return;

    const id = setInterval(() => {
      try {
        const next = (api.selectedScrollSnap() + 1) % banners.length;
        api.scrollTo(next);
      } catch {
        // ignore if api isn't ready
      }
    }, AUTOPLAY_MS);

    return () => clearInterval(id);
  }, [api]);

  return (
    <div className="w-full overflow-hidden bg-transparent relative">
      <Carousel className="relative h-full w-full" setApi={setApi}>
        <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-30" />
        <CarouselContent className="flex">
          {banners.map((item, i) => (
            <CarouselItem key={i}>
              <div className="w-full relative h-64 md:h-96 lg:h-[32rem] overflow-hidden">
                {item.bg !== "none" && (
                  <Image
                    src={item.bg}
                    fill
                    alt={`banner-bg-${i}`}
                    className="absolute inset-0 h-full w-full object-cover z-0"
                  />
                )}

                <Image
                  src={item.content}
                  fill
                  alt={`banner-content-${i}`}
                  className={
                    item.bg === "none"
                      ? "absolute inset-0 h-full w-full object-cover z-10"
                      : "absolute inset-0 h-full w-full object-contain z-10"
                  }
                  style={
                    item.bg === "none"
                      ? undefined
                      : { objectPosition: "center" }
                  }
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-30" />
      </Carousel>

      {/* indicators (absolute over image) */}
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
