'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { isAppMode } from '~/lib/app-mode';
import { LAUNCH_NAVIGATION_EVENT, LAUNCH_TARGET_KEY } from '~/lib/capacitor/incoming-link';

/** Never hold the splash longer than this waiting for a launch link. */
const MAX_LINK_HOLD_MS = 10_000;

/** Whether the head script just replaced the landing page with this launch link. */
function arrivedViaLaunchLink(): boolean {
  try {
    const target = sessionStorage.getItem(LAUNCH_TARGET_KEY);
    if (!target) return false;
    sessionStorage.removeItem(LAUNCH_TARGET_KEY);
    return target === `${window.location.pathname}${window.location.search}`;
  } catch {
    return false;
  }
}

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
  const [minElapsed, setMinElapsed] = useState(false);
  /** Path a scanned / tapped launch link is navigating to; hold until it renders. */
  const [linkTarget, setLinkTarget] = useState<string | null>(null);
  const [linkTimedOut, setLinkTimedOut] = useState(false);
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (!isAppMode()) return;
    // The head script already opened the scanned page and it is on screen —
    // don't cover it with the opening animation.
    if (arrivedViaLaunchLink()) return;

    // Show the splash immediately on mount.
    setVisible(true);

    // How long to hold the branded screen before dismissing.
    const holdMs = prefersReduced ? 500 : 2100;
    const timer = setTimeout(() => setMinElapsed(true), holdMs);

    // A launch link (QR scan, tapped link) is being opened: stay up until that
    // page has rendered so the landing feed never flashes in between.
    let capTimer: ReturnType<typeof setTimeout> | undefined;
    const onLaunchNavigation = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail !== 'string') return;
      setLinkTarget(detail.split('?')[0] ?? detail);
      clearTimeout(capTimer);
      capTimer = setTimeout(() => setLinkTimedOut(true), MAX_LINK_HOLD_MS);
    };
    window.addEventListener(LAUNCH_NAVIGATION_EVENT, onLaunchNavigation);

    return () => {
      clearTimeout(timer);
      clearTimeout(capTimer);
      window.removeEventListener(LAUNCH_NAVIGATION_EVENT, onLaunchNavigation);
    };
  }, [prefersReduced]);

  const waitingForLink = linkTarget !== null && pathname !== linkTarget && !linkTimedOut;
  const done = minElapsed && !waitingForLink;

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
              : { opacity: 0, filter: 'blur(6px)', transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } }
          }
          // Cover everything, sit above every other layer.
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F8F4F0]"
          aria-hidden="true"
        >
          <Wordmark reduced={!!prefersReduced} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const WORD = 'provenance';
const INK = '#4b3224';
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * "provenance" set in Cormorant: each letter surfaces out of a soft blur like
 * ink settling into paper, the tracking tightens as it lands, then a gilt
 * glint sweeps across and a hairline is ruled beneath — a signature on a
 * ledger.
 */
function Wordmark({ reduced }: { reduced: boolean }) {
  const type =
    'font-[family-name:var(--font-cormorant)] text-[clamp(2.75rem,13vw,4.5rem)] font-light leading-none tracking-[0.04em] lowercase select-none';

  if (reduced) {
    return (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className={type}
        style={{ color: INK }}
      >
        {WORD}
      </motion.p>
    );
  }

  return (
    <div className="relative flex flex-col items-center">
      <motion.p
        className={`relative ${type}`}
        style={{ color: INK }}
        initial={{ letterSpacing: '0.32em' }}
        animate={{ letterSpacing: '0.04em' }}
        transition={{ duration: 1.3, ease: EASE }}
      >
        {WORD.split('').map((ch, i) => (
          <motion.span
            key={i}
            className="inline-block"
            initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.85, delay: 0.1 + i * 0.045, ease: EASE }}
          >
            {ch}
          </motion.span>
        ))}

        {/* Gilt glint: a gradient clipped to a copy of the word, swept once. */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-clip-text text-transparent"
          style={{
            backgroundImage:
              'linear-gradient(105deg, transparent 35%, #e9cf94 47%, #fff6df 50%, #e9cf94 53%, transparent 65%)',
            backgroundSize: '250% 100%',
            WebkitBackgroundClip: 'text',
          }}
          initial={{ backgroundPosition: '120% 0', opacity: 0 }}
          animate={{ backgroundPosition: '-20% 0', opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.9, delay: 1.05, ease: 'easeInOut' }}
        >
          {WORD}
        </motion.span>
      </motion.p>

      {/* Hairline ruled out from the centre. */}
      <motion.span
        aria-hidden="true"
        className="mt-4 block h-px w-24 origin-center"
        style={{ background: `linear-gradient(90deg, transparent, ${INK}66, transparent)` }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.75, ease: EASE }}
      />
    </div>
  );
}
