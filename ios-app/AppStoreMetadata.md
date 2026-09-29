# Provenance — App Store Metadata

Paste this content into App Store Connect when creating your app listing.
Fields marked `TODO(you):` require information only you can provide.

---

## App Information

| Field                  | Value                  |
| ---------------------- | ---------------------- |
| **App Name**           | Provenance             |
| **Subtitle**           | Art Collection Journal |
| **Bundle ID**          | `guru.provenance.app`  |
| **Primary Category**   | Utilities              |
| **Secondary Category** | Productivity           |
| **Content Rating**     | 13+ (see Version & Rating) |
| **Primary Language**   | English (U.S.)         |

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

• Scan Any Certificate
Point your camera at a Provenance certificate's QR code to open its record
instantly, and share certificates through the iOS share sheet.

• Private & Secure
Your collection remains private by default. Share only what you choose,
when you choose — and lock the app with Face ID.

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

_(100 char limit total, comma-separated, no spaces after commas in App Store Connect. "Art," "collection," and "provenance" are deliberately omitted — Apple already indexes words in the App Name and Subtitle, so repeating them wastes keyword budget.)_

---

## What's New in This Version

```
Initial release of Provenance for iOS. Document your collection, capture provenance, and verify ownership history.
```

---

## App Privacy (Privacy Nutrition Labels)

Configure these in App Store Connect under "App Privacy":

### Data Linked to You

| Data Type        | Category     | Use                                                              |
| ---------------- | ------------ | ---------------------------------------------------------------- |
| Email address    | Contact Info | Account creation and authentication                              |
| Name             | Contact Info | User profile display                                             |
| Photos / Videos  | User Content | Artwork documentation                                            |
| Precise Location | Location     | Optional QR certificate-scan location shown to the artwork owner |
| User ID          | Identifiers  | Account management                                               |

### Data Used to Track You

**None.** The iOS app does not load advertising, Google Tag Manager, or
third-party analytics scripts. Photos and optional precise location are used
only for the app's artwork-documentation and certificate-scan features; they
are not used for tracking, advertising, or shared with data brokers.

### App Store Connect checklist

For the iOS build, uncheck **Tracking** for **Photos or Videos** and
**Precise Location**. Do not select any data type under **Data Used to Track
You**. Keep those two data types under **Data Linked to You** only if you
continue to collect them for the first-party features described above.

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

| Device                          | Resolution     | Notes                            |
| ------------------------------- | -------------- | -------------------------------- |
| iPhone 6.9" (iPhone 16 Pro Max) | 1320 × 2868 px | **Required**                     |
| iPhone 6.7" (iPhone 15 Pro Max) | 1290 × 2796 px | Required                         |
| iPhone 6.5" (iPhone 11 Pro Max) | 1242 × 2688 px | Required                         |
| iPad Pro 13" (M4)               | 2064 × 2752 px | Required if submitting universal |
| iPad Pro 12.9" (3rd gen)        | 2048 × 2732 px | Required if submitting universal |

**Recommended screenshot subjects:**

1. Collection overview (artwork grid / portfolio page)
2. Artwork detail with provenance timeline
3. Provenance certificate / COA
4. Grant / Toolbox screen (artists)
5. Camera / artwork upload flow
6. Certificate QR scanner
7. Face ID App Lock screen

_Take screenshots in Simulator: Xcode → Window → Devices and Simulators → pick device → Screenshots._

---

## App Icon

| Spec   | Details                                                         |
| ------ | --------------------------------------------------------------- |
| Size   | 1024 × 1024 px                                                  |
| Format | PNG, no transparency, no rounded corners (iOS applies rounding) |
| File   | `ios-app/icon-1024.png` ← **TODO(you): add your icon here**     |

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

As submitted with 1.1 (8) on 2026-09-29. Demo sign-in (App Review Information): appreview-expired@provenance.guru, expired Collector subscription; password is only in App Store Connect.

```
DEMO ACCOUNT (expired subscription, per your Sept 27 request): appreview-expired@provenance.guru, password in Sign-In Information above. Its Collector subscription expired Sept 21, 2026. After sign-in open Settings > Subscription & Billing > View Plans & Subscribe: the page shows the expired plan and the full Apple In-App Purchase flow (plan picker, StoreKit prices, auto-renew terms, Terms/Privacy links, Restore Purchases). The account has sample items, so collection and certificate features are visible immediately.

NEW IN THIS BUILD (native iPhone/iPad features):
- Certificate scanner: More tab > Scan a certificate opens a native QR scanner; scanning any Provenance certificate code opens that certificate.
- Push notifications (optional): after sign-in the app explains them before the iOS prompt; "Not now" works. They mirror the in-app Notifications list.
- Camera: Add (+) > Take Photo opens the iOS camera.
- Share: any certificate > Share > Share... opens the iOS share sheet.
- App Lock: Settings > Security > App Lock requires Face ID or the passcode on open (off by default).
- Offline screen with Retry when there's no connection.

PRIVACY: no tracking; ads, Google Tag Manager and third-party analytics are disabled in the iOS app. Photos are used only for documentation; location only for the optional certificate-scan feature.

USER-GENERATED CONTENT (1.2): every artwork, collectible, profile and exhibition has a ⋯ menu to report it or block its owner. Blocked users' content is hidden everywhere (manage in Settings > Privacy). Reports are reviewed within 24 hours; objectionable text is filtered before publishing. Terms state zero tolerance for objectionable content.

AI (5.1.2(i)): AI tools (Taco assistant, grants assistants, profile setup chat, CV/checklist import, press search, valuations) ask for explicit permission before any data is sent to OpenAI; withdraw in Settings > Privacy. Everything else works without it.

ACCOUNT DELETION: Settings > Account Actions > Delete Account.

SUBSCRIPTIONS: Apple In-App Purchase only (Artist, Collector, Gallery; monthly or yearly). Each has a 14-day free trial as an Apple introductory offer, shown with the price after the trial. Artwork sales use Stripe because they are physical goods (3.1.3(e)); buying a custom domain is not offered in the iOS app.

WHAT IT DOES: artists, collectors and galleries catalog artworks and collectibles with photos, condition reports and ownership/exhibition history, then issue certificates of authenticity with a scannable verification code for galleries, insurers or buyers. Artists also get a hosted website and a curated grants/open-calls list; galleries get exhibition management and an artist roster. Certificates are documentation tools, not a guarantee of authenticity or value.

EXTERNAL SERVICES: Supabase (auth, database), Apple IAP, Stripe (artwork sales only), OpenAI (only with permission), Resend (email), BigDataCloud (place names from photo coordinates), Apple Push Notification service.

Tested on iPhone 17 (iOS 26.6); supports iPhone and iPad. No region-gated features.
```

---

## Support & Contact

| Field             | Value                              |
| ----------------- | ---------------------------------- |
| **Support URL**   | `https://www.provenance.guru/docs` |
| **Marketing URL** | `https://www.provenance.guru`      |
| **Contact Email** | `privacy@provenance.guru`          |

_(The Support URL page links a contact email and the feedback form, which covers guidelines 1.2 and 1.5.)_

---

## Version & Rating

| Field            | Value                                     |
| ---------------- | ----------------------------------------- |
| **Version**      | 1.0.0                                     |
| **Build**        | (set by Xcode)                            |
| **Copyright**    | `© 2026 Provenance Guru, Inc.`            |
| **Age Rating**   | 13+ (questionnaire answers below)         |
| **Availability** | All territories (or restrict as needed)   |
| **Price**        | Free (in-app purchases for subscriptions) |

**Age rating (App Store Connect → App Information → Age Ratings)** — set
2026-09-29. Calculated 13+ (16+ Brazil, 15+ Korea). Saved answers:

| Question | Answer | Why |
| --- | --- | --- |
| Parental controls, age assurance | No | |
| Unrestricted web access | No | WebView is limited to provenance.guru and sign-in pages |
| User-generated content | Yes | Public profiles, artworks, collectibles, exhibitions |
| Social media | Yes | Public artworks feed and registry |
| Social media disabled for under-13s | No | |
| Messaging and chat | No | No user-to-user messaging (Taco is an AI assistant) |
| Advertising | No | No ads or paid promotion; iOS app loads no ad scripts |
| Sexual content or nudity | Infrequent | Some uploaded artworks include nudes |
| Mature themes, medical, violence, gambling, contests, loot boxes | None / No | |

**App Privacy labels** (published 2026-09-14, reviewed 2026-09-29, no changes
needed): no tracking. Linked to you: name, email, phone, physical address,
emails/text messages, photos/videos, customer support, other user content,
user ID, purchase history, product interaction. Not linked: precise and coarse
location (certificate scans store location without the scanner's user ID).
