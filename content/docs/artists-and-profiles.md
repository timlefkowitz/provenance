# Artists & profiles

Public profiles are how artists and galleries present themselves on Provenance and in the artist registry.

## The registry

Browse artists and galleries at `/registry` (also linked as **Artists** in the nav). Each profile shows:

- Name, bio, and location
- Medium and practice area
- Recent works
- Link to their creator website

Public profile URLs follow the pattern `/artists/[id]`.

## Creating a profile

1. Go to `/profiles` and click **New profile**.
2. Choose **Artist** or **Gallery** type.
3. Fill in name, bio, medium, location, and profile image.
4. Optionally use the **Taco** AI chat assistant at `/profiles/new/chat` to build your profile conversationally.

You can manage multiple profiles from one account — useful for artists who also run a gallery.

## Editing profiles

Edit any profile at `/profiles/[id]/edit`. Changes sync to your public registry page and creator website.

## Artist CV

Artists can maintain a structured CV at `/artists/[id]/cv`. The CV feeds into the grants assistant for matching funding opportunities.

## Gallery profiles

Gallery profiles work like artist profiles but include:

- Represented artists list
- Exhibition history
- Team member management

Gallery URLs also resolve via `/gallery/[slug]`.

## Profile claims

When a gallery represents an artist, the artist must **claim** or approve the relationship:

1. Gallery creates or links an artist profile.
2. Artist receives a claim request at `/profiles/claims`.
3. Artist approves — the gallery can then manage artworks on their behalf.

This protects artists from unauthorized representation.

## Gallery team members

Gallery owners can invite team members with specific permissions. Manage team at `/settings` or from the profile editor. Team members can access CRM, artworks, and operations based on their role.
