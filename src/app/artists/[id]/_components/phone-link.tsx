import { Phone } from 'lucide-react';

import { formatPhone, phoneHref } from '~/lib/phone';

/** Tap-to-call link for a phone number the profile owner chose to show. */
export function PhoneLink({ phone }: { phone: string }) {
  return (
    <a
      href={phoneHref(phone)}
      className="flex items-center gap-2 text-wine hover:text-wine/80 hover:underline font-serif text-sm"
    >
      <Phone className="h-4 w-4 shrink-0" />
      <span>{formatPhone(phone)}</span>
    </a>
  );
}
