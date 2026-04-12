import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownLinkClass =
  'text-primary font-medium underline underline-offset-4 hover:no-underline';

const markdownComponents: Partial<Components> = {
  h1: (props) => (
    <h1
      className="font-heading mt-10 text-3xl font-medium tracking-tight first:mt-0 dark:text-white"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="font-heading mt-10 text-2xl font-medium tracking-tight dark:text-white"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="font-heading mt-8 text-xl font-medium tracking-tight dark:text-white"
      {...props}
    />
  ),
  p: (props) => (
    <p
      className="text-muted-foreground mt-4 text-base leading-relaxed first:mt-0"
      {...props}
    />
  ),
  a: (props) => (
    <a className={markdownLinkClass} rel="noopener noreferrer" {...props} />
  ),
  ul: (props) => (
    <ul
      className="text-muted-foreground mt-4 list-inside list-disc space-y-2 pl-1"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="text-muted-foreground mt-4 list-inside list-decimal space-y-2 pl-1"
      {...props}
    />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="border-primary/30 text-muted-foreground mt-6 border-l-4 pl-4 italic"
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
            : 'bg-muted rounded px-1.5 py-0.5 font-mono text-sm'
        }
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: (props) => (
    <pre
      className="bg-muted mt-4 overflow-x-auto rounded-lg border p-4 text-sm"
      {...props}
    />
  ),
  hr: (props) => <hr className="border-border my-10" {...props} />,
  table: (props) => (
    <div className="mt-4 overflow-x-auto">
      <table
        className="border-border text-muted-foreground w-full border-collapse text-sm"
        {...props}
      />
    </div>
  ),
  thead: (props) => <thead className="bg-muted/60" {...props} />,
  tbody: (props) => <tbody {...props} />,
  tr: (props) => <tr className="border-border border-b" {...props} />,
  th: (props) => (
    <th
      className="text-foreground border-border border px-3 py-2 text-left font-medium"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border-border border px-3 py-2 align-top" {...props} />
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
