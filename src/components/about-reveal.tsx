"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type AboutRevealProps = {
  children: ReactNode;
  className?: string;
  /** Staggered children in a list (seconds). */
  delay?: number;
};

export function AboutReveal({ children, className, delay = 0 }: AboutRevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -72px 0px" }}
      transition={{
        duration: 0.55,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
