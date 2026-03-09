import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Account settings | Provenance',
};

export default function SettingsPage() {
  // Keep this route for backwards compatibility but immediately send users to the Portal
  // so `/settings` is no longer a standalone page.
  redirect('/portal');
}

