import { captureCrmContacts, type CaptureContactInput } from './capture-contact';

type ExhibitionCaptureInput = {
  curatorName?: string | null;
  artistNames?: string[];
  exhibitionTitle?: string | null;
};

export async function captureExhibitionContacts(
  actingUserId: string,
  input: ExhibitionCaptureInput,
): Promise<void> {
  const contacts: CaptureContactInput[] = [];
  const titleNote = input.exhibitionTitle?.trim()
    ? `Exhibition — ${input.exhibitionTitle.trim()}`
    : 'Exhibition contact';

  const curator = input.curatorName?.trim();
  if (curator) {
    contacts.push({ name: curator, source: 'exhibition', notes: titleNote });
  }

  for (const rawName of input.artistNames ?? []) {
    const name = rawName?.trim();
    if (name) {
      contacts.push({ name, source: 'exhibition', notes: titleNote });
    }
  }

  await captureCrmContacts(actingUserId, contacts);
}

type ExhibitionPlanCaptureInput = {
  lenderName?: string | null;
  lenderEmail?: string | null;
  curatorName?: string | null;
  curatorEmail?: string | null;
  exhibitionTitle?: string | null;
};

export async function captureExhibitionPlanContacts(
  actingUserId: string,
  input: ExhibitionPlanCaptureInput,
): Promise<void> {
  const contacts: CaptureContactInput[] = [];
  const titleNote = input.exhibitionTitle?.trim()
    ? `Exhibition plan — ${input.exhibitionTitle.trim()}`
    : 'Exhibition plan contact';

  const lenderName = input.lenderName?.trim();
  const lenderEmail = input.lenderEmail?.trim() || null;
  if (lenderName || lenderEmail) {
    contacts.push({
      name: lenderName || null,
      email: lenderEmail,
      source: 'exhibition',
      notes: titleNote,
    });
  }

  const curatorName = input.curatorName?.trim();
  const curatorEmail = input.curatorEmail?.trim() || null;
  if (curatorName || curatorEmail) {
    contacts.push({
      name: curatorName || null,
      email: curatorEmail,
      source: 'exhibition',
      notes: titleNote,
    });
  }

  await captureCrmContacts(actingUserId, contacts);
}
