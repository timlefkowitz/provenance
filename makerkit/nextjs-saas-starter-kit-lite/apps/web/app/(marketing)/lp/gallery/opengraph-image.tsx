import { renderPersonaOpenGraphImage, PERSONA_OG_SIZE } from '../_components/render-persona-og';

export const alt =
  'Provenance for galleries — exhibitions, open calls, and roster tools';
export const size = PERSONA_OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return renderPersonaOpenGraphImage({
    roleLine: 'Built for galleries',
    tagline: 'Exhibitions, open calls, team permissions, and show certificates.',
  });
}
