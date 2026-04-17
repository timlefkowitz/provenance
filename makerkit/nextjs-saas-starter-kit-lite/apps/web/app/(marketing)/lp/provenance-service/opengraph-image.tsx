import { renderPersonaOpenGraphImage, PERSONA_OG_SIZE } from '../_components/render-persona-og';

export const alt =
  'Provenance as a service — end-to-end research, documentation, and institutional-grade diligence';
export const size = PERSONA_OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return renderPersonaOpenGraphImage({
    roleLine: 'Provenance, built end-to-end',
    tagline:
      'Research, outreach, and defensible documentation—the rigor collectors and marketplaces expect.',
  });
}
