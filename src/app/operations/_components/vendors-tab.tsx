'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import type { VendorRow } from '../page';
import { createVendor, deleteVendor, duplicateVendor, updateVendor } from '../_actions/vendors';

const serviceTypes = [
  'framer',
  'shipper',
  'conservator',
  'photographer',
  'handler',
  'installer',
  'registrar',
  'other',
] as const;
const vendStatuses = ['active', 'inactive'] as const;

type Props = {
  vendors: VendorRow[];
};

export function VendorsTab({ vendors }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VendorRow | null>(null);
  const [name, setName] = useState('');
  const [serviceType, setServiceType] = useState<string>('other');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string>('active');

  function openCreate() {
    setEditing(null);
    setName('');
    setServiceType('other');
    setContactName('');
    setContactEmail('');
    setPhone('');
    setWebsite('');
    setAddress('');
    setNotes('');
    setStatus('active');
    setOpen(true);
  }

  function openEdit(v: VendorRow) {
    setEditing(v);
    setName(v.name);
    setServiceType(v.service_type);
    setContactName(v.contact_name ?? '');
    setContactEmail(v.contact_email ?? '');
    setPhone(v.phone ?? '');
    setWebsite(v.website ?? '');
    setAddress(v.address ?? '');
    setNotes(v.notes ?? '');
    setStatus(v.status);
    setOpen(true);
  }

  async function submit() {
    if (!name.trim()) {
      toast.error('Vendor name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const r = await updateVendor({
          id: editing.id,
          name: name.trim(),
          service_type: serviceType as (typeof serviceTypes)[number],
          contact_name: contactName,
          contact_email: contactEmail.trim() || undefined,
          phone: phone,
          website: website,
          address: address,
          notes: notes,
          status: status as (typeof vendStatuses)[number],
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success('Vendor updated.');
      } else {
        const r = await createVendor({
          name: name.trim(),
          service_type: serviceType as (typeof serviceTypes)[number],
          contact_name: contactName,
          contact_email: contactEmail.trim() || undefined,
          phone: phone,
          website: website,
          address: address,
          notes: notes,
          status: status as (typeof vendStatuses)[number],
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success('Vendor created.');
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="text-ink/70 font-serif text-sm max-w-3xl">
        Partner directory: framers, shippers, conservators, and registrars. Add a contact email to link them to
        Provenance or send a signup invite.
      </p>
      <Button
        type="button"
        className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        onClick={openCreate}
        disabled={saving}
      >
        New vendor
      </Button>
      {vendors.length === 0 ? (
        <p className="text-ink/55 font-serif text-sm py-8">No vendors yet.</p>
      ) : (
        <div className="rounded-md border border-wine/15 bg-parchment/40 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-display text-wine">Name</TableHead>
                <TableHead className="font-display text-wine">Service</TableHead>
                <TableHead className="font-display text-wine">Contact</TableHead>
                <TableHead className="font-display text-wine">Phone / site</TableHead>
                <TableHead className="font-display text-wine">Status</TableHead>
                <TableHead className="text-right font-display text-wine">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-serif font-medium max-w-[10rem]">{v.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {v.service_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.contact_name || v.contact_email ? (
                      <>
                        {v.contact_name ? <div>{v.contact_name}</div> : null}
                        {v.contact_email ? (
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-ink/60 text-xs">{v.contact_email}</span>
                            {v.contact_user_id ? (
                              <Badge
                                className="border border-emerald-200 bg-emerald-100 text-[10px] text-emerald-900"
                                variant="secondary"
                              >
                                Linked
                              </Badge>
                            ) : (
                              <Badge
                                className="border border-amber-200 bg-amber-100 text-[10px] text-amber-900"
                                variant="secondary"
                              >
                                No account
                              </Badge>
                            )}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="font-serif text-xs text-ink/70 max-w-[8rem]">
                    {v.phone ? <div>{v.phone}</div> : null}
                    {v.website ? (
                      <a href={v.website.startsWith('http') ? v.website : `https://${v.website}`} className="text-wine underline" target="_blank" rel="noreferrer">
                        site
                      </a>
                    ) : null}
                    {!v.phone && !v.website ? '—' : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {v.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(v)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-700"
                        onClick={async () => {
                          if (!window.confirm('Delete this vendor?')) {
                            return;
                          }
                          const d0 = await deleteVendor(v.id);
                          if (!d0.success) {
                            toast.error(d0.error);
                          } else {
                            toast.success('Deleted.');
                            router.refresh();
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg font-serif border-wine/20">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">
              {editing ? 'Edit vendor' : 'New vendor'}
            </DialogTitle>
            <DialogDescription>Directory entry for a partner. Contact email links them when they have an account.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Service type</Label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vendStatuses.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Contact name</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Contact email</Label>
                <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Website</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Address</Label>
              <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          {editing ? (
            <DialogFooter className="flex-wrap sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const d0 = await duplicateVendor(editing.id);
                  if (!d0.success) {
                    toast.error(d0.error);
                    return;
                  }
                  toast.success('Duplicated.');
                  setOpen(false);
                  router.refresh();
                }}
                disabled={saving}
              >
                Duplicate
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" className="bg-wine text-parchment" disabled={saving} onClick={() => void submit()}>
                  Save
                </Button>
              </div>
            </DialogFooter>
          ) : (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" className="bg-wine text-parchment" disabled={saving} onClick={() => void submit()}>
                Save
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
