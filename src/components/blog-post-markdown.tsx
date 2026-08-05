import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownLinkClass =
  'text-vermillion underline underline-offset-4 hover:no-underline transition-colors duration-150';

const markdownComponents: Partial<Components> = {
  h1: (props) => (
    <h1
      className="font-[family-name:var(--font-fraunces)] mt-12 text-4xl font-semibold italic tracking-[-0.03em] text-editorial-ink first:mt-0"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="font-[family-name:var(--font-fraunces)] mt-12 text-3xl font-semibold italic tracking-[-0.02em] text-editorial-ink"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="font-[family-name:var(--font-fraunces)] mt-10 text-2xl font-semibold italic tracking-[-0.01em] text-editorial-ink"
      {...props}
    />
  ),
  p: (props) => (
    <p
      className="mt-6 text-lg md:text-xl leading-[1.8] text-editorial-ink font-normal first:mt-0 font-[family-name:var(--font-inter-tight)]"
      {...props}
    />
  ),
  a: (props) => (
    <a className={markdownLinkClass} rel="noopener noreferrer" {...props} />
  ),
  ul: (props) => (
    <ul
      className="mt-6 list-inside list-disc space-y-3 pl-1 text-lg md:text-xl leading-[1.8] font-[family-name:var(--font-inter-tight)] text-editorial-ink"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mt-6 list-inside list-decimal space-y-3 pl-1 text-lg md:text-xl leading-[1.8] font-[family-name:var(--font-inter-tight)] text-editorial-ink"
      {...props}
    />
  ),
  li: (props) => <li className="leading-[1.8]" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="mt-8 border-l-4 border-vermillion/50 pl-6 italic text-editorial-ink font-[family-name:var(--font-fraunces)] font-medium text-xl md:text-2xl leading-relaxed"
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
