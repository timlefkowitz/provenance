# Provenance — App Store Metadata

Paste this content into App Store Connect when creating your app listing.
Fields marked `TODO(you):` require information only you can provide.

---

## App Information

| Field | Value |
|---|---|
| **App Name** | Provenance |
| **Subtitle** | Art Collection Journal |
| **Bundle ID** | `guru.provenance.app` |
| **Primary Category** | Lifestyle |
| **Secondary Category** | Reference |
| **Content Rating** | 4+ |
| **Primary Language** | English (U.S.) |

---

## Promotional Text (≤ 170 chars, editable anytime without a new build)

```
Give every piece you own a permanent record: certificates, provenance, and exhibition history you can share with galleries, insurers, and buyers.
```

---

## Description

### Short Description (for Search Ads, ≤ 100 chars)
```
Track and verify your art collection's history with provenance records.
```

### Full Description (≤ 4,000 chars)

```
Provenance is your personal journal for art, objects, and their histories.
Document your collection with detailed provenance records that tell the
complete story of each piece — from creation to your hands.

FEATURES

• Document Your Collection
Catalog artworks, antiques, and collectibles with rich details including
provenance history, condition reports, and exhibition records.

• Certificates of Authenticity
Generate professional certificates and share them with galleries, insurers,
or potential buyers — each with a scannable code that verifies the record.

• Ownership History
Track the complete chain of custody from creation to your collection.
Link to galleries, auction records, and previous owners.

• Capture From Your Camera
Photograph your pieces directly from the app to document condition,
detail, and context as you build each record.

• Private & Secure
Your collection remains private by default. Share only what you choose,
when you choose.

• Valuation Research
Get AI-assisted research to help inform your understanding of a piece's
market context and value.

• Grants & Opportunities
Artists get access to a curated grants list, open calls, and residencies —
plus AI-assisted writing tools for applications.

• Hosted Artist Websites
Every paid plan includes a personal website to showcase and sell your
work, built from your profile and collection.

• Gallery Tools
Exhibition management, artist roster, CRM, and white-label website
hosting for galleries and institutions.

Whether you're a seasoned collector, gallery owner, or artist beginning
your journey, Provenance helps you understand and document the stories
behind the pieces that matter to you.
```

---

## Keywords

```
appraisal,valuation,coa,registry,estate,antiques,memorabilia,notarize,catalog,artist,collector
```

*(100 char limit total, comma-separated, no spaces after commas in App Store Connect. "Art," "collection," and "provenance" are deliberately omitted — Apple already indexes words in the App Name and Subtitle, so repeating them wastes keyword budget.)*

---

## What's New in This Version

```
Initial release of Provenance for iOS. Document your collection, capture provenance, and verify ownership history.
```

---

## App Privacy (Privacy Nutrition Labels)

Configure these in App Store Connect under "App Privacy":

### Data Linked to You
| Data Type | Category | Use |
|---|---|---|
| Email address | Contact Info | Account creation and authentication |
| Name | Contact Info | User profile display |
| Photos / Videos | User Content | Artwork documentation |
| User ID | Identifiers | Account management |

### Data Not Linked to You
| Data Type | Category | Use |
|---|---|---|
| Usage data | Usage Data | App analytics (Google Analytics / GTM) |
| Crash data | Diagnostics | Error monitoring |

### Privacy Policy URL
```
https://www.provenance.guru/privacy-policy
```

### Terms of Use URL
```
https://www.provenance.guru/terms-of-service
```

---

## Screenshots Required

Produce screenshots in Simulator (or on device) at these exact sizes:

| Device | Resolution | Notes |
|---|---|---|
| iPhone 6.9" (iPhone 16 Pro Max) | 1320 × 2868 px | **Required** |
| iPhone 6.7" (iPhone 15 Pro Max) | 1290 × 2796 px | Required |
| iPhone 6.5" (iPhone 11 Pro Max) | 1242 × 2688 px | Required |
| iPad Pro 13" (M4) | 2064 × 2752 px | Required if submitting universal |
| iPad Pro 12.9" (3rd gen) | 2048 × 2732 px | Required if submitting universal |

**Recommended screenshot subjects:**
1. Collection overview (artwork grid / portfolio page)
2. Artwork detail with provenance timeline
3. Provenance certificate / COA
4. Grant / Toolbox screen (artists)
5. Camera / artwork upload flow

*Take screenshots in Simulator: Xcode → Window → Devices and Simulators → pick device → Screenshots.*

---

## App Icon

| Spec | Details |
|---|---|
| Size | 1024 × 1024 px |
| Format | PNG, no transparency, no rounded corners (iOS applies rounding) |
| File | `ios-app/icon-1024.png` ← **TODO(you): add your icon here** |

A draft icon concept (Provenance branding, parchment + wine tones) is available at:
`public/favicon.svg` — use this as a reference for the art direction.

---

## App Review Information

### Demo Account

**Sign-up alone is not enough.** Email/password registration requires email
confirmation before the reviewer can sign in. Provide ready-to-use credentials
in App Store Connect → App Review Information so the reviewer can log in
immediately without creating an account or checking email.

```
Email:    [your dedicated review account — e.g. appreview@provenance.guru]
Password: [password]
```

Before submitting:
- Create this account and confirm the email yourself.
- Pre-populate it with 2–3 artworks so core flows are visible on first login.
- Do not enable MFA on the review account.
- In review notes, also mention that new users can sign up or use Sign in with Apple.

### Notes for Reviewer
```
Provenance is a collection management and provenance documentation tool for
artists, collectors, and galleries.

Key features shown:
1. User authentication via email/password and Sign in with Apple.
2. Photo capture for documenting artworks (camera and photo library
   permissions are requested).
3. Provenance records and certificates of authenticity (documentation
   tools; not a guarantee of authenticity or value).
4. Subscription via Apple In-App Purchase (Artist, Collector, or Gallery plans).
   The free 14-day trial allows full exploration without payment.

Payments: Artwork marketplace sales use Stripe (physical goods / person-to-person
marketplace, guideline 3.1.3(a) exception). Subscription plans use Apple IAP.
```

---

## Support & Contact

| Field | Value |
|---|---|
| **Support URL** | `https://www.provenance.guru/docs` |
| **Marketing URL** | `https://www.provenance.guru` |
| **Contact Email** | `privacy@provenance.guru` |

*(Support URL is a real user guide, not a placeholder — but it has no visible "contact support" link or email on the page. Worth adding one before submission, since reviewers sometimes check.)*

---

## Version & Rating

| Field | Value |
|---|---|
| **Version** | 1.0.0 |
| **Build** | (set by Xcode) |
| **Copyright** | `© 2026 Provenance Guru, Inc.` |
| **Age Rating** | 4+ |
| **Availability** | All territories (or restrict as needed) |
| **Price** | Free (in-app purchases for subscriptions) |
