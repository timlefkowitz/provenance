'use client';

import { useState, useId, useRef } from 'react';
import type { PortfolioPoint } from '~/lib/portal-graphs/types';
import { formatMoneyCompact, formatMoney } from '~/lib/portal-graphs/types';

interface ValueLineChartProps {
  series: PortfolioPoint[];
  height?: number;
}

const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function monthLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short' });
}

export function ValueLineChart({ series, height = 180 }: ValueLineChartProps) {
  const uid = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!series || series.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm font-serif text-ink/40"
      >
        No data yet
      </div>
    );
  }

  // Compute chart bounds
  const allValues = series.map((p) => p.value_cents);
  const allLow = series.map((p) => p.low_cents);
  const allHigh = series.map((p) => p.high_cents);
  const dataMin = Math.min(...allLow);
  const dataMax = Math.max(...allHigh);
  const range = dataMax - dataMin || 1;

  const W = 500; // viewBox width
  const H = height;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  function xOf(i: number): number {
    if (series.length === 1) return PAD_LEFT + chartW / 2;
    return PAD_LEFT + (i / (series.length - 1)) * chartW;
  }

  function yOf(cents: number): number {
    return PAD_TOP + chartH - ((cents - dataMin) / range) * chartH;
  }

  // Build SVG path strings
  const linePts = series.map((p, i) => `${xOf(i)},${yOf(p.value_cents)}`).join(' L ');
  const linePath = `M ${linePts}`;

  // Confidence band (area between low and high)
  const bandTopPts = series.map((p, i) => `${xOf(i)},${yOf(p.high_cents)}`).join(' L ');
  const bandBottomPts = [...series]
    .reverse()
    .map((p, ri) => `${xOf(series.length - 1 - ri)},${yOf(p.low_cents)}`)
    .join(' L ');
  const bandPath = `M ${bandTopPts} L ${bandBottomPts} Z`;

  // Y-axis labels — 3 ticks
  const yTicks = [dataMin, dataMin + range / 2, dataMax];

  // Hovered point
  const hovered = hoveredIdx !== null ? series[hoveredIdx] : null;
  const tooltipX = hoveredIdx !== null ? xOf(hoveredIdx) : 0;
  const tooltipY = hoveredIdx !== null ? yOf(series[hoveredIdx]!.value_cents) : 0;

  return (
    <div className="relative w-full select-none" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          {/* Confidence band gradient: parchment-tinted wine */}
          <linearGradient id={`${uid}-band`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c1c35" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#7c1c35" stopOpacity="0.04" />
          </linearGradient>
          {/* Line gradient */}
          <linearGradient id={`${uid}-line`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c1c35" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#7c1c35" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Subtle horizontal gridlines */}
        {yTicks.map((v, i) => (
          <line
            key={i}
            x1={PAD_LEFT}
            y1={yOf(v)}
            x2={W - PAD_RIGHT}
            y2={yOf(v)}
            stroke="#7c1c35"
            strokeOpacity="0.08"
            strokeDasharray="3 4"
            strokeWidth="1"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((v, i) => (
          <text
            key={i}
            x={PAD_LEFT - 4}
            y={yOf(v) + 4}
            textAnchor="end"
            fontSize="9"
            fontFamily="Georgia, serif"
            fill="rgba(30,20,15,0.45)"
          >
            {formatMoneyCompact(v)}
          </text>
        ))}

        {/* Confidence band */}
        <path
          d={bandPath}
          fill={`url(#${uid}-band)`}
          stroke="none"
        />

        {/* Main line */}
        <path
          d={linePath}
          fill="none"
          stroke={`url(#${uid}-line)`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X-axis month labels — every other month to avoid crowding */}
        {series.map((p, i) => {
          if (series.length > 6 && i % 2 !== 0) return null;
          return (
            <text
              key={p.month}
              x={xOf(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize="9"
              fontFamily="Georgia, serif"
              fill="rgba(30,20,15,0.45)"
            >
              {monthLabel(p.month)}
            </text>
          );
        })}

        {/* Invisible wider hit-areas per data point */}
        {series.map((p, i) => (
          <rect
            key={p.month}
            x={xOf(i) - (chartW / series.length) / 2}
            y={PAD_TOP}
            width={chartW / series.length}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}

        {/* Hovered dot + crosshair */}
        {hovered !== null && hoveredIdx !== null && (
          <>
            <line
              x1={tooltipX}
              y1={PAD_TOP}
              x2={tooltipX}
              y2={PAD_TOP + chartH}
              stroke="#7c1c35"
              strokeOpacity="0.25"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={tooltipX}
              cy={tooltipY}
              r={5}
              fill="#7c1c35"
              stroke="white"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {/* Tooltip — positioned absolutely */}
      {hovered !== null && hoveredIdx !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-wine/20 bg-parchment shadow-md px-3 py-2 text-xs font-serif"
          style={{
            left: `${(tooltipX / W) * 100}%`,
            top: `${(tooltipY / height) * 100}%`,
            transform: 'translate(-50%, -120%)',
            minWidth: 120,
          }}
        >
          <p className="text-ink/50 mb-0.5">{new Date(hovered.month + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          <p className="font-semibold text-wine text-sm">{formatMoney(hovered.value_cents)}</p>
          {hovered.low_cents !== hovered.value_cents && (
            <p className="text-ink/40 text-[10px]">
              {formatMoneyCompact(hovered.low_cents)} – {formatMoneyCompact(hovered.high_cents)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
