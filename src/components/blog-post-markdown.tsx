import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownLinkClass =
  'text-wine font-medium underline underline-offset-4 hover:no-underline';

const markdownComponents: Partial<Components> = {
  h1: (props) => (
    <h1
      className="font-display mt-10 text-3xl font-medium tracking-tight text-wine first:mt-0"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="font-display mt-10 text-2xl font-medium tracking-tight text-wine"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="font-display mt-8 text-xl font-medium tracking-tight text-wine"
      {...props}
    />
  ),
  p: (props) => (
    <p
      className="mt-4 text-base leading-relaxed text-ink/80 first:mt-0 font-body"
      {...props}
    />
  ),
  a: (props) => (
    <a className={markdownLinkClass} rel="noopener noreferrer" {...props} />
  ),
  ul: (props) => (
    <ul
      className="mt-4 list-inside list-disc space-y-2 pl-1 font-body text-ink/80"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mt-4 list-inside list-decimal space-y-2 pl-1 font-body text-ink/80"
      {...props}
    />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="mt-6 border-l-4 border-wine/40 pl-4 italic text-ink/70 font-body"
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
            ? `block font-mono text-sm whitespace-pre ${className ?? ''}`
            : 'rounded bg-wine/10 px-1.5 py-0.5 font-mono text-sm text-ink'
        }
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: (props) => (
    <pre
      className="mt-4 overflow-x-auto rounded-lg border border-wine/20 bg-parchment p-4 text-sm"
      {...props}
    />
  ),
  hr: (props) => <hr className="my-10 border-wine/20" {...props} />,
  table: (props) => (
    <div className="mt-4 overflow-x-auto">
      <table
        className="w-full border-collapse border border-wine/20 text-sm text-ink/80"
        {...props}
      />
    </div>
  ),
  thead: (props) => <thead className="bg-wine/5" {...props} />,
  tbody: (props) => <tbody {...props} />,
  tr: (props) => <tr className="border-b border-wine/15" {...props} />,
  th: (props) => (
    <th
      className="border border-wine/20 px-3 py-2 text-left font-medium text-ink"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border border-wine/15 px-3 py-2 align-top" {...props} />
  ),
};

export function BlogPostMarkdown({ source }: { source: string }) {
  return (
    <div className="max-w-3xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
