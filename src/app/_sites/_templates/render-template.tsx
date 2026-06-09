import type { ComponentType } from 'react';
import type { SiteData, TemplateId } from '../types';
import { EditorialTemplate } from './editorial';
import { StudioTemplate } from './studio';
import { AtelierTemplate } from './atelier';
import { WhitecubeTemplate } from './whitecube';
import { VitrineTemplate } from './vitrine';
import { SalonTemplate } from './salon';
import { PavilionTemplate } from './pavilion';
import { FolioTemplate } from './folio';
import { IndexTemplate } from './index-template';
import { ConcreteTemplate } from './concrete';
import { LightboxTemplate } from './lightbox';
import { NoirTemplate } from './noir';

type TemplateComponent = ComponentType<{ site: SiteData }>;

const TEMPLATE_COMPONENTS: Record<TemplateId, TemplateComponent> = {
  editorial: EditorialTemplate,
  studio: StudioTemplate,
  atelier: AtelierTemplate,
  whitecube: WhitecubeTemplate,
  vitrine: VitrineTemplate,
  salon: SalonTemplate,
  pavilion: PavilionTemplate,
  folio: FolioTemplate,
  index: IndexTemplate,
  concrete: ConcreteTemplate,
  lightbox: LightboxTemplate,
  noir: NoirTemplate,
};

export function renderSiteTemplate(site: SiteData) {
  const Component = TEMPLATE_COMPONENTS[site.template_id] ?? StudioTemplate;
  return <Component site={site} />;
}
