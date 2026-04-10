"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

type Props = {
  end: number;
  duration?: number; // ms
  delay?: number; // ms
  decimals?: number;
  suffix?: string;
};

export default function CountUp({
  end,
  duration = 900,
  delay = 0,
  decimals = 0,
  suffix = "",
}: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [value, setValue] = useState<number>(0);

  useEffect(() => {
    if (!inView) return;

    let startTime: number | null = null;
    let raf = 0;

    const step = (t: number) => {
      if (!startTime) startTime = t;
      const elapsed = t - startTime;
      if (elapsed < delay) {
        raf = requestAnimationFrame(step);
        return;
      }
      const progress = Math.min(1, (elapsed - delay) / duration);
      const current = Number((end * progress).toFixed(decimals));
      setValue(current);
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, end, duration, delay, decimals]);

  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  return (
    <span ref={ref}>
      {formatted}
      {suffix}
    </span>
  );
}
