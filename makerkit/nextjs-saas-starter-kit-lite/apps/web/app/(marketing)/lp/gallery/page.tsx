import type { Metadata } from 'next';

import { PERSONA_LANDING_PAGES } from '../_components/persona-landing-data';
import { buildPersonaLandingMetadata } from '../_components/persona-landing-seo';
import { PersonaLandingView } from '../_components/persona-landing-view';

export function generateMetadata(): Metadata {
  return buildPersonaLandingMetadata('gallery');
}

export default function GalleryPersonaLandingPage() {
  return <PersonaLandingView config={PERSONA_LANDING_PAGES.gallery} />;
}
