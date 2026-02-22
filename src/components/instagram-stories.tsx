"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Item = {
  id: string;
  title?: string;
  image?: string; // thumbnail image (use Next Image)
  videoUrl?: string; // optional video source
};

const sample: Item[] = [
  { id: "1", videoUrl: "/homevideo1.mp4" },
  { id: "2", videoUrl: "/homevideo2.mp4" },
  { id: "3", videoUrl: "/homevideo3.mp4" },
  { id: "4", videoUrl: "/homevideo4.mp4" },
];

export default function InstagramStories({
  items = sample,
}: {
  items?: Item[];
}) {
  const [active, setActive] = useState<Item | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  // We'll rely on native touch scrolling + CSS scroll-snap for mobile swipe behavior.

  return (
    <section className="w-full py-12 bg-primary">
      <div className="max-w-screen-2xl mx-auto px-6 flex flex-col items-center gap-6">
        <h3 className="font-extrabold text-white text-2xl sm:text-3xl lg:text-5xl mb-4 sm:mb-6 text-start sm:text-center w-full">
          Trusted by OEMs. Proven by Mechanics
        </h3>
        <p className="text-white text-sm sm:text-base lg:text-2xl max-w-4xl text-start sm:text-center w-full">
          Discover real experiences from our customers and OEM partners who rely
          on ROTA’s steering and suspension parts. From long-term collaborations
          to field-proven performance, these stories reflect our commitment to
          quality, reliability, and engineering excellence.
        </p>

        <div ref={containerRef} className="w-full flex justify-center">
          <div
            ref={innerRef}
            className="flex flex-row items-center gap-4 overflow-x-auto snap-x snap-mandatory py-2 px-2 justify-start lg:justify-center"
          >
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => setActive(it)}
                className="shrink-0 w-[88%] max-w-xs sm:w-[200px] md:w-[240px] lg:w-[300px] aspect-9/16 rounded-lg overflow-hidden relative bg-white shadow-md snap-center"
              >
                {it.videoUrl ? (
                  <>
                    <video
                      src={it.videoUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />

                    {/* centered play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path d="M8 5v14l11-7L8 5z" fill="white" />
                        </svg>
                      </div>
                    </div>

                    {/* instagram logo bottom-right */}
                    <div className="absolute right-2 bottom-2">
                      <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="5"
                            stroke="#000"
                            strokeWidth="1.2"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="3"
                            stroke="#000"
                            strokeWidth="1.2"
                          />
                          <circle cx="17.5" cy="6.5" r="0.8" fill="#000" />
                        </svg>
                      </div>
                    </div>
                  </>
                ) : it.image ? (
                  <div className="absolute inset-0">
                    <Image
                      src={it.image}
                      alt={it.title ?? "story"}
                      fill
                      sizes="(max-width: 640px) 220px, (max-width: 768px) 260px, (max-width: 1024px) 300px, 360px"
                      className="object-cover"
                      quality={75}
                      priority={false}
                    />
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Video modal */}
      <AnimatePresence>
        {active && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-3xl bg-black rounded-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {active.videoUrl ? (
                <video
                  src={active.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-auto max-h-[80vh] bg-black"
                />
              ) : (
                <div className="relative w-full h-[70vh]">
                  <Image
                    src={active.image as string}
                    alt={active.title ?? "story"}
                    fill
                    className="object-contain"
                    quality={90}
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
