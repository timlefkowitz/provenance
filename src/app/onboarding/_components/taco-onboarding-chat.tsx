'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { saveOnboardingAnswers, type OnboardingAnswers } from '../_actions/save-onboarding-answers';

/* -------------------------------------------------------------------------- */
/*  Step definitions                                                          */
/* -------------------------------------------------------------------------- */

type Step = 'welcome' | 'cv' | 'cv_upload' | 'sold_work' | 'medium' | 'goal' | 'done';

type Answers = {
  has_cv: boolean | null;
  has_sold_work: OnboardingAnswers['has_sold_work'] | null;
  medium: string | null;
  goal: string | null;
};

/* -------------------------------------------------------------------------- */
/*  Static message content                                                    */
/* -------------------------------------------------------------------------- */

const TACO_MESSAGES: Record<Step, string> = {
  welcome:
    "*stretches and blinks* Hello. I'm Taco — your studio assistant on Provenance. Before you dive in, let me ask you a few quick questions so I can make the app actually useful for you. It'll take about a minute. Ready?",
  cv: "Do you have an artist CV? It's a document listing your exhibitions, education, and practice. I use it to match you with grants and residencies.",
  cv_upload:
    "Great — you can upload your CV now. I'll read it and use it to find you grants right away. PDF, Word, or plain text all work. *Or skip this and do it later from the Grants page.*",
  sold_work:
    "Have you sold artwork before? This helps me give you better information about pricing and market context.",
  medium:
    "What's your primary medium or discipline? Pick the one that fits best — you can always update your profile later.",
  goal:
    "Last one — what brings you to Provenance? I'll point you at the right tools to start.",
  done: "*slow blink* Perfect. I've got everything I need. I'll take you to your first Certificate of Authenticity now. That's the core of what we do here — documenting your work.",
};

/* -------------------------------------------------------------------------- */
/*  Quick-reply option sets                                                   */
/* -------------------------------------------------------------------------- */

const CV_OPTIONS = [
  { label: "Yes, I have a CV", value: true },
  { label: "No, not yet", value: false },
];

const SOLD_OPTIONS: { label: string; value: OnboardingAnswers['has_sold_work'] }[] = [
  { label: "Never sold yet", value: 'never' },
  { label: "A few pieces", value: 'occasionally' },
  { label: "Regularly", value: 'regularly' },
  { label: "Through galleries", value: 'gallery_represented' },
];

const MEDIUM_OPTIONS = [
  'Painting', 'Drawing', 'Sculpture', 'Photography', 'Digital', 'Printmaking',
  'Ceramics', 'Textile', 'Installation', 'Video', 'Performance', 'Mixed media',
];

const GOAL_OPTIONS = [
  { label: "Certificate my work", value: 'certificates' },
  { label: "Find grants & residencies", value: 'grants' },
  { label: "Build my artist website", value: 'website' },
  { label: "Track & sell my work", value: 'sales' },
  { label: "Manage my collection", value: 'collection' },
];

/* -------------------------------------------------------------------------- */
/*  Goal → redirect target                                                    */
/* -------------------------------------------------------------------------- */

const GOAL_REDIRECTS: Record<string, string> = {
  certificates: '/artworks/add?first_run=1',
  grants: '/grants',
  website: '/profile/site',
  sales: '/portal/sales',
  collection: '/artworks',
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

type ChatMsg = { id: number; role: 'taco' | 'user'; content: string };
let msgId = 1;

export function TacoOnboardingChat() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [answers, setAnswers] = useState<Answers>({
    has_cv: null,
    has_sold_work: null,
    medium: null,
    goal: null,
  });
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: msgId++, role: 'taco', content: TACO_MESSAGES.welcome },
  ]);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvUploaded, setCvUploaded] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function addTacoMessage(content: string) {
    setMessages((prev) => [...prev, { id: msgId++, role: 'taco', content }]);
  }

  function addUserMessage(content: string) {
    setMessages((prev) => [...prev, { id: msgId++, role: 'user', content }]);
  }

  /* ---- Step handlers ---- */

  function handleWelcomeReady() {
    addUserMessage("Let's go.");
    setStep('cv');
    setTimeout(() => addTacoMessage(TACO_MESSAGES.cv), 400);
  }

  function handleSkip() {
    addUserMessage('Skip for now');
    continueAfterStep(step);
  }

  function handleCvChoice(hasCV: boolean) {
    setAnswers((a) => ({ ...a, has_cv: hasCV }));
    addUserMessage(hasCV ? "Yes, I have a CV" : "No, not yet");

    if (hasCV) {
      setStep('cv_upload');
      setTimeout(() => addTacoMessage(TACO_MESSAGES.cv_upload), 400);
    } else {
      addUserMessage('');
      setStep('sold_work');
      setTimeout(() => addTacoMessage(TACO_MESSAGES.sold_work), 400);
    }
  }

  async function handleCvUpload(file: File) {
    setCvFile(file);
    setCvError(null);
    setCvUploading(true);
    console.log('[Onboarding] CV upload started', file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/onboarding/upload-cv', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json() as { success: boolean; error?: string };

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Upload failed');
      }

      console.log('[Onboarding] CV upload succeeded');
      setCvUploaded(true);
      addUserMessage(`Uploaded: ${file.name}`);
      addTacoMessage(
        "*reads carefully* Got it — I've saved your CV. I'll use it to match you with grants. Let's keep going.",
      );
      setStep('sold_work');
      setTimeout(() => addTacoMessage(TACO_MESSAGES.sold_work), 600);
    } catch (err) {
      console.error('[Onboarding] CV upload failed', err);
      setCvError(err instanceof Error ? err.message : 'Upload failed. Try again.');
    } finally {
      setCvUploading(false);
    }
  }

  function handleSoldWork(value: OnboardingAnswers['has_sold_work']) {
    setAnswers((a) => ({ ...a, has_sold_work: value }));
    const label = SOLD_OPTIONS.find((o) => o.value === value)?.label ?? value;
    addUserMessage(label);
    setStep('medium');
    setTimeout(() => addTacoMessage(TACO_MESSAGES.medium), 400);
  }

  function handleMedium(value: string) {
    setAnswers((a) => ({ ...a, medium: value }));
    addUserMessage(value);
    setStep('goal');
    setTimeout(() => addTacoMessage(TACO_MESSAGES.goal), 400);
  }

  function handleGoal(value: string) {
    const label = GOAL_OPTIONS.find((o) => o.value === value)?.label ?? value;
    addUserMessage(label);
    setAnswers((a) => ({ ...a, goal: value }));
    finishOnboarding({ ...answers, goal: value });
  }

  function continueAfterStep(fromStep: Step) {
    const order: Step[] = ['welcome', 'cv', 'cv_upload', 'sold_work', 'medium', 'goal', 'done'];
    const idx = order.indexOf(fromStep);
    const next = (order[idx + 1] ?? 'goal') as Step;

    if (next === 'sold_work' || next === 'medium' || next === 'goal') {
      setStep(next);
      setTimeout(() => addTacoMessage(TACO_MESSAGES[next]), 400);
    } else if (next === 'done') {
      finishOnboarding(answers);
    }
  }

  async function finishOnboarding(finalAnswers: Answers) {
    setSaving(true);
    setStep('done');
    addTacoMessage(TACO_MESSAGES.done);

    console.log('[Onboarding] saving answers', finalAnswers);

    try {
      const result = await saveOnboardingAnswers({
        has_cv: finalAnswers.has_cv ?? false,
        has_sold_work: finalAnswers.has_sold_work ?? 'never',
        medium: finalAnswers.medium ?? '',
        goal: finalAnswers.goal ?? 'certificates',
      });

      if (!result.success) {
        console.error('[Onboarding] saveOnboardingAnswers failed', result.error);
      } else {
        console.log('[Onboarding] answers saved successfully');
      }
    } catch (err) {
      console.error('[Onboarding] finishOnboarding threw', err);
    } finally {
      setSaving(false);
    }

    const redirectTo = GOAL_REDIRECTS[finalAnswers.goal ?? 'certificates'] ?? '/artworks/add?first_run=1';
    setTimeout(() => {
      router.push(redirectTo);
    }, 2200);
  }

  /* ---- Render ---- */

  return (
    <div className="flex min-h-[calc(100dvh-var(--nav-h)-var(--tabbar-h)-env(safe-area-inset-bottom,0px))] flex-col items-center justify-center px-4 py-8 bg-parchment/30">
      <div className="w-full max-w-lg">
        {/* Taco header */}
        <div className="mb-7 flex items-center gap-4">
          <div className="relative shrink-0">
            <Image
              src="/taco-cat.png"
              alt="Taco the cat"
              width={60}
              height={60}
              className="rounded-full object-cover ring-2 ring-wine/20 shadow-sm"
              priority
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-parchment" />
          </div>
          <div>
            <h1 className="font-display text-[1.7rem] text-wine leading-none mb-1">Taco the cat</h1>
            <p className="text-sm text-ink/55 font-serif">Studio onboarding · a few quick questions</p>
          </div>
        </div>

        {/* Chat thread */}
        <div className="rounded-2xl border border-wine/15 bg-white shadow-editorial overflow-hidden">
          <div className="flex flex-col gap-5 p-6 max-h-[48vh] overflow-y-auto">
            {messages.map((msg) =>
              msg.role === 'taco' ? (
                <TacoMsg key={msg.id} content={msg.content} />
              ) : msg.content ? (
                <UserMsg key={msg.id} content={msg.content} />
              ) : null,
            )}
            {(saving || cvUploading) && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Action area */}
          <div className="border-t border-wine/10 bg-parchment/40 px-6 py-5">
            {step === 'welcome' && (
              <div className="flex gap-2">
                <Button onClick={handleWelcomeReady} className="flex-1 font-serif text-[15px] font-medium bg-wine text-parchment hover:bg-wine/80 py-5">
                  Ready — let&apos;s go
                </Button>
                <Button variant="outline" onClick={() => router.push('/artworks/add?first_run=1')} className="font-serif text-[15px] text-ink/50 border-wine/20 hover:bg-wine/5 py-5">
                  Skip all
                </Button>
              </div>
            )}

            {step === 'cv' && (
              <QuickReplies
                options={CV_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) }))}
                onSelect={(v) => handleCvChoice(v === 'true')}
                onSkip={handleSkip}
              />
            )}

            {step === 'cv_upload' && !cvUploaded && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCvUpload(f);
                    e.target.value = '';
                  }}
                />
                {cvFile && !cvUploaded && (
                  <div className="flex items-center gap-2 rounded-lg border border-wine/15 bg-white px-3.5 py-2.5 text-[15px] font-serif text-ink/70">
                    <FileText className="h-4 w-4 text-wine/50 shrink-0" />
                    <span className="truncate flex-1">{cvFile.name}</span>
                    {cvUploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-wine/50 shrink-0" />}
                  </div>
                )}
                {cvError && (
                  <p className="text-sm text-red-500 font-serif">{cvError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={cvUploading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-wine/25 bg-wine/5 px-4 py-3 text-[15px] font-serif font-medium text-wine hover:bg-wine hover:text-parchment transition-colors disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    {cvUploading ? 'Uploading…' : 'Upload CV'}
                  </button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      addUserMessage('Skip for now');
                      setStep('sold_work');
                      setTimeout(() => addTacoMessage(TACO_MESSAGES.sold_work), 400);
                    }}
                    className="font-serif text-ink/50 border-wine/20 hover:bg-wine/5"
                    disabled={cvUploading}
                  >
                    Skip
                  </Button>
                </div>
              </div>
            )}

            {step === 'sold_work' && (
              <QuickReplies
                options={SOLD_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
                onSelect={(v) => handleSoldWork(v as OnboardingAnswers['has_sold_work'])}
                onSkip={handleSkip}
              />
            )}

            {step === 'medium' && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2.5">
                  {MEDIUM_OPTIONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => handleMedium(m)}
                      className="rounded-xl border border-wine/20 bg-white px-4 py-2 text-[15px] font-serif font-medium text-ink hover:bg-wine hover:text-parchment hover:border-wine transition-colors"
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSkip}
                  className="text-sm text-ink/40 font-serif hover:text-ink/70 transition-colors mt-1"
                >
                  Skip for now
                </button>
              </div>
            )}

            {step === 'goal' && (
              <QuickReplies
                options={GOAL_OPTIONS}
                onSelect={(v) => handleGoal(v)}
                onSkip={() => finishOnboarding(answers)}
              />
            )}

            {step === 'done' && (
              <div className="flex items-center gap-2 text-[15px] font-serif text-ink/60">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-wine/50" />
                    Saving your answers…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Taking you in…
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-[13px] text-ink/40 font-serif">
          You can update all of this from your profile settings anytime.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function TacoMsg({ content }: { content: string }) {
  return (
    <div className="flex items-end gap-2.5">
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-wine/10">
        <Image src="/taco-cat.png" alt="" fill className="object-cover object-top" sizes="32px" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-wine/10 bg-parchment/60 px-5 py-3.5 text-[15px] font-serif font-medium text-ink leading-relaxed shadow-xs">
        {content}
      </div>
    </div>
  );
}

function UserMsg({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-wine px-5 py-3 text-[15px] font-serif font-medium text-parchment leading-relaxed">
        {content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5">
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-wine/10">
        <Image src="/taco-cat.png" alt="" fill className="object-cover object-top" sizes="32px" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-wine/10 bg-parchment/60 px-3.5 py-3 shadow-xs">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine/50 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine/50 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine/50 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function QuickReplies({
  options,
  onSelect,
  onSkip,
}: {
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
  onSkip?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            className="w-full rounded-xl border border-wine/20 bg-white px-5 py-3 text-left text-[15px] font-serif font-medium text-ink hover:bg-wine hover:text-parchment hover:border-wine transition-colors"
          >
            {o.label}
          </button>
        ))}
      </div>
      {onSkip && (
        <button
          onClick={onSkip}
          className="text-sm text-ink/40 font-serif hover:text-ink/70 transition-colors"
        >
          Skip for now
        </button>
      )}
    </div>
  );
}
