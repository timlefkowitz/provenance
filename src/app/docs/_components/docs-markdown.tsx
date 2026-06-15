import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { slugifyHeading } from '../_lib/load-doc';
import { docsProseWidth } from './docs-tokens';

const linkClass =
  'text-[#67d4ff] underline underline-offset-4 decoration-[#1793d1]/40 hover:decoration-[#67d4ff] transition-colors';

function headingId(children: React.ReactNode): string {
  const text =
    typeof children === 'string'
      ? children
      : Array.isArray(children)
        ? children.map((c) => (typeof c === 'string' ? c : '')).join('')
        : '';
  return slugifyHeading(text.replace(/\*\*/g, '').replace(/`/g, ''));
}

const markdownComponents: Partial<Components> = {
  h1: ({ children, ...props }) => {
    const id = headingId(children);
    return (
      <h1
        id={id}
        className="scroll-mt-24 font-mono text-2xl font-semibold tracking-tight text-slate-100 first:mt-0 sm:text-3xl"
        {...props}
      >
        {children}
      </h1>
    );
  },
  h2: ({ children, ...props }) => {
    const id = headingId(children);
    return (
      <h2
        id={id}
        className="scroll-mt-24 mt-10 font-mono text-xl font-semibold tracking-tight text-[#67d4ff] first:mt-0"
        {...props}
      >
        {children}
      </h2>
    );
  },
  h3: ({ children, ...props }) => {
    const id = headingId(children);
    return (
      <h3
        id={id}
        className="scroll-mt-24 mt-8 font-mono text-base font-semibold text-slate-200"
        {...props}
      >
        {children}
      </h3>
    );
  },
  h4: ({ children, ...props }) => {
    const id = headingId(children);
    return (
      <h4
        id={id}
        className="scroll-mt-24 mt-6 font-mono text-sm font-medium text-slate-300"
        {...props}
      >
        {children}
      </h4>
    );
  },
  p: (props) => (
    <p
      className="mt-4 text-[15px] leading-relaxed text-slate-400 first:mt-0"
      {...props}
    />
  ),
  a: (props) => (
    <a className={linkClass} rel="noopener noreferrer" {...props} />
  ),
  ul: (props) => (
    <ul
      className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-slate-400 marker:text-[#1793d1]/60"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-slate-400 marker:text-[#1793d1]/60"
      {...props}
    />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => (
    <strong className="font-semibold text-slate-200" {...props} />
  ),
  blockquote: (props) => (
    <blockquote
      className="mt-6 rounded-sm border border-[#1793d1]/25 border-l-4 border-l-[#1793d1]/60 bg-[#12151c]/80 px-4 py-3 text-[15px] italic text-slate-400"
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
            ? `block font-mono text-[13px] leading-relaxed whitespace-pre text-slate-300 ${className ?? ''}`
            : 'rounded-sm border border-[#1793d1]/20 bg-[#0f1318] px-1.5 py-0.5 font-mono text-[13px] text-[#67d4ff]'
        }
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: (props) => (
    <pre
      className="mt-4 overflow-x-auto rounded-sm border border-[#1793d1]/25 bg-[#0a0c10] p-4 text-sm shadow-[inset_0_1px_0_0_rgba(23,147,209,0.06)]"
      {...props}
    />
  ),
  hr: (props) => <hr className="my-10 border-[#1793d1]/15" {...props} />,
  table: (props) => (
    <div className="mt-4 overflow-x-auto rounded-sm border border-[#1793d1]/20">
      <table
        className="w-full min-w-[480px] border-collapse font-mono text-[13px] text-slate-300"
        {...props}
      />
    </div>
  ),
  thead: (props) => (
    <thead
      className="border-b border-[#1793d1]/20 bg-[#12151c] text-left text-[11px] uppercase tracking-wide text-[#1793d1]/70"
      {...props}
    />
  ),
  tbody: (props) => <tbody className="divide-y divide-[#1793d1]/10" {...props} />,
  tr: (props) => <tr className="hover:bg-white/[0.02]" {...props} />,
  th: (props) => (
    <th className="px-3 py-2 font-medium text-slate-400" {...props} />
  ),
  td: (props) => (
    <td className="px-3 py-2 align-top text-slate-400" {...props} />
  ),
};

type DocsMarkdownProps = {
  source: string;
};

export function DocsMarkdown({ source }: DocsMarkdownProps) {
  return (
    <article className={docsProseWidth}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {source}
      </ReactMarkdown>
    </article>
  );
}
