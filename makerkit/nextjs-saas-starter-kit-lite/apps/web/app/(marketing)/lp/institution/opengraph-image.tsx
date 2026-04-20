import { renderPersonaOpenGraphImage, PERSONA_OG_SIZE } from '../_components/render-persona-og';

export const alt =
  'Provenance for institutions — collection management, unified certificates, and verification APIs';
export const size = PERSONA_OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return renderPersonaOpenGraphImage({
    roleLine: 'Built for institutions',
    tagline: 'Certificates, collection ops, and provenance transfers in one place.',
  });
}
