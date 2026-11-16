'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { MAX_INSTITUTION_STATEMENT_LENGTH } from '~/lib/institutions/institution-setup';

import { uploadProfilePicture } from '~/app/profiles/_actions/upload-profile-picture';
import { saveInstitutionSetup } from '../_actions/save-institution-setup';

type SetupValues = {
  statement: string;
  pictureUrl: string;
  headerImageUrl: string;
  isPrivate: boolean;
  artworksPrivateByDefault: boolean;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function InstitutionSetupForm({
  profileId,
  institutionName,
  isWelcome,
  canEdit,
  setupDone,
  continueHref,
  initial,
}: {
  profileId: string;
  institutionName: string;
  isWelcome: boolean;
  canEdit: boolean;
  setupDone: boolean;
  continueHref: string;
  initial: SetupValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<SetupValues>(initial);
  const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null);
  const [isSaving, startSaving] = useTransition();
  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const turningOnPrivateWorks = values.artworksPrivateByDefault && !initial.artworksPrivateByDefault;

  async function upload(kind: 'logo' | 'banner', file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Images must be under 5MB.');
      return;
    }
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await uploadProfilePicture(fd);
      if (!res.url) {
        toast.error(res.error || 'Upload failed.');
        return;
      }
      setValues((v) => (kind === 'logo' ? { ...v, pictureUrl: res.url! } : { ...v, headerImageUrl: res.url! }));
    } catch (err) {
      console.error('[InstitutionSetup] upload failed', err);
      toast.error('Upload failed.');
    } finally {
      setUploading(null);
    }
  }

  function save() {
    startSaving(async () => {
      const res = await saveInstitutionSetup({ profileId, ...values });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.worksMadePrivate > 0
          ? `Saved. ${res.worksMadePrivate} existing work${res.worksMadePrivate === 1 ? ' is' : 's are'} now private.`
          : 'Saved.',
      );
      if (isWelcome) {
        router.push(continueHref);
      } else {
        router.refresh();
      }
    });
  }

  const heading = setupDone || !canEdit ? `Welcome to ${institutionName}` : `Set up ${institutionName}`;
  const intro = !canEdit
    ? setupDone
      ? 'Your team has already set this up. Only the owner or an admin can change it.'
      : 'An owner or admin hasn’t finished setting this up yet. Only they can change it.'
    : setupDone
      ? 'Your team has already answered these. Check they’re still right and change anything that isn’t.'
      : 'A few basics so your institution’s page looks right. You can change any of this later.';

  return (
    <div className="rounded-xl border border-wine/20 bg-parchment/60 p-6 sm:p-8">
      <p className="mb-1 text-xs uppercase tracking-widest text-ink/60">Institution setup</p>
      <h1 className="mb-2 font-display text-2xl text-wine sm:text-3xl">{heading}</h1>
      <p className="mb-8 text-ink/80">{intro}</p>

      <fieldset disabled={!canEdit || isSaving} className="space-y-8">
        {/* Statement */}
        <section className="space-y-2">
          <Label htmlFor="statement" className="font-serif text-base text-ink">
            Institutional statement
          </Label>
          <p className="text-sm text-ink/60">Your mission or a short description, shown on your public page.</p>
          {canEdit ? (
            <Textarea
              id="statement"
              rows={6}
              maxLength={MAX_INSTITUTION_STATEMENT_LENGTH}
              value={values.statement}
              onChange={(e) => setValues({ ...values, statement: e.target.value })}
              placeholder="e.g. The museum collects and exhibits contemporary art from…"
            />
          ) : (
            <p className="whitespace-pre-wrap rounded-md border border-wine/10 bg-white/50 p-3 text-ink/80">
              {values.statement || <span className="text-ink/50">Not added yet</span>}
            </p>
          )}
        </section>

        {/* Logo */}
        <section className="space-y-2">
          <Label className="font-serif text-base text-ink">Profile image or logo</Label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-wine/15 bg-white/60">
              {values.pictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={values.pictureUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-ink/40">None</div>
              )}
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="border-wine/30" onClick={() => logoInput.current?.click()}>
                  {uploading === 'logo' ? 'Uploading…' : values.pictureUrl ? 'Replace' : 'Upload'}
                </Button>
                {values.pictureUrl && (
                  <Button type="button" variant="ghost" onClick={() => setValues({ ...values, pictureUrl: '' })}>
                    Remove
                  </Button>
                )}
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void upload('logo', e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            )}
          </div>
        </section>

        {/* Banner */}
        <section className="space-y-2">
          <Label className="font-serif text-base text-ink">Banner</Label>
          <p className="text-sm text-ink/60">A wide image across the top of your public page. Landscape works best.</p>
          <div className="aspect-[4/1] w-full overflow-hidden rounded-lg border border-wine/15 bg-white/60">
            {values.headerImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.headerImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink/40">No banner</div>
            )}
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-wine/30" onClick={() => bannerInput.current?.click()}>
                {uploading === 'banner' ? 'Uploading…' : values.headerImageUrl ? 'Replace banner' : 'Upload banner'}
              </Button>
              {values.headerImageUrl && (
                <Button type="button" variant="ghost" onClick={() => setValues({ ...values, headerImageUrl: '' })}>
                  Remove
                </Button>
              )}
              <input
                ref={bannerInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void upload('banner', e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          )}
        </section>

        {/* Privacy */}
        <section className="space-y-4 border-t border-wine/15 pt-6">
          <h2 className="font-display text-lg text-wine">Privacy</h2>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="artworks-private" className="font-serif text-base text-ink">
                Keep all works private
              </Label>
              <p className="text-sm text-ink/60">
                Works your team adds start private. Turning this on also makes the works already here private.
                Each work can still be made public on its own.
              </p>
            </div>
            <Switch
              id="artworks-private"
              checked={values.artworksPrivateByDefault}
              onCheckedChange={(checked) => setValues({ ...values, artworksPrivateByDefault: checked })}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="institution-private" className="font-serif text-base text-ink">
                Make the institution private
              </Label>
              <p className="text-sm text-ink/60">
                Hides your public page and website from anyone outside your team. Certificates that name your
                institution still verify.
              </p>
            </div>
            <Switch
              id="institution-private"
              checked={values.isPrivate}
              onCheckedChange={(checked) => setValues({ ...values, isPrivate: checked })}
            />
          </div>

          {canEdit && turningOnPrivateWorks && (
            <p className="rounded-md bg-wine/5 px-3 py-2 text-sm text-wine">
              When you save, every public work filed under {institutionName} will be made private.
            </p>
          )}
        </section>
      </fieldset>

      <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {(isWelcome || !canEdit) && (
          <Button asChild variant="ghost">
            <Link href={continueHref}>{canEdit ? 'Skip for now' : 'Continue'}</Link>
          </Button>
        )}
        {canEdit && (
          <Button
            type="button"
            className="bg-wine text-parchment hover:bg-wine/90"
            disabled={isSaving || uploading !== null}
            onClick={save}
          >
            {isSaving ? 'Saving…' : isWelcome ? 'Save and continue' : 'Save'}
          </Button>
        )}
      </div>
    </div>
  );
}
