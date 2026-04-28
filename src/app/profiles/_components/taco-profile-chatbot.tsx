'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';
import { ArrowRight, Camera, Code2, Loader2, Send, SkipForward } from 'lucide-react';
import { USER_ROLES, getRoleLabel, type UserRole } from '~/lib/user-roles';
import { createProfile } from '../_actions/create-profile';
import { uploadProfilePicture } from '../_actions/upload-profile-picture';
import {
  parseProfileInput,
  type ParsedProfileFields,
} from '../_actions/parse-profile-input';

/* -------------------------------------------------------------------------- */
/*  Question script per role                                                  */
/* -------------------------------------------------------------------------- */

type Question = {
  /** Field on ProfileDraft this question collects. */
  key: keyof ParsedProfileFields;
  /** What Taco says to ask for it. */
  prompt: string;
  /** Greyed placeholder in the input. */
  placeholder: string;
  /** Whether this question can be skipped without an answer. */
  optional?: boolean;
};

function questionsForRole(role: UserRole): Question[] {
  const isOrg = role === USER_ROLES.GALLERY || role === USER_ROLES.INSTITUTION;
  const label = getRoleLabel(role).toLowerCase();

  const common: Question[] = [
    {
      key: 'name',
      prompt: isOrg
        ? `First things first — what's the ${label}'s name? You can paste the address with it if you like.`
        : `First things first — what should I call you on your ${label} profile?`,
      placeholder: isOrg
        ? 'e.g. The Museum of Modern Art, 11 W 53rd St, New York, NY'
        : 'Your display name',
    },
    {
      key: 'location',
      prompt: isOrg
        ? 'Where is it based? City, region, country — or the full address again, your call.'
        : 'Where are you based? City + country is plenty.',
      placeholder: 'e.g. Brooklyn, NY, USA',
    },
  ];

  const middle: Question[] = isOrg
    ? [
        {
          key: 'established_year',
          prompt: 'What year was it established? *peers at calendar*',
          placeholder: 'e.g. 1929',
          optional: true,
        },
        {
          key: 'bio',
          prompt:
            'Give me a short blurb — mission, programme, what makes it tick. Two or three sentences is plenty.',
          placeholder: 'A short description visitors will see…',
          optional: true,
        },
      ]
    : role === USER_ROLES.ARTIST
      ? [
          {
            key: 'medium',
            prompt:
              'What medium do you mostly work in? *knocks pencil off desk*',
            placeholder: 'e.g. Oil on canvas, Digital, Bronze sculpture',
            optional: true,
          },
          {
            key: 'bio',
            prompt:
              'Write me a short artist bio — practice, themes, anything you\'d want a curator to read first.',
            placeholder: 'A short bio visitors will see…',
            optional: true,
          },
        ]
      : [
          {
            key: 'bio',
            prompt:
              'Tell me a little about your collection — focus, period, anything you like sharing.',
            placeholder: 'A short blurb about your collection…',
            optional: true,
          },
        ];

  const tail: Question[] = [
    {
      key: 'website',
      prompt: 'Got a website I should link to? Skip if not.',
      placeholder: 'https://example.com',
      optional: true,
    },
    {
      key: 'contact_email',
      prompt: 'Public contact email? Only share what you want visible.',
      placeholder: 'hello@example.com',
      optional: true,
    },
  ];

  return [...common, ...middle, ...tail];
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type ChatMessage =
  | { id: number; role: 'taco'; text: string }
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'system'; text: string };

type Stage = 'questions' | 'photo' | 'review' | 'saving' | 'done';

type ProfileDraft = ParsedProfileFields & {
  picture_url?: string;
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

let __msgId = 1;
const nextId = () => __msgId++;

export function TacoProfileChatbot({ role }: { role: UserRole }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const questions = useMemo(() => questionsForRole(role), [role]);

  const [stage, setStage] = useState<Stage>('questions');
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>({});
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: nextId(),
      role: 'taco',
      text: `*stretches* Hi. I'm Taco. I'm going to walk you through your ${getRoleLabel(role).toLowerCase()} profile one question at a time. You can paste in chunks — like a name and address together — and I'll sort it out.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [tacoTyping, setTacoTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [isPending, startTransition] = useTransition();

  const currentQuestion = questions[stepIndex];

  /* ----- ask the next question whenever the step or draft changes ----- */
  useEffect(() => {
    if (stage !== 'questions') return;
    const q = questions[stepIndex];
    if (!q) return;

    // If the model already filled this field in a previous turn, skip ahead.
    if (draft[q.key] !== undefined && draft[q.key] !== '') {
      setStepIndex((i) => i + 1);
      return;
    }

    // Avoid double-asking on re-render.
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'taco' && last.text === q.prompt) return prev;
      return [...prev, { id: nextId(), role: 'taco', text: q.prompt }];
    });
    // Focus input shortly after Taco "speaks".
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, stepIndex, draft]);

  /* ----- end of questions → photo stage ----- */
  useEffect(() => {
    if (stage === 'questions' && stepIndex >= questions.length) {
      setStage('photo');
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'taco',
          text: 'Last thing — want to add a profile photo? Upload one, paste a URL, or skip and we\'re done.',
        },
      ]);
    }
  }, [stage, stepIndex, questions.length]);

  /* ----- always scroll to bottom on new messages ----- */
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tacoTyping]);

  /* ----- send an answer ----- */
  const handleSend = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || tacoTyping || stage !== 'questions') return;
      const q = currentQuestion;
      if (!q) return;

      setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);
      setInput('');
      setTacoTyping(true);

      try {
        const res = await parseProfileInput({
          input: text,
          role,
          currentField: q.key,
          alreadyKnown: draft,
        });

        // Merge extracted fields into the draft (don't clobber existing ones).
        setDraft((prev) => {
          const next: ProfileDraft = { ...prev };
          for (const [k, v] of Object.entries(res.extracted) as [
            keyof ParsedProfileFields,
            ParsedProfileFields[keyof ParsedProfileFields],
          ][]) {
            if (v !== undefined && v !== '' && next[k] === undefined) {
              (next as Record<string, unknown>)[k] = v;
            }
          }
          // If the user clearly meant to fill the current field but the
          // parser missed it (e.g. just "Acme"), accept the raw input.
          if (next[q.key] === undefined && q.key !== 'established_year') {
            (next as Record<string, unknown>)[q.key] = text;
          }
          return next;
        });

        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'taco', text: res.reply },
        ]);
        setStepIndex((i) => i + 1);
      } catch (err) {
        console.error('[Profiles] taco chat parse failed', err);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'taco',
            text: '*flicks tail* Something went sideways on my end. Try that one again?',
          },
        ]);
      } finally {
        setTacoTyping(false);
      }
    },
    [currentQuestion, draft, role, stage, tacoTyping],
  );

  const handleSkip = useCallback(() => {
    if (stage !== 'questions' || !currentQuestion?.optional) return;
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', text: '(skipped)' },
      {
        id: nextId(),
        role: 'taco',
        text: '*nods* Fine. Moving on.',
      },
    ]);
    setStepIndex((i) => i + 1);
  }, [currentQuestion, stage]);

  /* ----- photo upload ----- */
  const handlePhotoSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error('Please choose an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be under 5MB');
        return;
      }

      setUploading(true);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', text: `(uploading ${file.name}…)` },
      ]);

      try {
        const fd = new FormData();
        fd.append('file', file);
        const result = await uploadProfilePicture(fd);
        if (result.error || !result.url) {
          throw new Error(result.error ?? 'Upload failed');
        }
        setDraft((prev) => ({ ...prev, picture_url: result.url ?? undefined }));
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'taco',
            text: '*purrs* Lovely. That photo suits you.',
          },
        ]);
        setStage('review');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        toast.error(message);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'taco',
            text: `*sniffs* Couldn't upload that one — ${message}. Try another?`,
          },
        ]);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [],
  );

  const handleSkipPhoto = useCallback(() => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', text: '(no photo for now)' },
      {
        id: nextId(),
        role: 'taco',
        text: '*shrugs, somehow* Suit yourself. You can add one later.',
      },
    ]);
    setStage('review');
  }, []);

  /* ----- final save ----- */
  const handleSave = useCallback(() => {
    if (!draft.name?.trim()) {
      toast.error('A name is required');
      return;
    }
    setStage('saving');
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'taco',
        text: '*sits up straight* Alright. Filing this with the humans now.',
      },
    ]);

    startTransition(async () => {
      const result = await createProfile({
        role,
        name: draft.name!.trim(),
        picture_url: draft.picture_url || undefined,
        bio: draft.bio || undefined,
        medium: draft.medium || undefined,
        location:
          draft.location ||
          // Fall back to address if we never got a separate location
          draft.address ||
          undefined,
        website: draft.website || undefined,
        contact_email: draft.contact_email || undefined,
        phone: draft.phone || undefined,
        established_year: draft.established_year || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        setStage('review');
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'taco',
            text: `*ears flatten* ${result.error}`,
          },
        ]);
        return;
      }

      toast.success('Profile created');
      setStage('done');
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'taco',
          text: '*proud meow* Done. Off you go.',
        },
      ]);
      router.push('/profiles');
      router.refresh();
    });
  }, [draft, role, router]);

  /* ----- JSON preview (shown live, on demand on mobile) ----- */
  const previewJson = useMemo(() => {
    const ordered = {
      role,
      name: draft.name ?? null,
      location: draft.location ?? null,
      address: draft.address ?? null,
      established_year: draft.established_year ?? null,
      medium: draft.medium ?? null,
      bio: draft.bio ?? null,
      website: draft.website ?? null,
      contact_email: draft.contact_email ?? null,
      phone: draft.phone ?? null,
      picture_url: draft.picture_url ?? null,
    };
    return JSON.stringify(ordered, null, 2);
  }, [draft, role]);

  const filledCount = Object.values(draft).filter(
    (v) => v !== undefined && v !== '' && v !== null,
  ).length;

  /* -------------------------------------------------------------------- */
  /*  Render                                                              */
  /* -------------------------------------------------------------------- */
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Chat column */}
      <Card className="border-wine/20 bg-parchment/60 flex flex-col overflow-hidden">
        <CardHeader className="pb-3 border-b border-wine/15">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-wine/30 bg-wine/10">
              <Image
                src="/taco-cat.png"
                alt="Taco the cat"
                fill
                className="object-cover object-top"
                sizes="44px"
                priority
              />
            </div>
            <div className="min-w-0">
              <CardTitle className="font-display text-lg text-wine">
                Taco
              </CardTitle>
              <p className="text-xs font-serif text-ink/60">
                Chief Vibes Officer · helping you set up your{' '}
                {getRoleLabel(role).toLowerCase()} profile
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowJson((v) => !v)}
              className="lg:hidden ml-auto inline-flex items-center gap-1 rounded border border-wine/25 px-2 py-1 text-xs font-serif text-wine/80 hover:bg-wine/10"
              aria-pressed={showJson}
            >
              <Code2 className="h-3 w-3" />
              {showJson ? 'Hide JSON' : 'Show JSON'}
            </button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col flex-1 min-h-0 p-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[360px] max-h-[520px]">
            {messages.map((m) =>
              m.role === 'taco' ? (
                <TacoBubble key={m.id} text={m.text} />
              ) : m.role === 'user' ? (
                <UserBubble key={m.id} text={m.text} />
              ) : (
                <SystemBubble key={m.id} text={m.text} />
              ),
            )}
            {tacoTyping && <TypingBubble />}
            <div ref={scrollEndRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-wine/15 px-4 py-3 bg-parchment/40">
            {stage === 'questions' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(input);
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={currentQuestion?.placeholder ?? 'Type your answer…'}
                  disabled={tacoTyping}
                  className="flex-1 min-w-0 rounded border border-wine/30 bg-white px-3 py-2 text-sm font-serif text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-wine/40 disabled:opacity-60"
                  maxLength={500}
                />
                {currentQuestion?.optional && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleSkip}
                    disabled={tacoTyping}
                    className="font-serif border-wine/30 text-wine hover:bg-wine/10 shrink-0"
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Skip
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={tacoTyping || !input.trim()}
                  className="bg-wine text-parchment hover:bg-wine/90 shrink-0"
                  aria-label="Send"
                >
                  {tacoTyping ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            )}

            {stage === 'photo' && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-wine text-parchment hover:bg-wine/90"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Upload photo
                    </>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSkipPhoto}
                  disabled={uploading}
                  className="font-serif border-wine/30 text-wine hover:bg-wine/10"
                >
                  <SkipForward className="h-4 w-4 mr-1" />
                  No photo for now
                </Button>
              </div>
            )}

            {stage === 'review' && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={isPending || !draft.name?.trim()}
                  className="bg-wine text-parchment hover:bg-wine/90"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Save profile
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStage('questions');
                    // Re-ask whichever first field is still empty (or first question).
                    const firstEmpty = questions.findIndex(
                      (q) => draft[q.key] === undefined || draft[q.key] === '',
                    );
                    setStepIndex(firstEmpty === -1 ? 0 : firstEmpty);
                  }}
                  className="font-serif border-wine/30 text-wine hover:bg-wine/10"
                >
                  Edit answers
                </Button>
              </div>
            )}

            {(stage === 'saving' || stage === 'done') && (
              <p className="text-xs font-serif text-ink/60">
                {stage === 'saving'
                  ? 'Saving your profile…'
                  : 'Profile saved. Redirecting…'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live profile preview column */}
      <div
        className={`${showJson ? 'block' : 'hidden'} lg:block space-y-4`}
      >
        <PreviewCard draft={draft} role={role} filledCount={filledCount} />
        <JsonCard json={previewJson} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Subcomponents                                                             */
/* -------------------------------------------------------------------------- */

function TacoBubble({ text }: { text: string }) {
  return (
    <div className="flex items-end gap-2">
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-wine/20">
        <Image
          src="/taco-cat.png"
          alt=""
          fill
          className="object-cover object-top"
          sizes="28px"
        />
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-wine/5 px-3 py-2 text-sm font-serif leading-relaxed text-ink/90 whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-wine/15 px-3 py-2 text-sm font-serif leading-relaxed text-ink whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function SystemBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-center">
      <div className="rounded-full border border-wine/15 px-3 py-1 text-[11px] font-serif italic text-ink/50">
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2">
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-wine/20">
        <Image
          src="/taco-cat.png"
          alt=""
          fill
          className="object-cover object-top"
          sizes="28px"
        />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-wine/5 px-3 py-2">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine/60 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine/60 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine/60 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function PreviewCard({
  draft,
  role,
  filledCount,
}: {
  draft: ProfileDraft;
  role: UserRole;
  filledCount: number;
}) {
  return (
    <Card className="border-wine/20 bg-parchment/60">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base text-wine flex items-center justify-between">
          <span>Profile preview</span>
          <span className="text-xs font-serif text-ink/50">
            {filledCount} field{filledCount === 1 ? '' : 's'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          {draft.picture_url ? (
            <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-wine/20 bg-wine/10">
              <Image
                src={draft.picture_url}
                alt="Profile preview"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-wine/30 text-wine/40">
              <Camera className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-base text-wine truncate">
              {draft.name?.trim() || 'Untitled'}
            </p>
            <p className="text-xs font-serif text-ink/60 capitalize">
              {role}
              {draft.location ? ` · ${draft.location}` : ''}
            </p>
          </div>
        </div>

        <PreviewRow label="Name" value={draft.name} />
        <PreviewRow label="Location" value={draft.location} />
        <PreviewRow label="Address" value={draft.address} />
        <PreviewRow
          label="Established"
          value={
            draft.established_year ? String(draft.established_year) : undefined
          }
        />
        <PreviewRow label="Medium" value={draft.medium} />
        <PreviewRow label="Bio" value={draft.bio} truncate />
        <PreviewRow label="Website" value={draft.website} truncate />
        <PreviewRow label="Email" value={draft.contact_email} truncate />
      </CardContent>
    </Card>
  );
}

function PreviewRow({
  label,
  value,
  truncate,
}: {
  label: string;
  value?: string;
  truncate?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider font-serif text-ink/45">
        {label}
      </span>
      <span
        className={`text-sm font-serif text-ink/85 ${truncate ? 'truncate' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

function JsonCard({ json }: { json: string }) {
  return (
    <Card className="border-wine/20 bg-parchment/60">
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="font-display text-base text-wine flex items-center gap-2">
          <Code2 className="h-4 w-4" />
          Structured JSON
        </CardTitle>
        <CopyJsonButton json={json} />
      </CardHeader>
      <CardContent>
        <pre className="max-h-[260px] overflow-auto rounded border border-wine/15 bg-white/70 p-3 text-[11px] leading-snug font-mono text-ink/85">
          {json}
        </pre>
      </CardContent>
    </Card>
  );
}

function CopyJsonButton({ json }: { json: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(json);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          toast.error('Could not copy');
        }
      }}
      className="text-xs font-serif text-wine/80 hover:text-wine"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

