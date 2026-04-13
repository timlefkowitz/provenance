import { renderPersonaOpenGraphImage, PERSONA_OG_SIZE } from '../_components/render-persona-og';

export const alt =
  'Provenance for collectors — ownership certificates and defensible collection records';
export const size = PERSONA_OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return renderPersonaOpenGraphImage({
    roleLine: 'Built for collectors',
    tagline: 'Ownership certificates, auction & exhibition context, and collaborative updates.',
  });
}
