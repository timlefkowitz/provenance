# User & Data Model Diagram — Provenance

This diagram shows what the **user** touches in the Provenance codebase: auth, account, profiles, artworks, exhibitions, social features, and app routes.

---

## 1. High-level: What the user uses

```mermaid
flowchart TB
    subgraph Identity["🔐 Identity & auth"]
        AUTH[auth.users]
        SESSION[Session / JWT claims]
        MFA[MFA verify]
        AUTH --> SESSION
        SESSION --> MFA
    end

    subgraph Account["👤 Account"]
        ACCOUNTS[(accounts)]
        ROLE[Role: collector / artist / gallery]
        ACCOUNTS --> ROLE
    end

    subgraph Profiles["📋 Profiles"]
        UP[user_profiles]
        GM[gallery_members]
        APC[artist_profile_claims]
    end

    subgraph Content["🖼️ Content"]
        ART[(artworks)]
        EXH[(exhibitions)]
        EXA[exhibition_artworks]
        OC[(open_calls)]
        OCS[open_call_submissions]
        EXH --> EXA
        OC --> OCS
    end

    subgraph Social["❤️ Social & engagement"]
        FAV[artwork_favorites]
        FOLLOW[user_follows]
        NOTIF[(notifications)]
    end

    subgraph Certificates["📜 Certificates & provenance"]
        CERT[Certificate of Show / Ownership / Authenticity]
        PUR[Provenance update requests]
    end

    User((User)) --> Identity
    Identity --> Account
    Account --> Profiles
    Account --> Content
    Account --> Social
    Content --> Certificates
```

---

## 2. Auth & account flow

```mermaid
flowchart LR
    subgraph Auth["Auth (Supabase)"]
        SIGNIN["/auth/sign-in"]
        SIGNUP["/auth/sign-up"]
        CALLBACK["/auth/callback"]
        VERIFY["/auth/verify"]
        RESET["/auth/password-reset"]
    end

    subgraph Account["Account"]
        ACCOUNTS[(accounts)]
        ACCOUNTS_FIELDS["id (= user id), name, email, picture_url, public_data"]
    end

    subgraph Onboarding["Onboarding"]
        ONB["/onboarding"]
        ROLE["public_data.role: collector | artist | gallery"]
    end

    SIGNIN --> CALLBACK
    SIGNUP --> CALLBACK
    CALLBACK --> ACCOUNTS
    ACCOUNTS --> ACCOUNTS_FIELDS
    ACCOUNTS --> ONB
    ONB --> ROLE
```

- **auth.users**: Supabase auth (email/password, OAuth, etc.).
- **accounts**: One row per user (`id` = `auth.users.id`). `public_data` holds `role` (and optionally `medium`, `links`, `galleries`).
- **Onboarding**: If `accounts.public_data.role` is missing, user is sent to `/onboarding` to pick a role.

---

## 3. User profiles (per-role)

```mermaid
erDiagram
    auth_users ||--o| user_profiles : "has"
    auth_users ||--o| gallery_members : "member of"
    user_profiles ||--o| artist_profile_claims : "claim"

    user_profiles {
        uuid id PK
        uuid user_id FK
        varchar role "collector | artist | gallery"
        varchar name
        text picture_url
        text bio
        varchar medium
        text location
        text website
        text[] links
        text[] galleries
        text contact_email
        text phone
        int established_year
        boolean is_active
    }

    gallery_members {
        uuid id PK
        uuid gallery_profile_id FK
        uuid user_id FK
        varchar role "owner | member"
    }

    artist_profile_claims {
        uuid id PK
        uuid artist_profile_id FK
        uuid claimant_user_id FK
        varchar status "pending | approved | rejected"
    }
```

- **user_profiles**: One profile per (user, role). Roles: collector, artist, gallery.
- **gallery_members**: Links a user to a gallery profile (owner/member).
- **artist_profile_claims**: Lets a user claim an artist profile (pending/approved/rejected).

Relevant routes: `/profiles`, `/profiles/new`, `/profiles/[id]/edit`, `/profiles/claims`.

---

## 4. Artworks & certificates

```mermaid
flowchart TB
    subgraph Artworks["Artworks"]
        ART[(artworks)]
        ART_F["account_id, title, artist_name, image_url, certificate_number, status, is_public, ..."]
        ART --> ART_F
    end

    subgraph Certs["Certificate types by role"]
        GALLERY["Gallery → Certificate of Show"]
        COLLECTOR["Collector → Certificate of Ownership"]
        ARTIST["Artist → Certificate of Authenticity"]
    end

    subgraph UserActions["User actions on artworks"]
        ADD["Add artwork(s)"]
        EDIT["Edit / edit provenance"]
        CLAIM["Claim certificate"]
        VERIFY["Verify certificate"]
        FAV["Favorite"]
        PUR["Provenance update request"]
    end

    User --> ADD
    User --> EDIT
    User --> CLAIM
    User --> VERIFY
    User --> FAV
    User --> PUR
    ADD --> ART
    EDIT --> ART
    CLAIM --> Certs
    VERIFY --> Certs
    FAV --> artwork_favorites
    PUR --> ART
```

- **artworks**: Owned by `account_id`; have status (e.g. verified), visibility (`is_public`), and certificate workflow.
- **artwork_favorites**: `(user_id, artwork_id)` for “favorite” actions.
- Certificates: type depends on poster role (gallery / collector / artist) — see `src/lib/user-roles.ts`.

Routes: `/artworks`, `/artworks/add`, `/artworks/my`, `/artworks/[id]/edit`, `/artworks/[id]/certificate`, `/artworks/edit-provenance`, `/artworks/tags`.

---

## 5. Exhibitions & open calls

```mermaid
flowchart LR
    subgraph Exhibitions["Exhibitions"]
        EXH[(exhibitions)]
        EXA[(exhibition_artworks)]
        EXART[(exhibition_artists)]
        EXH --> EXA
        EXH --> EXART
    end

    subgraph OpenCalls["Open calls"]
        OC[(open_calls)]
        OCS[(open_call_submissions)]
        OC --> OCS
    end

    User --> EXH
    User --> OC
    User --> OCS
```

- **exhibitions**: Created by gallery account; linked to artworks and artists via `exhibition_artworks` and `exhibition_artists`.
- **open_calls** / **open_call_submissions**: User submits to open calls; submissions tied to user.

Routes: `/exhibitions`, `/exhibitions/new`, `/exhibitions/[id]`, `/exhibitions/[id]/edit`; `/open-calls`, `/open-calls/[slug]`.

---

## 6. Social & notifications

```mermaid
flowchart TB
    user_follows["user_follows (follower_id, following_id)"]
    artwork_favorites["artwork_favorites (user_id, artwork_id)"]
    notifications["notifications (user_id, type, artwork_id, related_user_id, read, metadata)"]

    User --> user_follows
    User --> artwork_favorites
    User --> notifications
```

- **user_follows**: Who follows whom (e.g. follow artist/gallery profiles).
- **artwork_favorites**: Which artworks a user has favorited.
- **notifications**: In-app notifications (e.g. certificate claim, verify, favorites) — keyed by `user_id`.

Routes: `/notifications`; follow/favorite actions from artwork and profile UIs.

---

## 7. Main app routes (user-facing)

| Area | Routes |
|------|--------|
| **Auth** | `/auth/sign-in`, `/auth/sign-up`, `/auth/callback`, `/auth/verify`, `/auth/password-reset` |
| **Onboarding** | `/onboarding` |
| **Dashboard** | `/portal` |
| **Profile & settings** | `/profile`, `/settings`, `/profiles`, `/profiles/new`, `/profiles/[id]/edit`, `/profiles/claims` |
| **Artworks** | `/artworks`, `/artworks/add`, `/artworks/my`, `/artworks/[id]/edit`, `/artworks/[id]/certificate`, `/artworks/edit-provenance`, `/artworks/tags` |
| **Exhibitions** | `/exhibitions`, `/exhibitions/new`, `/exhibitions/[id]`, `/exhibitions/[id]/edit` |
| **Open calls** | `/open-calls`, `/open-calls/[slug]` |
| **Discovery** | `/registry`, `/artists`, `/artists/[id]`, `/gallery/[name]` |
| **Other** | `/notifications`, `/pitch`, `/collectibles`, `/articles`, `/about` |
| **Admin** | `/admin`, `/admin/queued-artworks`, `/admin/pitch`, `/admin/about` |

---

## 8. Hooks & server-side user access

- **useCurrentUser** (`src/hooks/use-current-user.ts`): Client hook for current user from JWT claims.
- **requireUser** (Makerkit): Server-side require session; redirects to sign-in or MFA verify.
- **OnboardingGuard** (`src/components/onboarding-guard.tsx`): Redirects to `/onboarding` if `accounts.public_data.role` is missing (with allowed paths for auth, about, artworks/add).
- **getUserProfiles** (`src/app/profiles/_actions/get-user-profiles.ts`): Loads all `user_profiles` for the current user.

---

## Summary: Data the user “uses”

| Layer | Tables / concepts |
|-------|-------------------|
| **Auth** | `auth.users`, session, JWT claims, MFA |
| **Account** | `accounts` (id, name, email, picture_url, public_data.role, etc.) |
| **Profiles** | `user_profiles`, `gallery_members`, `artist_profile_claims` |
| **Content** | `artworks`, `exhibitions`, `exhibition_artworks`, `exhibition_artists`, `open_calls`, `open_call_submissions` |
| **Engagement** | `artwork_favorites`, `user_follows`, `notifications` |
| **Workflows** | Certificates (Show / Ownership / Authenticity), provenance update requests |

All of the above are tied to the user via `auth.users.id` (or `account_id` / `user_id` in app tables).
