'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@kit/ui/accordion';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import {
  Building2,
  Lightbulb,
  ListChecks,
  ListTodo,
  Plus,
  Sparkles,
  Trash2,
  UserCircle2,
  Zap,
} from 'lucide-react';

import type { CrmIntelFormState } from '../_actions/crm-intel';

type Props = {
  value: CrmIntelFormState;
  onChange: (next: CrmIntelFormState) => void;
};

export function CrmDealIntelFields({ value, onChange }: Props) {
  const patch = (partial: Partial<CrmIntelFormState>) => {
    onChange({ ...value, ...partial });
  };

  const patchStakeholder = (index: number, field: 'name' | 'role' | 'email', text: string) => {
    const stakeholders = [...(value.stakeholders ?? [])];
    stakeholders[index] = { ...stakeholders[index], [field]: text };
    patch({ stakeholders });
  };

  const addStakeholder = () => {
    patch({ stakeholders: [...(value.stakeholders ?? []), { name: '', role: '', email: '' }] });
  };

  const removeStakeholder = (index: number) => {
    const stakeholders = (value.stakeholders ?? []).filter((_, i) => i !== index);
    patch({
      stakeholders:
        stakeholders.length > 0 ? stakeholders : [{ name: '', role: '', email: '' }],
    });
  };

  return (
    <Accordion type="multiple" className="w-full border border-wine/15 rounded-lg px-3 bg-parchment/30">
      <AccordionItem value="org" className="border-wine/10">
        <AccordionTrigger className="text-xs font-serif font-semibold text-ink hover:no-underline py-3">
          <span className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-wine/70 shrink-0" />
            Organization &amp; systems
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pt-1">
          <div className="grid gap-1.5">
            <Label htmlFor="intel-account" className="text-xs font-serif text-ink/60">
              Account / institution
            </Label>
            <Input
              id="intel-account"
              placeholder="e.g. San Antonio museum"
              value={value.account_name}
              onChange={(e) => patch({ account_name: e.target.value })}
              className="font-serif text-sm border-wine/20"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="intel-systems" className="text-xs font-serif text-ink/60">
              Systems in use (current · planned)
            </Label>
            <Textarea
              id="intel-systems"
              placeholder="e.g. Temp shows tracked outside collections DB; long-term loans in internal system…"
              value={value.current_system_notes}
              onChange={(e) => patch({ current_system_notes: e.target.value })}
              rows={3}
              className="font-serif text-sm border-wine/20 resize-y min-h-[72px]"
            />
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="pain" className="border-wine/10">
        <AccordionTrigger className="text-xs font-serif font-semibold text-ink hover:no-underline py-3">
          <span className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-600/80 shrink-0" />
            Pain points
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-[11px] text-ink/45 font-serif mb-2">One per line.</p>
          <Textarea
            placeholder="Registrar load&#10;Loan transparency&#10;Too many form fields…"
            value={value.pain_points_text}
            onChange={(e) => patch({ pain_points_text: e.target.value })}
            rows={4}
            className="font-serif text-sm border-wine/20"
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="next" className="border-wine/10">
        <AccordionTrigger className="text-xs font-serif font-semibold text-ink hover:no-underline py-3">
          <span className="flex items-center gap-2">
            <ListTodo className="h-3.5 w-3.5 text-emerald-700/80 shrink-0" />
            Next steps
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-[11px] text-ink/45 font-serif mb-2">One per line — dated if you like.</p>
          <Textarea
            placeholder="Send institution link within 1 week&#10;Follow-up email with questions…"
            value={value.next_steps_text}
            onChange={(e) => patch({ next_steps_text: e.target.value })}
            rows={4}
            className="font-serif text-sm border-wine/20"
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="insights" className="border-wine/10">
        <AccordionTrigger className="text-xs font-serif font-semibold text-ink hover:no-underline py-3">
          <span className="flex items-center gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-violet-600/80 shrink-0" />
            Key insights
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <Textarea
            placeholder="What you learned that changes how you sell or build…"
            value={value.key_insights_text}
            onChange={(e) => patch({ key_insights_text: e.target.value })}
            rows={4}
            className="font-serif text-sm border-wine/20"
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="pm" className="border-wine/10">
        <AccordionTrigger className="text-xs font-serif font-semibold text-ink hover:no-underline py-3">
          <span className="flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5 text-sky-600/80 shrink-0" />
            Positives &amp; negatives
          </span>
        </AccordionTrigger>
        <AccordionContent className="grid sm:grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs font-serif text-ink/60 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-emerald-600" /> Positives
            </Label>
            <Textarea
              placeholder="Phone-friendly flow&#10;COA at sale…"
              value={value.positives_text}
              onChange={(e) => patch({ positives_text: e.target.value })}
              rows={4}
              className="font-serif text-sm border-wine/20"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-serif text-ink/60">Risks / concerns</Label>
            <Textarea
              placeholder="QR on object hesitation&#10;Data migration manual…"
              value={value.negatives_text}
              onChange={(e) => patch({ negatives_text: e.target.value })}
              rows={4}
              className="font-serif text-sm border-wine/20"
            />
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="people" className="border-b-0 border-wine/10">
        <AccordionTrigger className="text-xs font-serif font-semibold text-ink hover:no-underline py-3">
          <span className="flex items-center gap-2">
            <UserCircle2 className="h-3.5 w-3.5 text-wine/70 shrink-0" />
            Stakeholders at account
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-3">
          <p className="text-[11px] text-ink/45 font-serif">
            People beyond the primary contact on this card (registrar, director, etc.).
          </p>
          {(value.stakeholders ?? []).map((row, index) => (
            <div
              key={index}
              className="grid gap-2 p-3 rounded-lg bg-white/80 border border-wine/10 relative"
            >
              {(value.stakeholders ?? []).length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStakeholder(index)}
                  className="absolute top-2 right-2 p-1 rounded text-ink/25 hover:text-red-600 hover:bg-red-50"
                  aria-label="Remove stakeholder"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pr-6">
                <div className="grid gap-1">
                  <Label className="text-[10px] font-serif text-ink/50">Name</Label>
                  <Input
                    placeholder="Name"
                    value={row.name}
                    onChange={(e) => patchStakeholder(index, 'name', e.target.value)}
                    className="h-8 text-xs font-serif border-wine/20"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-serif text-ink/50">Role</Label>
                  <Input
                    placeholder="Registrar"
                    value={row.role}
                    onChange={(e) => patchStakeholder(index, 'role', e.target.value)}
                    className="h-8 text-xs font-serif border-wine/20"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-serif text-ink/50">Email</Label>
                  <Input
                    type="email"
                    placeholder="email"
                    value={row.email}
                    onChange={(e) => patchStakeholder(index, 'email', e.target.value)}
                    className="h-8 text-xs font-serif border-wine/20"
                  />
                </div>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-serif h-8 border-wine/25 text-wine"
            onClick={addStakeholder}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add stakeholder
          </Button>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
