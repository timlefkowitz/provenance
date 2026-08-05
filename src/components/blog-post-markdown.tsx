import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownLinkClass =
  'text-vermillion underline underline-offset-4 hover:no-underline transition-colors duration-150';

const markdownComponents: Partial<Components> = {
  h1: (props) => (
    <h1
      className="font-[family-name:var(--font-fraunces)] mt-10 text-3xl font-light italic tracking-[-0.03em] text-editorial-ink first:mt-0"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="font-[family-name:var(--font-fraunces)] mt-10 text-2xl font-light italic tracking-[-0.02em] text-editorial-ink"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="font-[family-name:var(--font-fraunces)] mt-8 text-xl font-light italic tracking-[-0.01em] text-editorial-ink"
      {...props}
    />
  ),
  p: (props) => (
    <p
      className="mt-4 text-base leading-relaxed text-editorial-ink/80 first:mt-0 font-[family-name:var(--font-inter-tight)]"
      {...props}
    />
  ),
  a: (props) => (
    <a className={markdownLinkClass} rel="noopener noreferrer" {...props} />
  ),
  ul: (props) => (
    <ul
      className="mt-4 list-inside list-disc space-y-2 pl-1 font-[family-name:var(--font-inter-tight)] text-editorial-ink/80"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mt-4 list-inside list-decimal space-y-2 pl-1 font-[family-name:var(--font-inter-tight)] text-editorial-ink/80"
      {...props}
    />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="mt-6 border-l-2 border-vermillion/50 pl-5 italic text-editorial-ink/65 font-[family-name:var(--font-fraunces)] font-light text-lg"
      {...props}
    />
  ),
  code: ({ className, children, ...props }) => {
    const isFenced =
      typeof className === 'string' && className.includes('language-');

    return (
      <code
        className={
          isFenced
            ? `block font-[family-name:var(--font-jetbrains)] text-sm whitespace-pre ${className ?? ''}`
            : 'font-[family-name:var(--font-jetbrains)] bg-editorial-ink/8 px-1.5 py-0.5 text-sm text-editorial-ink'
        }
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: (props) => (
    <pre
      className="mt-4 overflow-x-auto border border-editorial-border/40 bg-bone p-5 text-sm"
      {...props}
    />
  ),
  hr: (props) => <hr className="my-10 border-editorial-border/30" {...props} />,
  table: (props) => (
    <div className="mt-4 overflow-x-auto">
      <table
        className="w-full border-collapse border border-editorial-border/30 text-sm text-editorial-ink/80"
        {...props}
      />
    </div>
  ),
  thead: (props) => <thead className="bg-editorial-ink/5" {...props} />,
  tbody: (props) => <tbody {...props} />,
  tr: (props) => <tr className="border-b border-editorial-border/20" {...props} />,
  th: (props) => (
    <th
      className="border border-editorial-border/30 px-3 py-2 text-left font-[family-name:var(--font-jetbrains)] text-xs uppercase tracking-[0.1em] text-editorial-ink"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border border-editorial-border/20 px-3 py-2 align-top" {...props} />
  ),
};

export function BlogPostMarkdown({ source }: { source: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
