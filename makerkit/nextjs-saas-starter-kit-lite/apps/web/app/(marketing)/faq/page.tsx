import Link from 'next/link';

import { ArrowRight, ChevronDown } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export const generateMetadata = async () => {
  return {
    title: 'FAQ — Provenance | Certificates, Registries & Art Provenance',
    description:
      'Answers to common questions about Provenance — certificates of authenticity, collection records, gallery tools, and how the provenance registry works.',
  };
};

async function FAQPage() {
  const { t } = await createI18nServerInstance();

  const faqItems = [
    {
      question: `What is Provenance?`,
      answer: `Provenance is a registry platform for artworks, collectibles, and objects. Artists issue certificates of authenticity, collectors build ownership records with full provenance history, galleries manage exhibitions and open calls, and institutions track custody with an append-only audit trail — all on one verifiable platform.`,
    },
    {
      question: `Is there a free plan?`,
      answer: `Yes. You can start free and register your first artworks without entering a credit card. Paid plans unlock higher volume, advanced certificate workflows, and institution-grade features.`,
    },
    {
      question: `What is a certificate of authenticity on Provenance?`,
      answer: `It is a structured digital record tied to your artwork that moves through artist claim, owner verification, and public verified states. It is stronger than a PDF stored in email because it carries provenance history, custody transfers, and a clear audit trail that travels with the object.`,
    },
    {
      question: `What types of certificates does Provenance support?`,
      answer: `Provenance supports certificates of authenticity (artist-issued), certificates of ownership (collector-facing), certificates of show (gallery-issued), and certificates of intermediary (for institutions handling consignment and loans). All share a unified registry so authenticity, title, and handoff context stay aligned.`,
    },
    {
      question: `Can I keep my artworks and collection private?`,
      answer: `Yes. Objects support private draft, published, and verified visibility states. You control what appears in public feeds and what is shared only with advisors, galleries, or counterparties — without losing the structured provenance record underneath.`,
    },
    {
      question: `Who is Provenance for?`,
      answer: `Provenance is built for artists who want a defensible record from day one, collectors who need ownership documentation that survives resale, galleries running exhibitions and open calls, and museums or foundations that require loans, invoicing, accessioning, and API-level verification for partner institutions.`,
    },
    {
      question: `How do galleries use Provenance for open calls and exhibitions?`,
      answer: `Galleries can create exhibitions and link artworks, manage staff with team permissions, and publish open calls with submission open and close dates, call types, and location eligibility. Artists see only the calls they are eligible to apply to.`,
    },
    {
      question: `What makes a digital certificate of authenticity better than a PDF?`,
      answer: `A PDF freezes time. A Provenance certificate is a living record: it can receive custody transfers, provenance updates, exhibition history, and conservation notes without replacing or reprinting the original. Corrections go through structured update requests, so there is an audit trail instead of a silent edit.`,
    },
  ];

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => {
      return {
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      };
    }),
  };

  return (
    <>
      <script
        key={'ld:json'}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className={'flex flex-col space-y-4 xl:space-y-8'}>
        <SitePageHeader
          title={t('marketing:faq')}
          subtitle={t('marketing:faqSubtitle')}
        />

        <div className={'container flex flex-col space-y-8 pb-16'}>
          <div className="flex w-full max-w-xl flex-col">
            {faqItems.map((item, index) => {
              return <FaqItem key={index} item={item} />;
            })}
          </div>

          <div>
            <Button asChild variant={'outline'}>
              <Link href={'/contact'}>
                <span>
                  <Trans i18nKey={'marketing:contactFaq'} />
                </span>

                <ArrowRight className={'ml-2 w-4'} />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default withI18n(FAQPage);

function FaqItem({
  item,
}: React.PropsWithChildren<{
  item: {
    question: string;
    answer: string;
  };
}>) {
  return (
    <details className={'group border-b px-2 py-4 last:border-b-transparent'}>
      <summary
        className={
          'flex items-center justify-between hover:cursor-pointer hover:underline'
        }
      >
        <h2
          className={
            'hover:underline-none cursor-pointer font-sans font-medium'
          }
        >
          <Trans i18nKey={item.question} defaults={item.question} />
        </h2>

        <div>
          <ChevronDown
            className={'h-5 transition duration-300 group-open:-rotate-180'}
          />
        </div>
      </summary>

      <div className={'text-muted-foreground flex flex-col space-y-2 py-1'}>
        <Trans i18nKey={item.answer} defaults={item.answer} />
      </div>
    </details>
  );
}
