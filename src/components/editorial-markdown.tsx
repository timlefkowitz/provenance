import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@kit/ui/utils';

// Compact markdown for user-written descriptions (exhibitions, open calls).
// Same voice as the navbar and BlogPostMarkdown, sized for body copy rather
// than long-form articles. Raw HTML is not rendered.
const components: Partial<Components> = {
  h1: (props) => (
    <h3 className="mt-8 font-fraunces text-2xl italic tracking-tight text-editorial-ink first:mt-0" {...props} />
  ),
  h2: (props) => (
    <h3 className="mt-8 font-fraunces text-2xl italic tracking-tight text-editorial-ink first:mt-0" {...props} />
  ),
  h3: (props) => (
    <h4 className="mt-6 font-fraunces text-xl italic tracking-tight text-editorial-ink first:mt-0" {...props} />
  ),
  p: (props) => <p className="mt-4 first:mt-0" {...props} />,
  a: ({ href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-vermillion underline underline-offset-4 transition-colors hover:no-underline"
      {...props}
    />
  ),
  strong: (props) => <strong className="font-semibold text-editorial-ink" {...props} />,
  ul: (props) => <ul className="mt-4 list-disc space-y-1.5 pl-5 first:mt-0 marker:text-vermillion" {...props} />,
  ol: (props) => <ol className="mt-4 list-decimal space-y-1.5 pl-5 first:mt-0 marker:font-jetbrains marker:text-sm marker:text-vermillion" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="mt-6 border-l-2 border-vermillion/60 pl-5 font-fraunces text-xl italic text-editorial-ink first:mt-0"
      {...props}
    />
  ),
  hr: () => <hr className="my-8 border-editorial-border/30" />,
  code: (props) => (
    <code className="bg-cream/60 px-1.5 py-0.5 font-jetbrains text-[0.85em]" {...props} />
  ),
  img: () => null,
};

// Descriptions written before markdown relied on single line breaks; keep
// them as hard breaks (a trailing double space) instead of joining lines.
function preserveLineBreaks(text: string): string {
  return text.replace(/([^\n])\n(?!\n)/g, '$1  \n');
}

export function EditorialMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    // leading after className: tailwind-merge drops it when a text-* size is passed.
    <div className={cn('font-serif text-editorial-ink/80', className, 'leading-relaxed')}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {preserveLineBreaks(children)}
      </ReactMarkdown>
    </div>
  );
}
