'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownViewerProps = {
  content: string;
};

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <article className="investor-markdown font-body text-ink leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-display text-2xl sm:text-3xl text-wine mt-8 mb-4 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-display text-xl sm:text-2xl text-wine mt-8 mb-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-display text-lg text-wine mt-6 mb-2">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-4">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="ml-1">{children}</li>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-6">
              <table className="w-full border-collapse border border-wine/40 text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-wine/10">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-wine/40 px-3 py-2 text-left font-display text-wine">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-wine/40 px-3 py-2">{children}</td>
          ),
          tr: ({ children }) => <tr>{children}</tr>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          strong: ({ children }) => <strong className="font-semibold text-wine/90">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} className="text-wine underline hover:no-underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          hr: () => <hr className="border-wine/30 my-8" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-wine/50 pl-4 my-4 italic text-ink/80">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
