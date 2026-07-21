'use client';

import { cn } from '@kit/ui/utils';
import type { TemplateId } from '~/app/_sites/types';
import {
  SITE_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_CATEGORY_ORDER,
  type SiteTemplateMeta,
} from '~/app/_sites/types';

type Props = {
  selectedId: TemplateId;
  onSelect: (id: TemplateId) => void;
};

function TemplateWireframe({ id }: { id: TemplateId }) {
  const base = 'rounded-sm bg-wine/15 border border-wine/20';

  switch (id) {
    case 'editorial':
      return (
        <div className="flex flex-col gap-1 h-full p-1">
          <div className={cn(base, 'h-3 w-full')} />
          <div className="flex gap-1 flex-1">
            <div className={cn(base, 'flex-1')} />
            <div className="flex flex-col gap-1 flex-1">
              <div className={cn(base, 'h-2')} />
              <div className={cn(base, 'flex-1')} />
            </div>
          </div>
        </div>
      );
    case 'atelier':
      return (
        <div className="flex flex-col gap-1 h-full p-1">
          <div className={cn(base, 'h-5 w-full')} />
          <div className={cn(base, 'h-2 w-3/4 mx-auto')} />
          <div className="flex gap-1 flex-1">
            <div className={cn(base, 'flex-1')} />
            <div className={cn(base, 'flex-1 mt-2')} />
          </div>
        </div>
      );
    case 'whitecube':
      return (
        <div className="flex flex-col items-center justify-center gap-1.5 h-full p-2">
          <div className={cn(base, 'w-8 h-10')} />
          <div className="w-6 h-0.5 bg-wine/25 rounded-full" />
        </div>
      );
    case 'pavilion':
      return (
        <div className="flex flex-col h-full p-1">
          <div className={cn(base, 'h-4 w-full bg-wine/30')} />
          <div className="h-1 w-2/3 bg-wine/40 mt-0.5 rounded-sm" />
          <div className="flex flex-col gap-0.5 mt-1 flex-1">
            <div className={cn(base, 'h-1')} />
            <div className={cn(base, 'h-1')} />
            <div className={cn(base, 'h-1')} />
          </div>
        </div>
      );
    case 'cabinet':
      return (
        <div className="flex h-full p-1 gap-1">
          {/* TOC rail */}
          <div className="flex flex-col gap-0.5 w-5 pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-0.5">
                <div className="w-1 h-0.5 bg-wine/40 rounded-sm" />
                <div className="flex-1 h-px border-b border-dotted border-wine/30" />
              </div>
            ))}
          </div>
          {/* Content area */}
          <div className="flex flex-col gap-1 flex-1">
            <div className={cn(base, 'h-5 w-full')} />
            <div className="flex gap-0.5 flex-1 mt-0.5">
              <div className={cn(base, 'flex-1')} />
              <div className="flex flex-col gap-0.5 flex-1">
                <div className={cn(base, 'h-1.5')} />
                <div className={cn(base, 'h-1')} />
              </div>
            </div>
          </div>
        </div>
      );
    case 'folio':
      return (
        <div className="flex flex-col items-center gap-1 h-full p-2">
          <div className={cn(base, 'w-6 h-8')} />
          <div className="w-4 h-0.5 bg-wine/20" />
          <div className={cn(base, 'w-6 h-8 opacity-60')} />
        </div>
      );
    case 'concrete':
      return (
        <div className="grid grid-cols-2 h-full border border-wine/30">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn(base, 'border-0 border-r border-b border-wine/30 rounded-none')} />
          ))}
        </div>
      );
    case 'lightbox':
      return (
        <div className="grid grid-cols-2 gap-0 h-full">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-wine/25 aspect-square" />
          ))}
        </div>
      );
    case 'noir':
      return (
        <div className="flex flex-col gap-1.5 h-full p-1 bg-black/80 rounded">
          <div className="w-full h-2 bg-white/15 rounded-sm" />
          <div className="w-3/4 h-3 bg-white/10 rounded-sm mx-auto" />
          <div className="w-full h-2 bg-white/15 rounded-sm" />
        </div>
      );
    default:
      return <div className={cn(base, 'h-full w-full')} />;
  }
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: SiteTemplateMeta;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'text-left rounded-lg border p-3 transition-all flex flex-col gap-2.5',
        selected
          ? 'border-wine bg-wine/5 shadow-sm ring-1 ring-wine/30'
          : 'border-wine/15 hover:border-wine/35 hover:bg-wine/[0.02]',
      )}
    >
      <div className="h-14 w-full overflow-hidden rounded-md bg-parchment/60 border border-wine/10">
        <TemplateWireframe id={template.id} />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display font-semibold text-ink text-xs">{template.name}</p>
          <p className="text-[9px] uppercase tracking-widest text-wine/50 font-serif flex-shrink-0">
            {template.bestFor}
          </p>
        </div>
        <p className="text-[11px] text-ink/55 font-serif leading-snug mt-1 line-clamp-2">
          {template.description}
        </p>
      </div>
    </button>
  );
}

export function TemplatePicker({ selectedId, onSelect }: Props) {
  return (
    <div className="space-y-6">
      {TEMPLATE_CATEGORY_ORDER.map((category) => {
        const templates = SITE_TEMPLATES.filter((t) => t.category === category);
        if (templates.length === 0) return null;

        return (
          <div key={category}>
            <p className="text-[10px] uppercase tracking-[0.2em] text-wine/50 font-serif mb-2.5">
              {TEMPLATE_CATEGORY_LABELS[category]}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  selected={selectedId === template.id}
                  onSelect={() => onSelect(template.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
