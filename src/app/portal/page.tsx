import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { getUnreadNotificationCount } from '~/lib/notifications';
import { getUserProfiles } from '../profiles/_actions/get-user-profiles';
import { ArtworkCard } from '../artworks/_components/artwork-card';
import { getProvenanceUpdateRequestsForOwner } from '../artworks/[id]/_actions/get-provenance-update-requests';
import { ProvenanceUpdateRequestsList } from './_components/provenance-update-requests-list';
import { getFavoriteArtworks, getFavoriteCount } from '../artworks/_actions/favorites';
import { User, Image as ImageIcon, Bell, ExternalLink, Building2, Heart } from 'lucide-react';
import { USER_ROLES } from '~/lib/user-roles';

export const metadata = {
  title: 'Portal | Provenance',
};

export default async function PortalPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Get account data
  const { data: account } = await client
    .from('accounts')
    .select('id, name, picture_url, public_data')
    .eq('id', user.id)
    .single();

  // Get user's artworks count and recent artworks (admin client bypasses RLS so "Your Artworks" shows correctly)
  let artworksCount: number | null = null;
  let recentArtworks: any[] | null = null;
  try {
    const admin = getSupabaseServerAdminClient();
    const [countRes, recentRes] = await Promise.all([
      admin.from('artworks').select('*', { count: 'exact', head: true }).eq('account_id', user.id),
      admin
        .from('artworks')
        .select('id, title, artist_name, image_url, created_at, certificate_number, account_id, is_public, status')
        .eq('account_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);
    artworksCount = countRes.count ?? null;
    recentArtworks = recentRes.data ?? null;
  } catch {
    const [countRes, recentRes] = await Promise.all([
      (client as any).from('artworks').select('*', { count: 'exact', head: true }).eq('account_id', user.id),
      (client as any)
        .from('artworks')
        .select('id, title, artist_name, image_url, created_at, certificate_number, account_id, is_public, status')
        .eq('account_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);
    artworksCount = countRes.count ?? null;
    recentArtworks = recentRes.data ?? null;
  }

  // Get users they're following
  const { data: followingData } = await client
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false })
    .limit(12);

  // Get account details for followed users
  const followingIds = followingData?.map((f: any) => f.following_id) || [];
  let following: Array<{ following_id: string; accounts: { id: string; name: string; picture_url: string | null } }> = [];
  
  if (followingIds.length > 0) {
    const { data: accounts } = await client
      .from('accounts')
      .select('id, name, picture_url')
      .in('id', followingIds);
    
    following = (accounts || []).map(account => ({
      following_id: account.id,
      accounts: account,
    }));
  }

  // Get recent notifications (prioritize unread)
  const { data: allNotifications } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Get unread notifications first, then read ones
  const unreadNotifications = (allNotifications || []).filter((n: any) => !n.read);
  const readNotifications = (allNotifications || []).filter((n: any) => n.read);
  const notifications = [...unreadNotifications, ...readNotifications].slice(0, 10);

  const unreadCount = await getUnreadNotificationCount(user.id);

  // Get favorites
  const favoriteArtworks = await getFavoriteArtworks(6);
  const favoriteCount = await getFavoriteCount();

  // Check if user has a gallery profile
  const profiles = await getUserProfiles(user.id);
  const hasGalleryProfile = profiles.some(p => p.role === USER_ROLES.GALLERY);
  const userRole = (account?.public_data as any)?.role;
  const isGallery = userRole === USER_ROLES.GALLERY;

  // Get provenance update requests for artworks owned by this user
  const provenanceUpdateRequests = await getProvenanceUpdateRequestsForOwner();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Your Portal
        </h1>
        <p className="text-ink/70 font-serif">
          Welcome back, {account?.name || 'User'}
        </p>
      </div>

      {/* Gallery Profile Prompt */}
      {isGallery && !hasGalleryProfile && (
        <Card className="mb-8 border-wine/30 bg-wine/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Building2 className="h-8 w-8 text-wine" />
                <div>
                  <h3 className="font-display font-bold text-wine text-lg mb-1">
                    Create Your Gallery Profile
                  </h3>
                  <p className="text-ink/70 font-serif text-sm">
                    Set up your gallery profile to showcase exhibitions and connect with artists.
                  </p>
                </div>
              </div>
              <Button
                asChild
                className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              >
                <Link href="/profiles/new?role=gallery">
                  Create Profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-wine/20 bg-parchment/60">
          <CardContent className="p-6">
            <Link href="/artworks/my" className="block">
              <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
                <div>
                  <p className="text-sm text-ink/60 font-serif mb-1">Your Artworks</p>
                  <p className="text-3xl font-display font-bold text-wine">
                    {artworksCount || 0}
                  </p>
                </div>
                <ImageIcon className="h-8 w-8 text-wine/50" />
              </div>
            </Link>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mt-4 font-serif text-wine hover:text-wine/80"
            >
              <Link href="/artworks/add">Add Artwork →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-wine/20 bg-parchment/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink/60 font-serif mb-1">Following</p>
                <p className="text-3xl font-display font-bold text-wine">
                  {following?.length || 0}
                </p>
              </div>
              <User className="h-8 w-8 text-wine/50" />
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mt-4 font-serif text-wine hover:text-wine/80"
            >
              <Link href="/registry">Discover Artists →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-wine/20 bg-parchment/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink/60 font-serif mb-1">Favorites</p>
                <p className="text-3xl font-display font-bold text-wine">
                  {favoriteCount}
                </p>
              </div>
              <Heart className="h-8 w-8 text-wine/50" />
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mt-4 font-serif text-wine hover:text-wine/80"
            >
              <Link href="/artworks">View All →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-wine/20 bg-parchment/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink/60 font-serif mb-1">Notifications</p>
                <p className="text-3xl font-display font-bold text-wine">
                  {unreadCount}
                  {unreadCount > 0 && (
                    <span className="text-sm text-ink/60 font-serif ml-1">unread</span>
                  )}
                </p>
              </div>
              <Bell className="h-8 w-8 text-wine/50" />
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mt-4 font-serif text-wine hover:text-wine/80"
            >
              <Link href="/notifications">View All →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Favorites */}
        <Card className="border-wine/20 bg-parchment/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-xl text-wine">
                Your Favorites
              </CardTitle>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="font-serif"
              >
                <Link href="/artworks">
                  View All
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {favoriteArtworks && favoriteArtworks.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {favoriteArtworks.map((artwork: any) => (
                  <ArtworkCard
                    key={artwork.id}
                    artwork={artwork}
                    currentUserId={user.id}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Heart className="h-12 w-12 text-wine/30 mx-auto mb-4" />
                <p className="text-ink/60 font-serif mb-4">
                  You haven't favorited any artworks yet
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="font-serif border-wine/30 hover:bg-wine/10"
                >
                  <Link href="/artworks">Discover Artworks</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Artworks */}
        <Card className="border-wine/20 bg-parchment/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-xl text-wine">
                Your Recent Artworks
              </CardTitle>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="font-serif"
              >
                <Link href="/artworks/add">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Add New
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentArtworks && recentArtworks.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {recentArtworks.map((artwork: any) => (
                  <ArtworkCard
                    key={artwork.id}
                    artwork={artwork}
                    currentUserId={user.id}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-ink/60 font-serif mb-4">
                  You haven't added any artworks yet
                </p>
                <Button
                  asChild
                  className="bg-wine text-parchment hover:bg-wine/90 font-serif"
                >
                  <Link href="/artworks/add">Add Your First Artwork</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Following */}
        <Card className="border-wine/20 bg-parchment/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-xl text-wine">
                Artists You Follow
              </CardTitle>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="font-serif"
              >
                <Link href="/registry">Discover More →</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {following && following.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {following.map((follow: any) => {
                  const artist = follow.accounts;
                  if (!artist) return null;
                  
                  return (
                    <Link
                      key={follow.following_id}
                      href={`/artists/${artist.id}`}
                      className="group"
                    >
                      <div className="flex flex-col items-center text-center p-3 border border-wine/10 rounded-md hover:bg-wine/5 transition-colors">
                        <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-wine/20 bg-wine/10 mb-2">
                          {artist.picture_url ? (
                            <Image
                              src={artist.picture_url}
                              alt={artist.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-xl font-display font-bold text-wine uppercase">
                                {artist.name?.charAt(0) || '?'}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-serif text-ink line-clamp-2 group-hover:text-wine transition-colors">
                          {artist.name}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-ink/60 font-serif mb-4">
                  You're not following anyone yet
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="font-serif border-wine/30 hover:bg-wine/10"
                >
                  <Link href="/registry">Discover Artists</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provenance Update Requests */}
      <ProvenanceUpdateRequestsList requests={provenanceUpdateRequests} />

      {/* Recent Notifications */}
      <Card className="mt-8 border-wine/20 bg-parchment/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-xl text-wine">
              Recent Notifications
            </CardTitle>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="font-serif"
            >
              <Link href="/notifications">
                View All
                <ExternalLink className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {notifications && notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.slice(0, 5).map((notification: any) => (
                <Link
                  key={notification.id}
                  href={notification.artwork_id ? `/artworks/${notification.artwork_id}` : '/notifications'}
                  className="block p-4 border border-wine/10 rounded-md hover:bg-wine/5 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                      notification.read ? 'bg-wine/20' : 'bg-wine'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-serif text-sm ${
                        notification.read ? 'text-ink/70' : 'text-ink font-semibold'
                      }`}>
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="text-xs text-ink/60 font-serif mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-ink/40 font-serif mt-2">
                        {new Date(notification.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-ink/60 font-serif">
                No notifications yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

