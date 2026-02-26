"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

type LandingSectionProps = {
  children: React.ReactNode;
  /** Optional parallax: move content at a different rate (e.g. 0.3 = slower, 1 = normal) */
  parallax?: number;
  /** Section id for anchor / scroll */
  id?: string;
  className?: string;
};

export function LandingSection({
  children,
  parallax = 1,
  id,
  className = "",
}: LandingSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    parallax !== 1
      ? [40 * (1 - parallax), 0, -40 * (1 - parallax)]
      : [0, 0, 0]
  );

  // Scroll-driven storytelling: each section reveals as it enters the viewport
  const contentOpacity = useTransform(
    scrollYProgress,
    [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1],
    [0, 0.4, 1, 1, 1, 0.4, 0]
  );
  const contentY = useTransform(scrollYProgress, [0, 0.3], [40, 0]);
  const contentScale = useTransform(scrollYProgress, [0, 0.25], [0.96, 1]);

  return (
    <motion.section
      id={id}
      ref={ref}
      style={parallax !== 1 ? { y } : undefined}
      className={className}
    >
      <motion.div
        className="min-h-full flex flex-col justify-center"
        style={{
          opacity: contentOpacity,
          y: contentY,
          scale: contentScale,
        }}
      >
        {children}
      </motion.div>
    </motion.section>
  );
}
