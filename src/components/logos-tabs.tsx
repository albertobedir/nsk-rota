"use client";
import React, { useEffect, useRef } from "react";
import Image from "next/image";

type Props = {
  logos?: string[];
};

export default function LogosTabs({ logos = [] }: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const posRef = useRef<number>(0);

  useEffect(() => {
    if (!groupRef.current || !innerRef.current) return;
    let groupWidth = groupRef.current.offsetWidth;
    if (groupWidth === 0) return;

    const speed = 80; // px per second, adjust to taste
    let last = performance.now();

    function loop(now: number) {
      const delta = (now - last) / 1000;
      last = now;

      posRef.current += speed * delta;
      if (posRef.current >= groupWidth) {
        posRef.current -= groupWidth;
      }

      if (innerRef.current) {
        innerRef.current.style.transform = `translateX(${-posRef.current}px)`;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    // re-measure on resize (in case layout changes)
    const onResize = () => {
      if (groupRef.current)
        groupWidth = groupRef.current.offsetWidth || groupWidth;
    };
    window.addEventListener("resize", onResize);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [logos]);

  const renderGroup = (items: string[]) => (
    <div ref={groupRef} className="flex gap-8 items-center py-4">
      {items.map((file) => (
        <div
          key={file}
          className="flex items-center justify-center p-6 bg-transparent shrink-0"
        >
          <Image
            src={`/logos/${file}`}
            alt={file}
            width={220}
            height={110}
            className="object-contain max-h-28"
          />
        </div>
      ))}
    </div>
  );

  return (
    <section className="w-full bg-white my-12 py-10">
      <div className="max-w-screen-2xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-center mb-6">
          OES Referanslar
        </h2>

        <div ref={outerRef} className="w-full overflow-hidden">
          <div
            ref={innerRef}
            className="flex items-center"
            style={{ willChange: "transform" }}
          >
            {logos.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 py-8">
                İçerik yok. Daha sonra logo ekleyeceksiniz.
              </div>
            ) : (
              // duplicate group for seamless loop
              <>
                <div className="shrink-0">{renderGroup(logos)}</div>
                <div className="shrink-0">{renderGroup(logos)}</div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
