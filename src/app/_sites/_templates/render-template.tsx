import type { ComponentType } from 'react';
import type { SiteData, TemplateId } from '../types';
import { EditorialTemplate } from './editorial';
import { StudioTemplate } from './studio';
import { AtelierTemplate } from './atelier';
import { WhitecubeTemplate } from './whitecube';
import { VitrineTemplate } from './vitrine';
import { SalonTemplate } from './salon';
import { PavilionTemplate } from './pavilion';
import { CabinetTemplate } from './cabinet';
import { FolioTemplate } from './folio';
import { IndexTemplate } from './index-template';
import { ConcreteTemplate } from './concrete';
import { LightboxTemplate } from './lightbox';
import { NoirTemplate } from './noir';
import { ManifestoTemplate } from './manifesto';
import { BillboardTemplate } from './billboard';
import { ShopfrontTemplate } from './shopfront';
import { PosterTemplate } from './poster';
import { AnnumTemplate } from './annum';
import { ChronicleTemplate } from './chronicle';
import { LedgerTemplate } from './ledger';
import { BroadsideTemplate } from './broadside';
import { MarginaliaTemplate } from './marginalia';
import { SiteArtworkRuntimeProvider } from '../_components/site-artwork-runtime';
import { ArtworkQuickViewModal } from '../_components/artwork-quick-view-modal';
import { ArtworkLightbox } from '../_components/artwork-lightbox';
import { resolveAccent } from './palette';

type TemplateComponent = ComponentType<{ site: SiteData }>;

const TEMPLATE_COMPONENTS: Record<TemplateId, TemplateComponent> = {
  editorial: EditorialTemplate,
  studio: StudioTemplate,
  atelier: AtelierTemplate,
  whitecube: WhitecubeTemplate,
  vitrine: VitrineTemplate,
  salon: SalonTemplate,
  pavilion: PavilionTemplate,
  cabinet: CabinetTemplate,
  folio: FolioTemplate,
  index: IndexTemplate,
  concrete: ConcreteTemplate,
  lightbox: LightboxTemplate,
  noir: NoirTemplate,
  manifesto: ManifestoTemplate,
  billboard: BillboardTemplate,
  shopfront: ShopfrontTemplate,
  poster: PosterTemplate,
  annum: AnnumTemplate,
  chronicle: ChronicleTemplate,
  ledger: LedgerTemplate,
  broadside: BroadsideTemplate,
  marginalia: MarginaliaTemplate,
};

export function renderSiteTemplate(site: SiteData) {
  const Component = TEMPLATE_COMPONENTS[site.template_id] ?? StudioTemplate;
  const accentColor = resolveAccent(site.theme.accent);

  return (
    <SiteArtworkRuntimeProvider
      clickBehavior={site.artwork_click_behavior ?? 'page'}
      artworks={site.artworks}
      accentColor={accentColor}
      sellingEnabled={site.selling_enabled ?? false}
    >
      <Component site={site} />
      {site.artwork_click_behavior === 'modal' && <ArtworkQuickViewModal />}
      {site.artwork_click_behavior === 'lightbox' && <ArtworkLightbox />}
    </SiteArtworkRuntimeProvider>
  );
}
