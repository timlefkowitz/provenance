import { renderPersonaOpenGraphImage, PERSONA_OG_SIZE } from '../_components/render-persona-og';

export const alt =
  'Provenance for institutions — audit events, certificates, and verification APIs';
export const size = PERSONA_OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return renderPersonaOpenGraphImage({
    roleLine: 'Built for institutions',
    tagline: 'Append-only events, unified certificates, and scoped API keys.',
  });
}
