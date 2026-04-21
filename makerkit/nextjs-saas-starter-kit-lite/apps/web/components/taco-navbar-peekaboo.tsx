'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

const PEEK_INTERVAL_MIN = 8000;
const PEEK_INTERVAL_MAX = 22000;
const PEEK_DURATION = 3200;

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random horizontal offset within the logo width (roughly 95px wide)
function randomLogoOffset() {
  return randomBetween(-8, 88);
}

export function TacoNavbarPeekaboo() {
  const [visible, setVisible] = useState(false);
  const [xOffset, setXOffset] = useState(20);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePeek = () => {
    const delay = randomBetween(PEEK_INTERVAL_MIN, PEEK_INTERVAL_MAX);
    timerRef.current = setTimeout(() => {
      setXOffset(randomLogoOffset());
      setVisible(true);
      setTimeout(() => {
        setVisible(false);
        schedulePeek();
      }, PEEK_DURATION);
    }, delay);
  };

  useEffect(() => {
    schedulePeek();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-full z-50"
      style={{ left: xOffset }}
    >
      <div
        className={`transition-all duration-500 ease-out ${
          visible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0'
        }`}
      >
        <div className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-pink-400/60 shadow-lg shadow-pink-400/20">
          <Image
            src="/taco-cat.png"
            alt=""
            fill
            className="object-cover object-top"
            sizes="36px"
          />
        </div>
      </div>
    </div>
  );
}
