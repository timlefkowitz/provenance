'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Badge } from '@kit/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { Plus } from 'lucide-react';

import { createManagedCollection } from '../_actions/create-managed-collection';
import type { UserProfile } from '../_actions/get-user-profiles';

/**
 * Collections the user is building on someone else's behalf, plus a dialog to start one.
 * Handing a collection off to its owner comes in a later phase.
 */
export function ManagedCollectionsSection({
  collections,
  canCreate,
}: {
  collections: UserProfile[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [isPending, startTransition] = useTransition();

  if (!canCreate && collections.length === 0) return null;

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createManagedCollection({ ownerName, ownerEmail });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Collection for ${result.profile.name} created`);
      setOpen(false);
      setOwnerName('');
      setOwnerEmail('');
      router.refresh();
    });
  };

  return (
    <Card className="mb-8 border-wine/20 bg-parchment/60">
      <CardHeader>
        <CardTitle className="font-display text-xl text-wine">
          Collections you manage for others
        </CardTitle>
        <CardDescription className="font-serif">
          Catalogue a collection for a client or family member. Certificates carry the owner&apos;s
          name, and you can hand the collection over to them when it&apos;s ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {collections.length > 0 && (
          <ul className="divide-y divide-wine/10 rounded-md border border-wine/15">
            {collections.map((collection) => (
              <li
                key={collection.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-serif text-ink truncate">{collection.name}</p>
                  <p className="font-serif text-xs text-ink/60 truncate">
                    {collection.managed_for_email || 'No owner email yet'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-serif text-xs">
                    Not yet handed off
                  </Badge>
                  <Button asChild variant="outline" size="sm" className="font-serif border-wine/30">
                    <Link href={`/artworks/add?collection=${collection.id}`}>Add works</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="font-serif border-wine/30 hover:bg-wine/10">
                <Plus className="h-4 w-4 mr-2" />
                Create a collection for someone else
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-wine">
                  New collection for someone else
                </DialogTitle>
                <DialogDescription className="font-serif">
                  You&apos;ll add the works. Their name goes on every certificate.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="managed-owner-name">Owner&apos;s name *</Label>
                  <Input
                    id="managed-owner-name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. The Hartley Family Collection"
                    className="font-serif"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="managed-owner-email">Owner&apos;s email</Label>
                  <Input
                    id="managed-owner-email"
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="owner@example.com"
                    className="font-serif"
                  />
                  <p className="font-serif text-xs text-ink/60">
                    Optional for now. You&apos;ll need it to hand the collection over.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isPending || !ownerName.trim()}
                  className="bg-wine text-parchment hover:bg-wine/90"
                >
                  {isPending ? 'Creating…' : 'Create collection'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
