'use client';

import { useRef } from 'react';
import { cn } from '@kit/ui/utils';
import { SITE_ACCENTS } from '~/app/_sites/types';
import { resolveAccent } from '~/app/_sites/_templates/palette';

function isCustomAccentKey(key: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(key);
}

type Props = {
  value: string;
  onChange: (accent: string) => void;
};

export function AccentColorPicker({ value, onChange }: Props) {
  const isCustom = isCustomAccentKey(value);
  const customHex = isCustom ? value : '#4A2F25';
  const colorInputRef = useRef<HTMLInputElement>(null);

  function commitHex(raw: string) {
    const clean = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      onChange(clean);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 sm:gap-2.5">
        {SITE_ACCENTS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => onChange(a.key)}
            aria-label={`Accent color ${a.label}`}
            aria-pressed={!isCustom && value === a.key}
            className={cn(
              'flex flex-col items-center gap-1.5 transition-transform touch-manipulation min-w-[3.25rem]',
              !isCustom && value === a.key && 'scale-105',
            )}
          >
            <div
              className={cn(
                'w-11 h-11 sm:w-9 sm:h-9 rounded-full border-2 transition-all',
                !isCustom && value === a.key ? 'border-ink' : 'border-wine/20',
              )}
              style={{ background: a.value }}
            />
            <span className="text-[10px] font-serif text-ink/60 leading-none">{a.label}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          aria-label="Custom accent color"
          aria-pressed={isCustom}
          className={cn(
            'flex flex-col items-center gap-1.5 transition-transform touch-manipulation min-w-[3.25rem]',
            isCustom && 'scale-105',
          )}
        >
          <div
            className={cn(
              'w-11 h-11 sm:w-9 sm:h-9 rounded-full border-2 transition-all relative overflow-hidden',
              isCustom ? 'border-ink' : 'border-wine/20',
            )}
            style={{
              background: isCustom
                ? resolveAccent(value)
                : 'conic-gradient(from 0deg, #e74c3c, #f39c12, #2ecc71, #3498db, #9b59b6, #e74c3c)',
            }}
          >
            {!isCustom && (
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-serif font-semibold text-white drop-shadow">
                +
              </span>
            )}
          </div>
          <span className="text-[10px] font-serif text-ink/60 leading-none">Custom</span>
        </button>
      </div>

      <input
        ref={colorInputRef}
        type="color"
        value={isCustom ? value : customHex}
        className="sr-only"
        onChange={(e) => onChange(e.target.value)}
      />

      {isCustom && (
        <div className="flex items-center gap-2.5 pl-0.5">
          <button
            type="button"
            title="Pick custom accent color"
            onClick={() => colorInputRef.current?.click()}
            className="h-8 w-8 shrink-0 rounded-md border-2 border-wine/20 cursor-pointer transition-transform hover:scale-105"
            style={{ backgroundColor: resolveAccent(value) }}
          />
          <input
            key={value}
            type="text"
            defaultValue={value}
            maxLength={7}
            spellCheck={false}
            placeholder="#4A2F25"
            className="w-24 rounded-md border border-wine/20 px-2 py-1 font-mono text-xs font-serif bg-white focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/20"
            onBlur={(e) => commitHex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitHex(e.currentTarget.value);
            }}
          />
        </div>
      )}
    </div>
  );
}
