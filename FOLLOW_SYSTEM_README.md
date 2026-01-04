# Follow System Implementation

## What's New

Added a follow system so users only see artworks from:
1. **Themselves** - Your own uploaded artworks
2. **Artists you follow** - Artworks from artists you've followed

## Features

### 1. Follow/Unfollow Artists
- Each artwork card now shows a "Follow" button for other artists
- Click to follow/unfollow
- Button changes to "Following" when you're already following an artist

### 2. Personalized Feed
- **Signed in**: See only your artworks + artworks from artists you follow
- **Not signed in**: See all public verified artworks (discovery mode)

### 3. Database Migration
A new `user_follows` table tracks follow relationships:
- `follower_id`: The user who is following
- `following_id`: The artist being followed
- Includes RLS policies for security

## Files Changed

### Database
- `apps/web/supabase/migrations/20250105000000_create_user_follows.sql` - New migration

### Frontend
- `apps/provenance/src/app/artworks/page.tsx` - Updated feed logic
- `apps/provenance/src/app/artworks/_components/artwork-card.tsx` - Added follow button
- `apps/provenance/src/app/artworks/_components/follow-button.tsx` - New component
- `apps/provenance/src/app/artworks/_actions/toggle-follow.ts` - Follow/unfollow action
- `apps/provenance/src/app/artworks/_actions/check-is-following.ts` - Check follow status

## Running the Migration

### Local Development
```bash
cd apps/web
pnpm supabase:reset
```

### Production (Vercel)
The migration will run automatically when you push to Supabase. Or run manually:
```bash
cd apps/web
supabase db push
```

## How It Works

1. **Artwork Feed Query**:
   - If not signed in: Show all verified artworks
   - If signed in: Query `user_follows` to get list of followed artists, then fetch artworks from those artists + your own

2. **Follow Button**:
   - Client component that checks follow status on mount
   - Toggles follow/unfollow via server action
   - Revalidates the artworks page to update the feed

3. **Security**:
   - RLS policies ensure users can only manage their own follows
   - Users can't follow themselves
   - Follow relationships are unique (can't follow the same person twice)

## Future Enhancements

Potential additions:
- Follow counts (followers/following)
- Artist profile pages showing their artworks
- Notifications when followed artists post new work
- Collections/galleries that can be followed
- Suggested artists to follow

