'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useObject } from '@ai-sdk/react';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';
import {
  ArrowRight,
  Camera,
  Code2,
  Loader2,
  Mic,
  MicOff,
  Send,
  SkipForward,
  Upload,
} from 'lucide-react';
import { USER_ROLES, getRoleLabel, type UserRole } from '~/lib/user-roles';
import { createProfile } from '../_actions/create-profile';
import { uploadProfilePicture } from '../_actions/upload-profile-picture';
import {
  parsedProfileSchema,
  sanitizeParsedFields,
  type ParsedProfileFields,
  type ParsedProfilePayload,
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

export type TacoProfileChatbotPrefill = {
  name?: string;
  contact_email?: string;
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

let __msgId = 1;
const nextId = () => __msgId++;

export function TacoProfileChatbot({
  role,
  prefill,
}: {
  role: UserRole;
  prefill?: TacoProfileChatbotPrefill;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const questions = useMemo(() => questionsForRole(role), [role]);

  const [stage, setStage] = useState<Stage>('questions');
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(() => {
    const seed: ProfileDraft = {};
    if (prefill?.name?.trim()) seed.name = prefill.name.trim();
    if (prefill?.contact_email?.trim()) {
      seed.contact_email = prefill.contact_email.trim();
    }
    return seed;
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const intro: ChatMessage = {
      id: nextId(),
      role: 'taco',
      text: `*stretches* Hi. I'm Taco. I'm going to walk you through your ${getRoleLabel(role).toLowerCase()} profile one question at a time. You can paste in chunks — like a name and address together — and I'll sort it out.`,
    };
    const list: ChatMessage[] = [intro];
    const prefilledBits: string[] = [];
    if (prefill?.name?.trim()) prefilledBits.push(`name "${prefill.name.trim()}"`);
    if (prefill?.contact_email?.trim()) {
      prefilledBits.push(`email "${prefill.contact_email.trim()}"`);
    }
    if (prefilledBits.length) {
      list.push({
        id: nextId(),
        role: 'taco',
        text: `*peeks at your account* I already see your ${prefilledBits.join(' and ')} from sign-in — I'll skip those. You can edit them in the preview if anything's off.`,
      });
    }
    return list;
  });
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentQuestion = questions[stepIndex];

  /* ----- AI SDK streaming object hook ---------------------------------- */
  const {
    object: streamedObject,
    submit: submitToTaco,
    isLoading: tacoTyping,
    error: streamError,
  } = useObject({
    api: '/api/profiles/parse-input',
    schema: parsedProfileSchema,
    onFinish: ({ object, error }) => {
      if (error || !object) {
        console.error('[Profiles] taco stream finish with error', error);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'taco',
            text: '*flicks tail* Something went sideways on my end. Try that one again?',
          },
        ]);
        setStreamingReply(null);
        setPendingUserText(null);
        return;
      }

      const finalReply =
        typeof object.taco_reply === 'string' && object.taco_reply.trim()
          ? object.taco_reply.trim().slice(0, 280)
          : '*slow blink* Got it.';

      // Promote the streaming preview into a permanent Taco message.
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'taco', text: finalReply },
      ]);
      setStreamingReply(null);

      // Merge the extracted fields into the draft.
      const extracted = sanitizeParsedFields(object as Partial<ParsedProfilePayload>);
      const fallbackKey = currentQuestion?.key;
      const fallbackText = pendingUserText;

      setDraft((prev) => {
        const next: ProfileDraft = { ...prev };
        for (const [k, v] of Object.entries(extracted) as [
          keyof ParsedProfileFields,
          ParsedProfileFields[keyof ParsedProfileFields],
        ][]) {
          if (v !== undefined && v !== '' && next[k] === undefined) {
            (next as Record<string, unknown>)[k] = v;
          }
        }
        // If the user clearly meant to fill the current field but the parser
        // missed it (e.g. just "Acme"), accept the raw input.
        if (
          fallbackKey &&
          fallbackKey !== 'established_year' &&
          fallbackText &&
          next[fallbackKey] === undefined
        ) {
          (next as Record<string, unknown>)[fallbackKey] = fallbackText;
        }
        return next;
      });
      setPendingUserText(null);
      setStepIndex((i) => i + 1);
    },
  });

  /* ----- show streamed taco_reply as it arrives ------------------------ */
  useEffect(() => {
    if (!tacoTyping) return;
    const partial =
      streamedObject && typeof (streamedObject as { taco_reply?: unknown }).taco_reply === 'string'
        ? ((streamedObject as { taco_reply?: string }).taco_reply ?? '')
        : '';
    setStreamingReply(partial);
  }, [streamedObject, tacoTyping]);

  /* ----- surface stream errors ----------------------------------------- */
  useEffect(() => {
    if (!streamError) return;
    console.error('[Profiles] taco stream error', streamError);
    toast.error('Taco couldn\'t hear that. Try again.');
  }, [streamError]);

  /* ----- ask the next question whenever the step or draft changes ----- */
  useEffect(() => {
    if (stage !== 'questions') return;
    const q = questions[stepIndex];
    if (!q) return;

    // If the draft already has this field, skip ahead silently.
    if (draft[q.key] !== undefined && draft[q.key] !== '') {
      setStepIndex((i) => i + 1);
      return;
    }

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'taco' && last.text === q.prompt) return prev;
      return [...prev, { id: nextId(), role: 'taco', text: q.prompt }];
    });
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, stepIndex, draft]);

  /* ----- end of questions → photo stage -------------------------------- */
  useEffect(() => {
    if (stage === 'questions' && stepIndex >= questions.length) {
      setStage('photo');
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'taco',
          text: 'Last thing — want to add a profile photo? Drop one onto the chat, click Upload, or skip and we\'re done.',
        },
      ]);
    }
  }, [stage, stepIndex, questions.length]);

  /* ----- always scroll to bottom on new messages ----------------------- */
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tacoTyping, streamingReply]);

  /* ----- send an answer ------------------------------------------------ */
  const handleSend = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || tacoTyping || stage !== 'questions') return;
      const q = currentQuestion;
      if (!q) return;

      setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);
      setInput('');
      setPendingUserText(text);
      setStreamingReply('');

      submitToTaco({
        input: text,
        role,
        currentField: q.key,
        alreadyKnown: draft,
      });
    },
    [currentQuestion, draft, role, stage, tacoTyping, submitToTaco],
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

  /* ----- photo upload (shared between click + drop) -------------------- */
  const uploadFile = useCallback(async (file: File) => {
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
  }, []);

  const handlePhotoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void uploadFile(file);
    },
    [uploadFile],
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

  /* ----- drag + drop image anywhere on chat surface -------------------- */
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      // Only react when files are being dragged.
      if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      if (!isDragging) setIsDragging(true);
    },
    [isDragging],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      // Ignore leave events caused by entering child elements.
      if (
        dropZoneRef.current &&
        e.relatedTarget instanceof Node &&
        dropZoneRef.current.contains(e.relatedTarget)
      ) {
        return;
      }
      setIsDragging(false);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      // If the user drops a file before we've reached the photo stage, jump
      // ahead and accept it — they're clearly done answering questions.
      if (stage === 'questions') {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'system',
            text: 'Skipped to photo step',
          },
        ]);
        setStage('photo');
      }
      void uploadFile(file);
    },
    [stage, uploadFile],
  );

  /* ----- voice input via Web Speech API -------------------------------- */
  const speechSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition,
    );
  }, []);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!speechSupported) {
      toast.error('Voice input isn\'t supported in this browser');
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    try {
      const rec = new Ctor();
      rec.lang = 'en-US';
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i]![0]!.transcript;
        }
        setInput(transcript);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch (err) {
      console.error('[Profiles] speech recognition failed', err);
      setListening(false);
    }
  }, [speechSupported]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  /* ----- final save ---------------------------------------------------- */
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
        location: draft.location || draft.address || undefined,
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

  /* ----- JSON preview -------------------------------------------------- */
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
      <Card
        ref={dropZoneRef}
        className="border-wine/20 bg-parchment/60 relative flex flex-col overflow-hidden"
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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

            {/* Live, streaming Taco bubble */}
            {tacoTyping && streamingReply !== null && (
              streamingReply.length > 0 ? (
                <TacoBubble text={streamingReply} streaming />
              ) : (
                <TypingBubble />
              )
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-wine/15 px-4 py-3 bg-parchment/40">
            {stage === 'questions' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (listening) stopListening();
                  handleSend(input);
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    listening
                      ? 'Listening…'
                      : currentQuestion?.placeholder ?? 'Type your answer…'
                  }
                  disabled={tacoTyping}
                  className="flex-1 min-w-0 rounded border border-wine/30 bg-white px-3 py-2 text-sm font-serif text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-wine/40 disabled:opacity-60"
                  maxLength={500}
                />
                {speechSupported && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={listening ? stopListening : startListening}
                    disabled={tacoTyping}
                    className={`shrink-0 font-serif border-wine/30 ${
                      listening
                        ? 'bg-wine/15 text-wine'
                        : 'text-wine hover:bg-wine/10'
                    }`}
                    aria-label={listening ? 'Stop voice input' : 'Speak your answer'}
                    aria-pressed={listening}
                  >
                    {listening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                )}
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
                <span className="text-xs font-serif text-ink/50">
                  or drop one anywhere on the chat
                </span>
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
                  className="font-serif border-wine/30 text-wine hover:bg-wine/10 ml-auto"
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

        {/* Drag overlay */}
        {isDragging && (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-wine bg-parchment/85 backdrop-blur-sm"
            aria-hidden
          >
            <div className="flex flex-col items-center gap-2 text-wine">
              <Upload className="h-8 w-8" />
              <p className="font-display text-lg">Drop a profile photo</p>
              <p className="text-xs font-serif text-ink/70">
                JPEG / PNG up to 5MB
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Live profile preview column */}
      <div className={`${showJson ? 'block' : 'hidden'} lg:block space-y-4`}>
        <PreviewCard draft={draft} role={role} filledCount={filledCount} />
        <JsonCard json={previewJson} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Subcomponents                                                             */
/* -------------------------------------------------------------------------- */

function TacoBubble({ text, streaming }: { text: string; streaming?: boolean }) {
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
        {streaming && (
          <span className="ml-0.5 inline-block h-3 w-1 translate-y-0.5 animate-pulse bg-wine/60 align-baseline" />
        )}
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

/* -------------------------------------------------------------------------- */
/*  Minimal Web Speech API typings                                            */
/* -------------------------------------------------------------------------- */

type SpeechRecognitionResult = {
  0: { transcript: string };
};
type SpeechRecognitionEvent = {
  results: { [index: number]: SpeechRecognitionResult; length: number };
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: ((e: unknown) => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
