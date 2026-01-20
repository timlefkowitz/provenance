import { PitchDeck } from './_components/pitch-deck';
import { getAboutContent } from '../admin/about/_actions/about-content';
import { getPitchDeckContent } from './_actions/pitch-deck-content';
import { getCurrentUserAdminStatus } from '~/lib/admin';

export const metadata = {
  title: 'Pitch Deck | Provenance',
  description: 'Provenance pitch deck',
  robots: 'noindex, nofollow', // Hidden from search engines
};

export default async function PitchDeckPage() {
  const content = await getAboutContent();
  const bryson = content.founders.founders.find(f => f.name === 'Bryson Brooks');
  const timothy = content.founders.founders.find(f => f.name === 'Timothy Lefkowitz');

  const founderData = bryson && timothy ? {
    bryson: {
      name: bryson.name,
      role: bryson.role,
      bio: bryson.bio,
      photo_url: bryson.photo_url || '',
    },
    timothy: {
      name: timothy.name,
      role: timothy.role,
      bio: timothy.bio,
      photo_url: timothy.photo_url || '',
    },
  } : null;

  const pitchDeckContent = await getPitchDeckContent();
  const isAdmin = await getCurrentUserAdminStatus();

  return <PitchDeck founderData={founderData} initialSlides={pitchDeckContent.slides} isAdmin={isAdmin} />;
}

