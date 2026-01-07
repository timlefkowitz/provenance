import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Artists | Provenance',
};

export default function ArtistsIndexPage() {
  // For now, reuse the Registry as the main artist directory.
  redirect('/registry');
}


