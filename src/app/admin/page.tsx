import Link from 'next/link';
import { requireAdmin } from '~/lib/admin';
import { FeaturedArtworksManager } from './_components/featured-artworks-manager';
import { AdminAnalytics } from './_components/admin-analytics';
import { AdminUserAnalytics } from './_components/admin-user-analytics';
// import { FixArtistNamesButton } from './_components/fix-artist-names-button';
// import { FixGalleryNamesButton } from './_components/fix-gallery-names-button';
// import { LinkArtworksToExhibitionButton } from './_components/link-artworks-to-exhibition-button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Button } from '@kit/ui/button';

export const metadata = {
  title: 'Admin | Provenance',
};

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Admin
        </h1>
        <p className="text-ink/70 font-serif">
          Manage site content, analytics, and featured entries.
        </p>
      </div>

      <div className="flex flex-col space-y-4">
        <AdminAnalytics />

        <AdminUserAnalytics />

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="font-display text-xl text-wine">Feedback tickets</CardTitle>
              <CardDescription className="font-serif">
                Triage user-submitted bugs, ideas, and questions from /feedback. Anonymous tickets supported.
              </CardDescription>
            </div>
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0 w-full sm:w-auto"
            >
              <Link href="/admin/feedback">View tickets</Link>
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="font-display text-xl text-wine">About page</CardTitle>
              <CardDescription className="font-serif">
                Edit the content of the about page. Changes are saved to a file and do not affect the database.
              </CardDescription>
            </div>
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0 w-full sm:w-auto"
            >
              <Link href="/admin/about">Edit about page</Link>
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="font-display text-xl text-wine">Pitch deck</CardTitle>
              <CardDescription className="font-serif">
                Edit the pitch deck slides using markdown. Changes are saved to a file and do not affect the database.
              </CardDescription>
            </div>
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0 w-full sm:w-auto"
            >
              <Link href="/admin/pitch">Edit pitch deck</Link>
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="font-display text-xl text-wine">Blog</CardTitle>
              <CardDescription className="font-serif">
                Write public SEO posts at /blog. Set byline to the author name shown on each article.
              </CardDescription>
            </div>
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0 w-full sm:w-auto"
            >
              <Link href="/admin/blog">Manage blog</Link>
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="font-display text-xl text-wine">Email templates</CardTitle>
              <CardDescription className="font-serif">
                Edit transactional emails (Markdown), colors, and masthead text.
              </CardDescription>
            </div>
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0 w-full sm:w-auto"
            >
              <Link href="/admin/emails">Edit emails</Link>
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="font-display text-xl text-wine">User access</CardTitle>
              <CardDescription className="font-serif">
                Grant or revoke complimentary subscription access for support and partnerships.
              </CardDescription>
            </div>
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0 w-full sm:w-auto"
            >
              <Link href="/admin/users">Manage user access</Link>
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="font-display text-xl text-wine">Verification API keys</CardTitle>
              <CardDescription className="font-serif">
                Create Bearer tokens for the Provenance verification API (integrations, tooling).
              </CardDescription>
            </div>
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0 w-full sm:w-auto"
            >
              <Link href="/admin/api-keys">Manage API keys</Link>
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="font-display text-xl text-wine">Queued artworks</CardTitle>
              <CardDescription className="font-serif">
                View verified artworks that are available to be featured on the homepage.
              </CardDescription>
            </div>
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0 w-full sm:w-auto"
            >
              <Link href="/admin/queued-artworks">View queued artworks</Link>
            </Button>
          </CardHeader>
        </Card>

        <FeaturedArtworksManager />

        {/* Maintenance tools hidden for now — re-enable: FixArtistNamesButton, FixGalleryNamesButton, LinkArtworksToExhibitionButton */}
        {/* <FixArtistNamesButton /> */}
        {/* <FixGalleryNamesButton /> */}
        {/* <LinkArtworksToExhibitionButton /> */}
      </div>
    </div>
  );
}
