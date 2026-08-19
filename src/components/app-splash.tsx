'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { isAppMode } from '~/lib/app-mode';

/**
 * Full-screen branded opening animation shown on every cold launch in app mode
 * (Capacitor native wrapper or installed PWA).  Regular browser visits never
 * see it — the component renders null after detecting it is not in app mode.
 *
 * In Capacitor: the native Capacitor SplashScreen is visible first; NativeInit
 * fades it away while this overlay is already painted underneath, handing off
 * seamlessly into the web animation.
 *
 * Respects prefers-reduced-motion: skips the sequence and just fades quickly.
 */
export function AppSplash() {
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (!isAppMode()) return;

    // Show the splash immediately on mount.
    setVisible(true);

    // How long to hold the branded screen before dismissing.
    const holdMs = prefersReduced ? 400 : 1400;
    const timer = setTimeout(() => setDone(true), holdMs);
    return () => clearTimeout(timer);
  }, [prefersReduced]);

  // Not in app mode — render nothing at all.
  if (!visible) return null;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="app-splash"
          initial={{ opacity: 1 }}
          exit={
            prefersReduced
              ? { opacity: 0, transition: { duration: 0.2 } }
              : { opacity: 0, y: -12, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }
          }
          // Cover everything, sit above every other layer.
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F8F4F0]"
          aria-hidden="true"
        >
          {/* P mark */}
          <motion.div
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.82 }}
            animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            transition={
              prefersReduced
                ? { duration: 0.2 }
                : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
            }
            className="mb-5"
          >
            {/* Inline the favicon SVG so we get crisp vector at any DPI with no network round-trip */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 64 64"
              aria-hidden="true"
              className="h-16 w-16 drop-shadow-sm"
            >
              <rect width="64" height="64" rx="12" fill="#f4efe5" />
              <path
                fill="#4b3224"
                d="M24 14h10c7.2 0 12 4.4 12 10.8 0 6.5-4.8 11.1-12 11.1h-5.2V50H24V14Zm9.4 18.1c4 0 6.6-2.4 6.6-6.1 0-3.6-2.6-5.9-6.6-5.9h-4.6v12z"
              />
            </svg>
          </motion.div>

          {/* Wordmark */}
          <motion.p
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={
              prefersReduced
                ? { duration: 0.2 }
                : { duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }
            }
            className="font-display text-[#4b3224] text-2xl font-bold tracking-[0.18em] uppercase select-none"
          >
            Provenance
          </motion.p>

          {/* Subtle tagline */}
          <motion.p
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={prefersReduced ? { opacity: 0.55 } : { opacity: 0.55, y: 0 }}
            transition={
              prefersReduced
                ? { duration: 0.2 }
                : { duration: 0.5, delay: 0.32, ease: [0.16, 1, 0.3, 1] }
            }
            className="mt-2 font-serif text-[#4b3224]/55 text-xs tracking-[0.12em] uppercase select-none"
          >
            Art · Objects · Histories
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
