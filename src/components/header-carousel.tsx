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

const banners = ["/cr1.jpg", "/cr1.jpg", "/cr3.jpg", "/cr3.jpg", "/cr3.jpg"];

export default function HeaderCarousel() {
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  const [selected, setSelected] = React.useState(0);

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

  return (
    <div className="w-full overflow-hidden bg-transparent relative">
      <Carousel className="relative h-full w-full" setApi={setApi}>
        <CarouselPrevious className="hidden sm:block" />
        <CarouselContent className="flex">
          {banners.map((src, i) => (
            <CarouselItem key={i}>
              <div className="w-full relative h-64 md:h-96 lg:h-[32rem] overflow-hidden">
                <Image
                  src={src}
                  fill
                  alt={`banner-${i}`}
                  className="w-full absolute h-full object-center"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselNext className="hidden sm:block" />
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
