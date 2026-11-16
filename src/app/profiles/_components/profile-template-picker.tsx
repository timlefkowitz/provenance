'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';
import { updateProfileTemplate } from '~/app/artists/[id]/_actions/update-template';
import {
  TEMPLATE_OPTIONS,
  isValidTemplateId,
  type TemplateId,
} from '~/app/artists/[id]/_components/template-registry';

/** Picks the public-page template for one role profile (artist, gallery or institution). */
export function ProfileTemplatePicker({
  profileId,
  current,
  publicHref,
}: {
  profileId: string;
  current: string | null | undefined;
  publicHref: string;
}) {
  const [selected, setSelected] = useState<TemplateId | null>(
    isValidTemplateId(current ?? undefined) ? (current as TemplateId) : null,
  );
  const [isPending, startTransition] = useTransition();

  const choose = (templateId: TemplateId | null) => {
    if (templateId === selected) return;
    const previous = selected;
    setSelected(templateId);
    startTransition(async () => {
      const result = await updateProfileTemplate(profileId, templateId);
      if (result?.error) {
        setSelected(previous);
        toast.error(result.error);
      } else {
        toast.success('Template updated');
      }
    });
  };

  const options: { id: TemplateId | null; label: string }[] = [
    { id: null, label: 'Default' },
    ...TEMPLATE_OPTIONS.map((t) => ({ id: t.id, label: t.label })),
  ];

  return (
    <Card className="border-wine/20">
      <CardHeader>
        <CardTitle className="font-display text-wine">Page Template</CardTitle>
        <CardDescription className="font-serif">
          How this profile&apos;s public page looks. Applies to this profile only.{' '}
          <Link href={publicHref} className="text-wine underline hover:text-wine/80">
            View page
          </Link>
          {' '}— you can also switch templates there with the Templates button.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const active = selected === opt.id;
            return (
              <button
                key={opt.id ?? 'default'}
                type="button"
                disabled={isPending}
                onClick={() => choose(opt.id)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-1.5 font-serif text-sm transition-colors disabled:opacity-60 ${
                  active
                    ? 'border-wine bg-wine text-parchment'
                    : 'border-wine/30 text-ink hover:bg-wine/10'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
