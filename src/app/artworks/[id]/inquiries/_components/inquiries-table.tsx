'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@kit/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { updateInquiryStatus } from '../_actions/update-inquiry-status';
import type { Inquiry } from '../page';

const STATUS_LABELS: Record<Inquiry['status'], string> = {
  pending: 'Pending',
  contacted: 'Contacted',
  sold: 'Sold',
  closed: 'Closed',
};


function InquiryRow({ inquiry, artworkId }: { inquiry: Inquiry; artworkId: string }) {
  const [status, setStatus] = useState<Inquiry['status']>(inquiry.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStatusChange(newStatus: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateInquiryStatus(inquiry.id, artworkId, newStatus);
      if (result.ok) {
        setStatus(newStatus as Inquiry['status']);
      } else {
        setError(result.error ?? 'Failed to update');
      }
    });
  }

  const date = new Date(inquiry.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <tr className="border-b border-wine/10 hover:bg-parchment/40 transition-colors">
      <td className="px-4 py-4 align-top">
        <p className="font-serif text-sm font-medium text-ink">{inquiry.name}</p>
        <a
          href={`mailto:${inquiry.email}`}
          className="font-serif text-xs text-wine hover:underline"
        >
          {inquiry.email}
        </a>
      </td>
      <td className="px-4 py-4 align-top">
        <Badge
          className={
            inquiry.inquiry_type === 'purchase'
              ? 'bg-green-100 text-green-800 border-green-200'
              : 'bg-wine/10 text-wine border-wine/20'
          }
        >
          {inquiry.inquiry_type === 'purchase' ? 'Purchase' : 'Inquiry'}
        </Badge>
      </td>
      <td className="px-4 py-4 align-top max-w-xs">
        {inquiry.message ? (
          <p className="font-serif text-xs text-ink/70 leading-relaxed line-clamp-3">
            {inquiry.message}
          </p>
        ) : (
          <span className="font-serif text-xs text-ink/30 italic">No message</span>
        )}
      </td>
      <td className="px-4 py-4 align-top">
        <div className="space-y-1">
          <Select
            value={status}
            onValueChange={handleStatusChange}
            disabled={pending}
          >
            <SelectTrigger className="h-8 text-xs font-serif w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as Inquiry['status'][]).map((s) => (
                <SelectItem key={s} value={s} className="text-xs font-serif">
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-red-600 font-serif">{error}</p>}
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <span className="font-serif text-xs text-ink/50">{date}</span>
      </td>
    </tr>
  );
}

export function InquiriesTable({
  artworkId,
  initialInquiries,
}: {
  artworkId: string;
  initialInquiries: Inquiry[];
}) {
  return (
    <div className="rounded-xl border border-wine/20 bg-parchment/60 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-wine/20 bg-parchment">
              <th className="px-4 py-3 font-display text-xs uppercase tracking-widest text-ink/50">
                Contact
              </th>
              <th className="px-4 py-3 font-display text-xs uppercase tracking-widest text-ink/50">
                Type
              </th>
              <th className="px-4 py-3 font-display text-xs uppercase tracking-widest text-ink/50">
                Message
              </th>
              <th className="px-4 py-3 font-display text-xs uppercase tracking-widest text-ink/50">
                Status
              </th>
              <th className="px-4 py-3 font-display text-xs uppercase tracking-widest text-ink/50">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {initialInquiries.map((inq) => (
              <InquiryRow key={inq.id} inquiry={inq} artworkId={artworkId} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-wine/10">
        <p className="font-serif text-xs text-ink/40">
          {initialInquiries.length} {initialInquiries.length === 1 ? 'inquiry' : 'inquiries'}
        </p>
      </div>
    </div>
  );
}
