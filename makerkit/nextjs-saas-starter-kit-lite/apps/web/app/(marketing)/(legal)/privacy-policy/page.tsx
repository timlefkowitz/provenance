import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export async function generateMetadata() {
  const { t } = await createI18nServerInstance();

  return {
    title: t('marketing:privacyPolicy'),
  };
}

async function PrivacyPolicyPage() {
  const { t } = await createI18nServerInstance();

  return (
    <div>
      <SitePageHeader
        title={t('marketing:privacyPolicy')}
        subtitle={'Last updated: June 2025'}
      />

      <div className={'container mx-auto max-w-3xl py-12'}>
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-base leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold">1. Who we are</h2>
            <p>
              Provenance (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the platform available at{' '}
              <strong>provenance.guru</strong>. We provide a registry for art provenance — enabling
              artists, collectors, galleries, and institutions to create, manage, and verify
              certificates of authenticity and ownership records for artworks.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Information we collect</h2>

            <h3 className="mt-4 text-base font-semibold">2a. Information you provide</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Account information (name, email address)</li>
              <li>Artwork records, certificates, provenance fields, and supporting documents you upload</li>
              <li>Exhibition, submission, or grant-related content</li>
              <li>Communications you send us</li>
            </ul>

            <h3 className="mt-4 text-base font-semibold">2b. Information from Google Sign-In</h3>
            <p className="mt-2">
              When you choose to sign in with Google, we receive from Google only the data that
              you authorise on the Google consent screen. Specifically, we request:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Email address</strong> — used to create and identify your account and send
                transactional notifications.
              </li>
              <li>
                <strong>Display name</strong> — used to personalise your dashboard and certificates.
              </li>
              <li>
                <strong>Profile photo</strong> — used as your account avatar within the platform.
              </li>
            </ul>
            <p className="mt-2">
              We do <strong>not</strong> request access to your Google Drive, Gmail, contacts,
              calendar, or any other Google service. Your Google password is never shared with us —
              all authentication is handled by Google and processed through Supabase Auth.
            </p>

            <h3 className="mt-4 text-base font-semibold">2c. Automatically collected information</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Log data (IP address, browser type, pages visited, timestamps)</li>
              <li>Cookies and session identifiers necessary for authentication and security</li>
              <li>Usage analytics to understand how features are used (aggregated, not sold)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. How we use your information</h2>
            <p>We use the information we collect to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Create and maintain your account</li>
              <li>Provide the provenance registry and certificate services</li>
              <li>Send transactional emails (account verification, certificate notifications)</li>
              <li>Improve and secure the platform</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-2">
              We do <strong>not</strong> use your data for advertising, and we do not sell or rent
              your personal information to any third party.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. How we share your information</h2>
            <p>
              We share personal information only in the following limited circumstances:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Service providers:</strong> Supabase (database and authentication), Vercel
                (hosting), and similar infrastructure providers that process data on our behalf and
                are bound by data processing agreements.
              </li>
              <li>
                <strong>Public certificate records:</strong> If you publish a certificate of
                authenticity, the information you choose to make public (artwork title, artist
                name, etc.) will be visible to other users and the public.
              </li>
              <li>
                <strong>Legal requirements:</strong> If required by law or to protect the rights,
                safety, or property of Provenance or others.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Data retention</h2>
            <p>
              We retain your account data for as long as your account is active. If you delete your
              account, we will remove your personal information within 30 days, except where we are
              required to retain it by law or for legitimate operational purposes (e.g., resolving
              disputes).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Cookies</h2>
            <p>
              We use strictly necessary cookies for authentication and security (session cookies,
              CSRF tokens). We do not use third-party advertising cookies. You can manage cookie
              preferences in your browser settings. For details, see our{' '}
              <a href="/cookie-policy" className="text-primary underline underline-offset-4">
                Cookie Policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Your rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data (&quot;right to be forgotten&quot;)</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{' '}
              <a
                href="mailto:privacy@provenance.guru"
                className="text-primary underline underline-offset-4"
              >
                privacy@provenance.guru
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Security</h2>
            <p>
              We use industry-standard security measures including encrypted connections (HTTPS),
              server-side authentication via Supabase, and row-level security policies on our
              database. No method of transmission over the internet is 100% secure; we encourage
              you to use a strong, unique password or sign in with Google for added security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Children</h2>
            <p>
              Provenance is not intended for children under 13. We do not knowingly collect personal
              information from children under 13. If you believe we have inadvertently collected
              such data, please contact us and we will promptly delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by posting the updated policy on this page with a revised &quot;Last updated&quot; date.
              Continued use of the platform after changes constitutes acceptance of the updated
              policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Contact us</h2>
            <p>
              If you have questions or concerns about this Privacy Policy or how we handle your
              data, please contact:
            </p>
            <address className="mt-2 not-italic">
              <strong>Provenance</strong>
              <br />
              Email:{' '}
              <a
                href="mailto:privacy@provenance.guru"
                className="text-primary underline underline-offset-4"
              >
                privacy@provenance.guru
              </a>
            </address>
          </section>

        </div>
      </div>
    </div>
  );
}

export default withI18n(PrivacyPolicyPage);
