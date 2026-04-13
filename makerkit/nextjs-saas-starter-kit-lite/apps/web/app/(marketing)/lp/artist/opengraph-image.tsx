import { renderPersonaOpenGraphImage, PERSONA_OG_SIZE } from '../_components/render-persona-og';

export const alt =
  'Provenance for artists — certificates of authenticity, studio CRM, and grant discovery';
export const size = PERSONA_OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return renderPersonaOpenGraphImage({
    roleLine: 'Built for artists & studios',
    tagline: 'Certificates of authenticity, sales pipeline, and grant signal in one place.',
  });
}
