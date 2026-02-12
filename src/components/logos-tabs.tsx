"use client";
import React, { useMemo, useState, useRef, useEffect } from "react";
import Image from "next/image";

type Props = {
  logos: string[];
};

const categories = [
  { key: "all", label: "Tümü" },
  { key: "commercial", label: "Ticari Araçlar Üreticileri" },
  { key: "agri", label: "Zirai Araç ve İş Makinası Üreticileri" },
  { key: "system", label: "Sistem ve OEM Parça Üreticileri" },
];

// For now categories are empty except 'all'.
export default function LogosTabs({ logos }: Props) {
  const [active, setActive] = useState<string>("all");
  const navRef = useRef<HTMLElement | null>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [underlineStyle, setUnderlineStyle] = useState<React.CSSProperties>({
    left: 0,
    width: 0,
  });

  // placeholder mapping: user will provide which files belong to which category later
  const mapping = useMemo(() => {
    return {
      all: logos,
      commercial: [
        "1651219968_karsan-t.png",
        "1652257545_1651219965-man-t.png",
        "1651219970_bmc-t.png",
        "1651219973_mercedes-t.png",
        "1651219989_mcv-t.png",
        "1651219975_svni-t.png",
        "1651219991_isuzu-t.png",
        "1651219989_guleryuz-t.png",
        "1651219996_akia-t.png",
        "1651219998_temsa-t.png",
        "1651220003_iveco-t.png",
        "1651220006_breda-t.png",
        "1724826975_vdl.png",
        "1680776182_vanhool.png",
      ],
      agri: [
        "1651219667_cnh-z.png",
        "1680865797_newholland2.png",
        "1680865797_newholland1.png",
        "1651219699_case-z.png",
        "1651219665_agco-z.png",
        "1651219691_valrtra-z.png",
        "1651219676_basak-z.png",
        "1651219695_claas-z.png",
        "1680865878_sdf.png",
        "1651219701_deutz-z.png",
        "1651219655_same-z.png",
        "1651219686_erkumt-z.png",
        "1651219697_hidromek-z.png",
        "1651219657_johndeere-z.png",
        "1651219662_jcb-z.png",
        "1651219688_manitou-z.png",
        "1651219693_komatsu-z.png",
        "1679906051_kademe.png",
        "1679905704_ceksan.png",
        "1679903509_bucher.png",
        "1678283756_yanmar-logo.png",
        "1679905516_mst.png",
        "1651219660_tumosan-z.png",
        "1651219669_hattat-z.png",
        "1681385731_naffco-logo.png",
        "1746427380_rosenbauer-logo.png",
      ] as string[],
      system: [
        "1651219737_hend-s.png",
        "1651219739_dana-s.png",
        "1651219741_hema-s.png",
        "1679906151_vse.jpg",
        "1664284476_tirsan-sistemnkomp-s.png",
        "1679906418_base.png",
        "1679906651_link.png",
        "1679906862_reyco.png",
      ] as string[],
    };
  }, [logos]);

  const items = mapping[active as keyof typeof mapping] ?? [];

  // compute position/width for moving underline
  useEffect(() => {
    const update = () => {
      const btn = btnRefs.current[active];
      const nav = navRef.current;
      if (!btn || !nav) {
        setUnderlineStyle({ left: 0, width: 0, opacity: 0 });
        return;
      }
      const navRect = nav.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const left = btnRect.left - navRect.left + nav.scrollLeft;
      const width = btnRect.width;
      setUnderlineStyle({ left, width, opacity: 1 });
    };

    update();
    window.addEventListener("resize", update);
    // update underline on nav scroll as tabs are horizontally scrollable on small screens
    const navEl = navRef.current;
    if (navEl) navEl.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      if (navEl) navEl.removeEventListener("scroll", update);
    };
  }, [active, categories]);

  // compute shortened underline dimensions (centered)
  const rawWidth = Number(underlineStyle.width ?? 0);
  const rawLeft = Number(underlineStyle.left ?? 0);
  const shortWidth = Math.max(Math.round(rawWidth * 0.7), 24);
  const shortLeft = rawLeft + Math.round((rawWidth - shortWidth) / 2);
  return (
    <section className="w-full bg-white my-12 py-10">
      <div className="max-w-screen-2xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-center mb-6">
          OES Referanslar
        </h2>

        <nav
          ref={(el) => (navRef.current = el)}
          className="relative mb-8 overflow-x-auto scrollbar-hide"
        >
          <div className="inline-flex items-center gap-6 px-2">
            {categories.map((cat) => (
              <button
                key={cat.key}
                ref={(el) => (btnRefs.current[cat.key] = el)}
                onClick={() => setActive(cat.key)}
                className={`inline-block flex-shrink-0 relative text-base md:text-lg lg:text-xl px-4 py-3 text-gray-900 outline-none focus:outline-none transition-opacity duration-200`}
                style={{ opacity: active === cat.key ? 1 : 0.45 }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* moving yellow underline */}
          <span
            aria-hidden
            className="absolute bottom-0 bg-secondary rounded-full"
            style={{
              height: 4,
              transform: `translateX(${shortLeft}px)`,
              width: shortWidth,
              transition:
                "transform 300ms cubic-bezier(.2,.9,.3,1), width 300ms cubic-bezier(.2,.9,.3,1), opacity 200ms",
              left: 0,
              opacity: underlineStyle.opacity ?? 0,
            }}
          />
        </nav>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-6 gap-8 items-center justify-center">
          {items.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-8">
              İçerik yok. Daha sonra kategoriye logo ekleyeceksiniz.
            </div>
          ) : (
            items.map((file) => (
              <div
                key={file}
                className="flex items-center justify-center p-6 bg-transparent"
              >
                <Image
                  src={`/logos/${file}`}
                  alt={file}
                  width={220}
                  height={110}
                  className="object-contain max-h-28"
                />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
