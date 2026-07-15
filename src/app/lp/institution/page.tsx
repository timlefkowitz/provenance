import type { Metadata } from "next";

import {
  buildPersonaLandingMetadata,
  getPersonaJsonLd,
} from "../../../../makerkit/nextjs-saas-starter-kit-lite/apps/web/app/(marketing)/lp/_components/persona-landing-seo";

import { InstitutionLanding } from "./_components/institution-landing";
import { safeJsonLd } from "~/lib/safe-json-ld";

export function generateMetadata(): Metadata {
  return buildPersonaLandingMetadata("institution");
}

export default function InstitutionPersonaLandingPage() {
  const structuredData = getPersonaJsonLd("institution");

  return (
    <>
      <InstitutionLanding />
      {structuredData.map((json, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(json) }}
        />
      ))}
    </>
  );
}
