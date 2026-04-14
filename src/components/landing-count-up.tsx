"use client";

import { useEffect, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent, useTransform } from "framer-motion";

const numberFormat = new Intl.NumberFormat("en-US");

type LandingCountUpProps = {
  target: number;
  className?: string;
};

export function LandingCountUp({ target, className }: LandingCountUpProps) {
  const raw = useMotionValue(0);
  const rounded = useTransform(raw, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useMotionValueEvent(rounded, "change", (v) => {
    setDisplay(v);
  });

  useEffect(() => {
    const safeTarget = Math.max(0, Math.floor(target));
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      raw.set(safeTarget);
      return;
    }

    raw.set(0);
    const controls = animate(raw, safeTarget, {
      duration: 1.25,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [target, raw]);

  return (
    <span className={className} aria-live="polite">
      {numberFormat.format(display)}
    </span>
  );
}
