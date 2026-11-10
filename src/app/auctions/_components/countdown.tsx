'use client';

import { useEffect, useState } from 'react';

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`;
  return `${sec}s`;
}

/** Live "time left" until `to`. Turns wine-red in the last five minutes. */
export function Countdown({
  to,
  prefix = 'Closes in',
  endedLabel = 'Closing…',
  className = '',
}: {
  to: string;
  prefix?: string;
  endedLabel?: string;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const target = new Date(to).getTime();
  if (now == null) {
    return <span className={className}>{prefix} …</span>;
  }
  const left = target - now;
  if (left <= 0) return <span className={className}>{endedLabel}</span>;
  return (
    <span className={`${className} ${left < 5 * 60 * 1000 ? 'text-wine font-medium' : ''}`} suppressHydrationWarning>
      {prefix} {parts(left)}
    </span>
  );
}
