import type { LegalDocument } from '~/lib/legal/legal-documents';

type Props = {
  document: LegalDocument;
  className?: string;
};

export function LegalDocumentBody({ document, className }: Props) {
  return (
    <div className={className}>
      {document.disclaimer && (
        <p className="text-xs italic text-ink/55 font-serif leading-relaxed mb-6">
          {document.disclaimer}
        </p>
      )}
      <div className="space-y-6">
        {document.sections.map((section, i) => (
          <section key={i}>
            {section.heading && (
              <h3 className="font-display text-sm font-semibold text-wine mb-2 uppercase tracking-wide">
                {section.heading}
              </h3>
            )}
            <div className="space-y-3">
              {section.paragraphs.map((paragraph, j) => (
                <p key={j} className="text-sm font-serif text-ink/80 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
