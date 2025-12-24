"use client";

import React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Image from "next/image";

const banners = ["/cr1.jpg", "/cr2.jpg", "/cr3.jpg"];

export default function HeaderCarousel() {
  return (
    <div className="w-full overflow-hidden bg-transparent">
      <Carousel className="relative w-full">
        <CarouselPrevious />
        <CarouselContent className="flex">
          {banners.map((src, i) => (
            <CarouselItem key={i}>
              <div className="w-full relative h-44 md:h-80 lg:h-96  overflow-hidden">
                <Image
                  src={src}
                  fill
                  alt={`banner-${i}`}
                  className="w-full absolute h-full object-cover"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselNext />
      </Carousel>
    </div>
  );
}
