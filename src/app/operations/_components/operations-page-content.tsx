'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import type {
  InvoiceRow,
  LoanAgreementRow,
  OperationsArtworkOption,
} from '../page';
import {
  createLoanAgreement,
  duplicateLoanAgreement,
  markLoanAgreementSent,
  markLoanAgreementSigned,
  updateLoanAgreement,
} from '../_actions/loan-agreements';
import {
  createInvoice,
  duplicateInvoice,
  markInvoicePaid,
  markInvoiceSent,
  updateInvoice,
} from '../_actions/invoices';
import { LoanArtworkPicker } from './loan-artwork-picker';
import { Clock } from 'lucide-react';

type Props = {
  initialLoans: LoanAgreementRow[];
  initialInvoices: InvoiceRow[];
  artworks: OperationsArtworkOption[];
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(cents / 100);
}

function invoiceSubtotal(inv: InvoiceRow) {
  return inv.invoice_line_items.reduce(
    (s, l) => s + Math.round(Number(l.quantity) * l.unit_amount_cents),
    0,
  );
}

function formatShortDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function insuranceSnippet(text: string | null) {
  if (!text?.trim()) return '—';
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}

function ComingSoonTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-2xl rounded-md border border-wine/15 bg-parchment/40 p-8">
      <Badge variant="secondary" className="mb-4 font-serif">
        Coming soon
      </Badge>
      <div className="flex gap-4">
        <Clock className="h-10 w-10 shrink-0 text-wine/40" aria-hidden />
        <div>
          <h3 className="font-display text-lg text-wine">{title}</h3>
          <p className="mt-2 font-serif text-sm text-ink/70">{description}</p>
        </div>
      </div>
    </div>
  );
}

const loanStatuses = ['draft', 'sent', 'signed', 'active', 'closed'] as const;
const invoiceStatuses = ['draft', 'sent', 'partial', 'paid', 'overdue'] as const;

export function OperationsPageContent({ initialLoans, initialInvoices, artworks }: Props) {
  const router = useRouter();
  const [savingLoan, setSavingLoan] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);

  const [loanOpen, setLoanOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanAgreementRow | null>(null);
  const [loanArtworkId, setLoanArtworkId] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerEmail, setBorrowerEmail] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [lenderEmail, setLenderEmail] = useState('');
  const [loanStart, setLoanStart] = useState('');
  const [loanEnd, setLoanEnd] = useState('');
  const [termsText, setTermsText] = useState('');
  const [conditionsText, setConditionsText] = useState('');
  const [insuranceText, setInsuranceText] = useState('');
  const [loanStatus, setLoanStatus] = useState<string>('draft');
  const [loanPickerSeed, setLoanPickerSeed] = useState(0);

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null);
  const [invClientName, setInvClientName] = useState('');
  const [invClientEmail, setInvClientEmail] = useState('');
  const [invCurrency, setInvCurrency] = useState('USD');
  const [invDue, setInvDue] = useState('');
  const [invTaxDollars, setInvTaxDollars] = useState('0');
  const [invNotes, setInvNotes] = useState('');
  const [invArtworkId, setInvArtworkId] = useState<string>('');
  const [invStatus, setInvStatus] = useState<string>('draft');
  const [invLines, setInvLines] = useState<{ description: string; qty: string; unitDollars: string }[]>(
    [{ description: '', qty: '1', unitDollars: '0' }],
  );

  const artworkTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of artworks) m.set(a.id, a.title);
    return m;
  }, [artworks]);

  const defaultArtworkId = artworks[0]?.id ?? '';

  function openCreateLoan() {
    setEditingLoan(null);
    setLoanArtworkId(defaultArtworkId);
    setBorrowerName('');
    setBorrowerEmail('');
    setLenderName('');
    setLenderEmail('');
    setLoanStart('');
    setLoanEnd('');
    setTermsText('');
    setConditionsText('');
    setInsuranceText('');
    setLoanStatus('draft');
    setLoanPickerSeed((s) => s + 1);
    setLoanOpen(true);
  }

  function openEditLoan(row: LoanAgreementRow) {
    setEditingLoan(row);
    setLoanArtworkId(row.artwork_id);
    setBorrowerName(row.borrower_name);
    setBorrowerEmail(row.borrower_email ?? '');
    setLenderName(row.lender_name ?? '');
    setLenderEmail(row.lender_email ?? '');
    setLoanStart(row.start_date ?? '');
    setLoanEnd(row.end_date ?? '');
    setTermsText(row.terms_text ?? '');
    setConditionsText(row.conditions_text ?? '');
    setInsuranceText(row.insurance_requirements_text ?? '');
    setLoanStatus(row.status);
    setLoanPickerSeed((s) => s + 1);
    setLoanOpen(true);
  }

  function openCreateInvoice() {
    setEditingInvoice(null);
    setInvClientName('');
    setInvClientEmail('');
    setInvCurrency('USD');
    setInvDue('');
    setInvTaxDollars('0');
    setInvNotes('');
    setInvArtworkId('');
    setInvStatus('draft');
    setInvLines([{ description: '', qty: '1', unitDollars: '0' }]);
    setInvoiceOpen(true);
  }

  function openEditInvoice(row: InvoiceRow) {
    setEditingInvoice(row);
    setInvClientName(row.client_name);
    setInvClientEmail(row.client_email ?? '');
    setInvCurrency(row.currency);
    setInvDue(row.due_date ?? '');
    setInvTaxDollars(String((row.tax_cents ?? 0) / 100));
    setInvNotes(row.notes ?? '');
    setInvArtworkId(row.artwork_id ?? '');
    setInvStatus(row.status);
    setInvLines(
      row.invoice_line_items.map((l) => ({
        description: l.description,
        qty: String(l.quantity),
        unitDollars: String(l.unit_amount_cents / 100),
      })),
    );
    setInvoiceOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  async function submitLoan() {
    setSavingLoan(true);
    try {
      if (!loanArtworkId) {
        toast.error('Select an artwork for this agreement.');
        return;
      }
      if (!borrowerName.trim()) {
        toast.error('Borrower name is required.');
        return;
      }

      if (editingLoan) {
      const res = await updateLoanAgreement({
        id: editingLoan.id,
        artwork_id: loanArtworkId,
        borrower_name: borrowerName.trim(),
        borrower_email: borrowerEmail.trim(),
        lender_name: lenderName.trim(),
        lender_email: lenderEmail.trim(),
        start_date: loanStart,
        end_date: loanEnd,
        terms_text: termsText,
        conditions_text: conditionsText,
        insurance_requirements_text: insuranceText,
        status: loanStatus as (typeof loanStatuses)[number],
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success('Loan agreement updated.');
    } else {
      const res = await createLoanAgreement({
        artwork_id: loanArtworkId,
        borrower_name: borrowerName.trim(),
        borrower_email: borrowerEmail.trim(),
        lender_name: lenderName.trim(),
        lender_email: lenderEmail.trim(),
        start_date: loanStart,
        end_date: loanEnd,
        terms_text: termsText,
        conditions_text: conditionsText,
        insurance_requirements_text: insuranceText,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success('Loan agreement created.');
    }
      setLoanOpen(false);
      refresh();
    } finally {
      setSavingLoan(false);
    }
  }

  function parseInvoiceLines():
    | { ok: true; lines: { description: string; quantity: number; unit_amount_cents: number }[] }
    | { ok: false; error: string } {
    const lines: { description: string; quantity: number; unit_amount_cents: number }[] = [];
    for (const row of invLines) {
      const qty = Number(row.qty);
      const unit = Number(row.unitDollars);
      if (!row.description.trim()) {
        return { ok: false, error: 'Each line needs a description.' };
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return { ok: false, error: 'Line quantities must be positive numbers.' };
      }
      if (!Number.isFinite(unit) || unit < 0) {
        return { ok: false, error: 'Line amounts must be valid numbers.' };
      }
      lines.push({
        description: row.description.trim(),
        quantity: qty,
        unit_amount_cents: Math.round(unit * 100),
      });
    }
    return { ok: true, lines };
  }

  async function submitInvoice() {
    setSavingInvoice(true);
    try {
      if (!invClientName.trim()) {
        toast.error('Client name is required.');
        return;
      }
      const parsed = parseInvoiceLines();
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }
      const taxCents = Math.round((Number(invTaxDollars) || 0) * 100);
      if (!Number.isFinite(taxCents) || taxCents < 0) {
        toast.error('Tax must be a valid amount.');
        return;
      }

      if (editingInvoice) {
      const res = await updateInvoice({
        id: editingInvoice.id,
        client_name: invClientName.trim(),
        client_email: invClientEmail.trim(),
        currency: invCurrency,
        due_date: invDue,
        tax_cents: taxCents,
        notes: invNotes.trim() || null,
        artwork_id: invArtworkId || null,
        status: invStatus as (typeof invoiceStatuses)[number],
        line_items: parsed.lines,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success('Invoice updated.');
    } else {
      const res = await createInvoice({
        client_name: invClientName.trim(),
        client_email: invClientEmail.trim(),
        currency: invCurrency,
        due_date: invDue,
        tax_cents: taxCents,
        notes: invNotes.trim() || undefined,
        artwork_id: invArtworkId || null,
        line_items: parsed.lines,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success('Invoice created.');
    }
      setInvoiceOpen(false);
      refresh();
    } finally {
      setSavingInvoice(false);
    }
  }

  const loansEmpty = initialLoans.length === 0;
  const invoicesEmpty = initialInvoices.length === 0;
  const busy = savingLoan || savingInvoice;

  return (
    <>
      <Tabs defaultValue="loans" className="w-full">
        <TabsList className="mb-6 flex h-auto min-h-10 w-full flex-wrap items-center justify-start gap-1 bg-parchment border border-wine/20">
          <TabsTrigger value="loans" className="font-serif data-[state=active]:bg-wine/10">
            Loan Management
          </TabsTrigger>
          <TabsTrigger value="invoices" className="font-serif data-[state=active]:bg-wine/10">
            Financial Tracking & Budgeting
          </TabsTrigger>
          <TabsTrigger value="shipping" className="font-serif data-[state=active]:bg-wine/10">
            Shipping & Logistics Tracking
          </TabsTrigger>
          <TabsTrigger value="insurance" className="font-serif data-[state=active]:bg-wine/10">
            Insurance & Valuation Management
          </TabsTrigger>
          <TabsTrigger value="condition" className="font-serif data-[state=active]:bg-wine/10">
            Condition & Conservation Reports
          </TabsTrigger>
          <TabsTrigger value="acquisition" className="font-serif data-[state=active]:bg-wine/10">
            Acquisition & Accession Workflows
          </TabsTrigger>
          <TabsTrigger value="exhibitions" className="font-serif data-[state=active]:bg-wine/10">
            Exhibition Planning & Object Scheduling
          </TabsTrigger>
          <TabsTrigger value="inventory" className="font-serif data-[state=active]:bg-wine/10">
            Inventory & Location Tracking
          </TabsTrigger>
          <TabsTrigger value="vendors" className="font-serif data-[state=active]:bg-wine/10">
            Vendor & Partner Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="loans" className="space-y-4">
          <p className="text-ink/70 font-serif text-sm max-w-3xl">
            Generate and manage artwork loan agreements: terms, conditions, insurance requirements, and
            signature status. Export a PDF for your records (MVP — obtain legal review before use).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              disabled={!artworks.length || savingLoan}
              onClick={openCreateLoan}
            >
              New loan agreement
            </Button>
            {!artworks.length ? (
              <span className="text-sm text-ink/60 font-serif self-center">
                Add an artwork to your collection to create agreements.
              </span>
            ) : null}
          </div>

          {loansEmpty ? (
            <p className="text-ink/55 font-serif text-sm py-8">No loan agreements yet.</p>
          ) : (
            <div className="rounded-md border border-wine/15 bg-parchment/40 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-display text-wine">Artwork</TableHead>
                    <TableHead className="font-display text-wine">Borrower</TableHead>
                    <TableHead className="font-display text-wine">Period</TableHead>
                    <TableHead className="font-display text-wine">Status</TableHead>
                    <TableHead className="font-display text-wine">Insurance</TableHead>
                    <TableHead className="font-display text-wine">Updated</TableHead>
                    <TableHead className="text-right font-display text-wine">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialLoans.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-serif max-w-[10rem]">
                        {row.artwork ? (
                          <Link href={`/artworks/${row.artwork.id}`} className="text-wine underline">
                            {row.artwork.title}
                          </Link>
                        ) : (
                          artworkTitleById.get(row.artwork_id) ?? '—'
                        )}
                      </TableCell>
                      <TableCell className="font-serif">
                        <div className="font-medium">{row.borrower_name}</div>
                        {row.borrower_email ? (
                          <div className="text-xs text-ink/60">{row.borrower_email}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-serif text-sm whitespace-nowrap">
                        {formatShortDate(row.start_date)} → {formatShortDate(row.end_date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-serif capitalize">
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-serif text-xs text-ink/70 max-w-[12rem]">
                        {insuranceSnippet(row.insurance_requirements_text)}
                      </TableCell>
                      <TableCell className="font-serif text-sm whitespace-nowrap">
                        {formatShortDate(row.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="font-serif"
                            disabled={savingLoan}
                            onClick={() => openEditLoan(row)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="font-serif"
                            disabled={busy}
                            onClick={async () => {
                              const res = await duplicateLoanAgreement(row.id);
                              if (!res.success) toast.error(res.error);
                              else {
                                toast.success('Duplicated as draft.');
                                refresh();
                              }
                            }}
                          >
                            Duplicate
                          </Button>
                          {row.status === 'draft' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="font-serif"
                              disabled={busy}
                              onClick={async () => {
                                const res = await markLoanAgreementSent(row.id);
                                if (!res.success) toast.error(res.error);
                                else {
                                  toast.success('Marked as sent.');
                                  refresh();
                                }
                              }}
                            >
                              Mark sent
                            </Button>
                          ) : null}
                          {row.status !== 'signed' && row.status !== 'closed' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="font-serif"
                              disabled={busy}
                              onClick={async () => {
                                const res = await markLoanAgreementSigned(row.id);
                                if (!res.success) toast.error(res.error);
                                else {
                                  toast.success('Marked as signed.');
                                  refresh();
                                }
                              }}
                            >
                              Mark signed
                            </Button>
                          ) : null}
                          <Button type="button" variant="ghost" size="sm" className="font-serif" asChild>
                            <a href={`/api/operations/loans/${row.id}/pdf`} target="_blank" rel="noreferrer">
                              PDF
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <p className="text-ink/70 font-serif text-sm max-w-3xl">
            Create and send professional invoices from your collection. Track payments, generate PDFs, and keep
            financial records alongside your art records (sending by email can follow in a later release).
          </p>
          <Button
            type="button"
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            disabled={busy}
            onClick={openCreateInvoice}
          >
            New invoice
          </Button>

          {invoicesEmpty ? (
            <p className="text-ink/55 font-serif text-sm py-8">No invoices yet.</p>
          ) : (
            <div className="rounded-md border border-wine/15 bg-parchment/40 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-display text-wine">#</TableHead>
                    <TableHead className="font-display text-wine">Client</TableHead>
                    <TableHead className="font-display text-wine">Total</TableHead>
                    <TableHead className="font-display text-wine">Status</TableHead>
                    <TableHead className="font-display text-wine">Due</TableHead>
                    <TableHead className="font-display text-wine">Artwork</TableHead>
                    <TableHead className="text-right font-display text-wine">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialInvoices.map((inv) => {
                    const sub = invoiceSubtotal(inv);
                    const total = sub + (inv.tax_cents ?? 0);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                        <TableCell className="font-serif">
                          <div className="font-medium">{inv.client_name}</div>
                          {inv.client_email ? (
                            <div className="text-xs text-ink/60">{inv.client_email}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-serif whitespace-nowrap">
                          {formatMoney(total, inv.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-serif capitalize">
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-serif text-sm">{formatShortDate(inv.due_date)}</TableCell>
                        <TableCell className="font-serif text-sm max-w-[10rem]">
                          {inv.artwork_id ? (
                            <Link href={`/artworks/${inv.artwork_id}`} className="text-wine underline truncate block">
                              {artworkTitleById.get(inv.artwork_id) ?? 'View'}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="font-serif"
                              disabled={busy}
                              onClick={() => openEditInvoice(inv)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="font-serif"
                              disabled={busy}
                              onClick={async () => {
                                const res = await duplicateInvoice(inv.id);
                                if (!res.success) toast.error(res.error);
                                else {
                                  toast.success('Duplicated as draft.');
                                  refresh();
                                }
                              }}
                            >
                              Duplicate
                            </Button>
                            {inv.status === 'draft' ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="font-serif"
                                disabled={busy}
                                onClick={async () => {
                                  const res = await markInvoiceSent(inv.id);
                                  if (!res.success) toast.error(res.error);
                                  else {
                                    toast.success('Marked as sent.');
                                    refresh();
                                  }
                                }}
                              >
                                Mark sent
                              </Button>
                            ) : null}
                            {inv.status !== 'paid' ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="font-serif"
                                disabled={busy}
                                onClick={async () => {
                                  const res = await markInvoicePaid(inv.id);
                                  if (!res.success) toast.error(res.error);
                                  else {
                                    toast.success('Marked as paid.');
                                    refresh();
                                  }
                                }}
                              >
                                Mark paid
                              </Button>
                            ) : null}
                            <Button type="button" variant="ghost" size="sm" className="font-serif" asChild>
                              <a href={`/api/operations/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                                PDF
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="shipping">
          <ComingSoonTab
            title="Shipping & Logistics Tracking"
            description="Track artwork shipments, couriers, crating, and transit insurance in one place."
          />
        </TabsContent>
        <TabsContent value="insurance">
          <ComingSoonTab
            title="Insurance & Valuation Management"
            description="Schedule appraisals, manage policies, and link valuations to objects in your collection."
          />
        </TabsContent>
        <TabsContent value="condition">
          <ComingSoonTab
            title="Condition & Conservation Reports"
            description="Store condition reports, conservation treatments, and inspection notes over time."
          />
        </TabsContent>
        <TabsContent value="acquisition">
          <ComingSoonTab
            title="Acquisition & Accession Workflows"
            description="Document accession numbers, provenance checks, and intake workflows from offer to catalog."
          />
        </TabsContent>
        <TabsContent value="exhibitions">
          <ComingSoonTab
            title="Exhibition Planning & Object Scheduling"
            description="Plan venues, loan requests, object availability, and install schedules across shows."
          />
        </TabsContent>
        <TabsContent value="inventory">
          <ComingSoonTab
            title="Inventory & Location Tracking"
            description="See current storage locations, moves, and counts tied to artworks and crates."
          />
        </TabsContent>
        <TabsContent value="vendors">
          <ComingSoonTab
            title="Vendor & Partner Management"
            description="Maintain framers, shippers, conservators, and other partners in one directory."
          />
        </TabsContent>
      </Tabs>

      <Dialog open={loanOpen} onOpenChange={setLoanOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl font-serif border-wine/20">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">
              {editingLoan ? 'Edit loan agreement' : 'New loan agreement'}
            </DialogTitle>
            <DialogDescription>
              Find the piece by exhibition or search, then capture terms, conditions, and insurance. Use PDF export
              for a printable copy.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <LoanArtworkPicker
              key={loanPickerSeed}
              artworks={artworks}
              value={loanArtworkId}
              onChange={setLoanArtworkId}
              disabled={busy}
            />
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="grid gap-2">
                <Label>Borrower name</Label>
                <Input value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Borrower email</Label>
                <Input value={borrowerEmail} onChange={(e) => setBorrowerEmail(e.target.value)} type="email" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="grid gap-2">
                <Label>Lender name</Label>
                <Input value={lenderName} onChange={(e) => setLenderName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Lender email</Label>
                <Input value={lenderEmail} onChange={(e) => setLenderEmail(e.target.value)} type="email" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="grid gap-2">
                <Label>Start date</Label>
                <Input type="date" value={loanStart} onChange={(e) => setLoanStart(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>End date</Label>
                <Input type="date" value={loanEnd} onChange={(e) => setLoanEnd(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Terms</Label>
              <Textarea rows={4} value={termsText} onChange={(e) => setTermsText(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Conditions</Label>
              <Textarea rows={4} value={conditionsText} onChange={(e) => setConditionsText(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Insurance requirements</Label>
              <Textarea rows={4} value={insuranceText} onChange={(e) => setInsuranceText(e.target.value)} />
            </div>
            {editingLoan ? (
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={loanStatus} onValueChange={setLoanStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {loanStatuses.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLoanOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-wine text-parchment"
              disabled={busy}
              onClick={() => void submitLoan()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg font-serif border-wine/20">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">
              {editingInvoice ? 'Edit invoice' : 'New invoice'}
            </DialogTitle>
            <DialogDescription>Line items, tax, and optional link to an artwork.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="grid gap-2">
                <Label>Client name</Label>
                <Input value={invClientName} onChange={(e) => setInvClientName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Client email</Label>
                <Input value={invClientEmail} onChange={(e) => setInvClientEmail(e.target.value)} type="email" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select value={invCurrency} onValueChange={setInvCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Due date</Label>
                <Input type="date" value={invDue} onChange={(e) => setInvDue(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="grid gap-2">
                <Label>Tax (amount)</Label>
                <Input value={invTaxDollars} onChange={(e) => setInvTaxDollars(e.target.value)} inputMode="decimal" />
              </div>
              <div className="grid gap-2">
                <Label>Link artwork (optional)</Label>
                <Select value={invArtworkId || '__none__'} onValueChange={(v) => setInvArtworkId(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {artworks.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={invNotes} onChange={(e) => setInvNotes(e.target.value)} />
            </div>
            {editingInvoice ? (
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={invStatus} onValueChange={setInvStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceStatuses.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInvLines((rows) => [...rows, { description: '', qty: '1', unitDollars: '0' }])}
                >
                  Add line
                </Button>
              </div>
              {invLines.map((line, idx) => (
                <div key={idx} className="grid gap-2 rounded-md border border-wine/10 p-3 sm:grid-cols-12">
                  <div className="sm:col-span-6 grid gap-1">
                    <span className="text-xs text-ink/60">Description</span>
                    <Input value={line.description} onChange={(e) => {
                      const v = e.target.value;
                      setInvLines((rows) => rows.map((r, i) => (i === idx ? { ...r, description: v } : r)));
                    }} />
                  </div>
                  <div className="sm:col-span-2 grid gap-1">
                    <span className="text-xs text-ink/60">Qty</span>
                    <Input value={line.qty} onChange={(e) => {
                      const v = e.target.value;
                      setInvLines((rows) => rows.map((r, i) => (i === idx ? { ...r, qty: v } : r)));
                    }} inputMode="decimal" />
                  </div>
                  <div className="sm:col-span-3 grid gap-1">
                    <span className="text-xs text-ink/60">Unit ({invCurrency})</span>
                    <Input value={line.unitDollars} onChange={(e) => {
                      const v = e.target.value;
                      setInvLines((rows) => rows.map((r, i) => (i === idx ? { ...r, unitDollars: v } : r)));
                    }} inputMode="decimal" />
                  </div>
                  <div className="sm:col-span-1 flex items-end justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={invLines.length <= 1}
                      onClick={() => setInvLines((rows) => rows.filter((_, i) => i !== idx))}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInvoiceOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-wine text-parchment"
              disabled={busy}
              onClick={() => void submitInvoice()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
