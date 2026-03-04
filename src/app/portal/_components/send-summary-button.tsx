'use client';

import { useTransition } from 'react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { sendActivitySummaryEmail } from '../_actions/send-activity-summary-email';

export function SendSummaryButton() {
  const [pending, startTransition] = useTransition();

  const handleSend = () => {
    startTransition(async () => {
      const result = await sendActivitySummaryEmail();
      if (result.success) {
        toast.success('Summary sent! Check your email.');
      } else {
        toast.error(result.error ?? 'Failed to send summary');
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="font-serif text-wine hover:text-wine/80"
      onClick={handleSend}
      disabled={pending}
    >
      {pending ? 'Sending...' : 'Email my summary'}
    </Button>
  );
}
