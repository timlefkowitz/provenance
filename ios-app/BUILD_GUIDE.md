# Provenance iOS — Build & Submission Guide

This is a step-by-step runbook covering every manual action needed to build,
test, and submit the Provenance native iOS app. Code-side tasks (Capacitor
config, RevenueCat webhook, Apple IAP client, account deletion) are already
done on the `ios-wrapper` branch.

**Architecture recap:** Capacitor wraps `https://provenance.guru` in a native
WKWebView using remote-server mode. There is no static export — the app loads
the live server. This means every Next.js Server Action, API route, and
middleware continues to work exactly as on the web.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Mac with macOS 14 or later | Required for Xcode 16 |
| Xcode 16+ | Install from the Mac App Store |
| CocoaPods | `sudo gem install cocoapods` or `brew install cocoapods` |
| Node.js 20+ and pnpm | Already installed if you're running the dev server |
| Apple Developer account | You've already paid — log in at developer.apple.com |

---

## Part 1 — Apple Developer Portal Setup

### 1.1 Register the App ID

1. Go to [Identifiers](https://developer.apple.com/account/resources/identifiers/list).
2. Click **+** → **App IDs** → **App**.
3. Fill in:
   - **Description:** `Provenance`
   - **Bundle ID (Explicit):** `guru.provenance.app`
4. Enable these **Capabilities**:
   - **Push Notifications**
   - **Sign In with Apple** ← already configured in Supabase; enable here too
   - **Associated Domains** (for deep linking back from Stripe Checkout web pages)
5. Click **Continue** → **Register**.

### 1.2 Generate a Push Notification Key (APNs)

Only if you plan to send push notifications at launch.

1. Go to [Keys](https://developer.apple.com/account/resources/authkeys/list).
2. Click **+**, enter name `Provenance Push Key`.
3. Enable **Apple Push Notifications service (APNs)**.
4. Click **Continue → Register**.
5. **Download the `.p8` file** (you can only download it once — store it safely).
6. Note the **Key ID** and your **Team ID** (shown in top-right of developer.apple.com).

### 1.3 Create Distribution Certificate (if you don't have one)

Xcode usually handles this automatically under "Automatically manage signing."
If asked to create a Distribution certificate manually:

1. Go to [Certificates](https://developer.apple.com/account/resources/certificates/list).
2. Click **+** → **Apple Distribution**.
3. Follow the Certificate Signing Request wizard (Keychain Access → Certificate Assistant).

---

## Part 2 — RevenueCat + App Store Connect IAP Products

### 2.1 Create subscription products in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **My Apps**.
2. Click **+** → **New App** → fill in:
   - Platform: **iOS**
   - Name: **Provenance**
   - Bundle ID: select `guru.provenance.app`
   - SKU: `provenance-ios`
3. In the app page, go to **In-App Purchases** → **Manage** → **+**.
4. Create **Auto-Renewable Subscription** products — one subscription **group** called `Provenance Plans`, then these 6 products:

| Product ID | Display Name | Price Tier |
|---|---|---|
| `com.provenance.app.artist.monthly` | Artist Monthly | Tier 1 ($0.99 US) → adjust to $10.99 (Tier ~11) |
| `com.provenance.app.artist.yearly` | Artist Yearly | $99.99 (Tier ~100) |
| `com.provenance.app.collector.monthly` | Collector Monthly | ~$29.99 (Tier ~30) |
| `com.provenance.app.collector.yearly` | Collector Yearly | $299.99 |
| `com.provenance.app.gallery.monthly` | Gallery Monthly | $99.99 |
| `com.provenance.app.gallery.yearly` | Gallery Yearly | $990.00 (Tier 1000 or Custom) |

For each product: add a **Localization** (English US) with a display name and
description matching `ios-app/AppStoreMetadata.md`.

5. In each subscription's **Review Information**, set:
   - Review screenshot: a screenshot showing the plan selection UI.
   - Review notes: "User selects plan, taps Subscribe with Apple, and completes purchase through the native IAP sheet."

### 2.2 Create a RevenueCat project

1. Sign up / log in at [RevenueCat](https://app.revenuecat.com).
2. Create a new **Project**: name `Provenance`.
3. Under **Apps**, add an **iOS** app:
   - Bundle ID: `guru.provenance.app`
   - Connect to App Store Connect using an **App Store Connect API key**
     (App Store Connect → Users → Keys → generate a new one with **Admin** role).
4. Under **Entitlements**, create 3 entitlements:
   - `provenance_artist`
   - `provenance_collector`
   - `provenance_gallery`
5. Under **Products**, add all 6 product IDs from step 2.1 and attach each to its entitlement.
6. Under **Offerings** → **default offering**, add 6 packages (or 2 per role).
7. Under **Project Settings → Webhooks**, create a webhook pointing at:
   ```
   https://provenance.guru/api/webhooks/revenuecat
   ```
   Copy the **Shared Secret** that RevenueCat generates.

### 2.3 Set environment variables

Add these to your Vercel project (Settings → Environment Variables):

| Variable | Where to find it | Exposed to client? |
|---|---|---|
| `NEXT_PUBLIC_REVENUECAT_API_KEY_IOS` | RevenueCat → Project Settings → API Keys → Public iOS key | Yes (NEXT_PUBLIC_) |
| `REVENUECAT_API_KEY_SECRET` | RevenueCat → Project Settings → API Keys → Secret key | No |
| `REVENUECAT_WEBHOOK_SECRET` | RevenueCat → Webhooks → Shared Secret | No |

---

## Part 2b — Apple Pay for Stripe Marketplace Checkout

Artwork and domain purchases use Stripe Checkout (physical/real-world goods
exception, Guideline 3.1.3(a)). On the native app these now open in
**SFSafariViewController** — a full browser context where Apple Pay works.

### 2b.1 Enable Apple Pay in Stripe Dashboard

1. Go to [Stripe Dashboard → Settings → Payment methods](https://dashboard.stripe.com/settings/payment_methods).
2. Turn on **Apple Pay**.
3. Stripe automatically handles the Apple Pay domain verification for
   `checkout.stripe.com` (hosted Checkout pages). No manual domain
   registration needed.

### 2b.2 Verify Stripe Checkout sessions use automatic payment methods

The existing checkout session creation in `src/app/api/stripe/create-artwork-checkout-session/route.ts`
and `src/app/api/stripe/create-domain-checkout-session/route.ts` do **not**
specify `payment_method_types`, which means Stripe uses the Dashboard's
configured payment methods automatically (including Apple Pay). No code change
is needed; just enabling Apple Pay in the Dashboard is sufficient.

---

## Part 3 — Build the Native App (Xcode)

### 3.1 Generate the iOS project (one-time)

From the repo root, run:

```bash
pnpm ios:add
```

This runs `npx cap add ios`, which:
- Creates the `ios/` directory with a full Xcode project.
- Copies Capacitor plugins into the native project.
- **Does not** build or export the web app (we use remote server mode).

### 3.2 Sync plugins and config

Run this any time you add or update a Capacitor plugin (including after the
`@capacitor/browser` addition — already done):

```bash
pnpm ios:sync
```

### 3.2a Add the In-App Purchase capability in Xcode

**Required** before sandbox or production IAP purchases work.

1. Open Xcode: `pnpm ios:open`
2. Select the **App** project → **App** target → **Signing & Capabilities**.
3. Click **+ Capability** → search for **In-App Purchase** → double-click to add.
4. Verify: the entitlements file (`App.entitlements`) now includes
   `com.apple.developer.in-app-payments` (Xcode creates this automatically).

Without this capability RevenueCat's `purchasePackage` will return a
`STORE_PROBLEM` error at runtime.

### 3.3 Copy Info.plist additions

1. Open `ios/App/App/Info.plist` in a text editor (or Xcode's plist editor).
2. Copy the key-value pairs from `ios-app/Info.plist.additions` into the root `<dict>`.

### 3.4 Add the app icon

1. Open Xcode: `pnpm ios:open`
2. In the Project Navigator, select **App → App → Assets.xcassets → AppIcon**.
3. Drag `ios-app/icon-1024.png` onto the `App Store` slot (1024×1024).
4. Xcode generates all required icon sizes automatically.

A draft icon (`ios-app/icon-1024.png`) has been generated with Provenance's
parchment and wine branding. Replace it with your final artwork before
submitting.

### 3.5 Configure signing in Xcode

1. Select the **App** project at the top of the Project Navigator.
2. Select the **App** target → **Signing & Capabilities**.
3. Check **Automatically manage signing**.
4. Select your **Team** (your Apple Developer account).
5. The Bundle Identifier should read `guru.provenance.app` (from `capacitor.config.ts`).

### 3.6 Add Push Notifications capability

In **Signing & Capabilities**:
1. Click **+ Capability**.
2. Add **Push Notifications**.
3. Add **Background Modes** → check **Remote notifications**.

### 3.7 Test in Simulator

1. Choose a simulator (e.g. iPhone 16 Pro).
2. Press **Cmd+R** (or click ▶).
3. The app opens and loads `https://provenance.guru` in the WKWebView.
4. Verify:
   - [ ] Sign in with Apple works (tap "Continue with Apple")
   - [ ] Email/password sign-in works
   - [ ] Artworks page loads and camera prompt appears when adding art
   - [ ] Subscription page shows "Subscribe with Apple" button (not Stripe)
   - [ ] Tapping "Subscribe with Apple" → plan sheet appears (use Sandbox account)
   - [ ] Stripe-powered artwork purchases open in Safari (not in-app purchase)
   - [ ] Settings → Account Actions → Delete My Account flow works

### 3.8 Test on a physical iPhone

1. Connect iPhone via USB.
2. **Settings → General → VPN & Device Management** → trust your developer certificate if prompted.
3. Select your device in Xcode → press ▶.
4. Test Face ID / biometric prompt if applicable.

### 3.9 Test IAP in Sandbox

1. In App Store Connect → Users → Sandbox Testers, create a test Apple ID.
2. On your iPhone: **Settings → App Store** → scroll to **Sandbox Account**, sign in.
3. Run the app and attempt a subscription purchase. Sandbox purchases are free.
4. Verify the RevenueCat webhook fires at `provenance.guru/api/webhooks/revenuecat`
   (check Vercel logs) and the `subscriptions` table gets an `apple_iap` row.
5. Test "Restore previous purchases" too.

---

## Part 4 — App Store Connect Submission

### 4.1 Archive the app

1. In Xcode, select **Any iOS Device** (not a simulator) as the target.
2. **Product → Archive**.
3. Wait for the archive to build. It appears in **Window → Organizer**.

### 4.2 Distribute to App Store

1. In Organizer, select the archive → **Distribute App**.
2. Choose **App Store Connect** → **Upload** → **Next**.
3. Leave all defaults → **Upload**.
4. Wait a few minutes; it appears in App Store Connect → TestFlight.

### 4.3 Fill in App Store Connect listing

In App Store Connect → My Apps → Provenance → **iOS App → 1.0 Prepare for Submission**:

- Copy all content from `ios-app/AppStoreMetadata.md`.
- Fill in every `TODO(you):` field.
- Upload screenshots (see metadata doc for required sizes).
- Set the Privacy Policy URL, Terms of Use URL.
- Under **Age Rating** wizard → answer the content questionnaire.
- Under **In-App Purchases** → attach the 6 subscription products from Part 2.

### 4.4 Submit for Review

1. Set **Version Release** to "Manually release this version" (safer for first submission).
2. Click **Add for Review** → **Submit to App Review**.
3. Apple reviews in 1–3 business days for most first submissions.

### 4.5 Common first-submission rejection reasons (and fixes)

| Rejection | Fix |
|---|---|
| Guideline 2.1 — App Completeness | Ensure demo account is valid and all features work |
| Guideline 3.1.1 — In-App Purchase | Subscription plans must use Apple IAP (already done) |
| Guideline 4.8 — Sign In with Apple | Configured in Supabase + code — verify it works in sandbox |
| Guideline 5.1.1(v) — Account Deletion | Delete account flow added to Settings (already done) |
| Missing privacy strings | Add Info.plist entries from `ios-app/Info.plist.additions` |
| Metadata rejection | Check screenshot sizes match requirements exactly |

---

## Environment Variables Summary

Add all of these to Vercel before deploying the production build:

```
# RevenueCat
NEXT_PUBLIC_REVENUECAT_API_KEY_IOS=  # RevenueCat iOS public key
REVENUECAT_API_KEY_SECRET=           # RevenueCat server secret key
REVENUECAT_WEBHOOK_SECRET=           # RevenueCat webhook shared secret
```

---

## Useful Commands

```bash
# One-time: generate the Xcode project
pnpm ios:add

# After any plugin/config change: sync to native project
pnpm ios:sync

# Open in Xcode
pnpm ios:open

# Run on connected device (debug build)
pnpm ios:run
```

---

## File Map

| File | Purpose |
|---|---|
| `capacitor.config.ts` | Capacitor configuration (remote server mode) |
| `www/index.html` | Minimal splash placeholder (never shown to user) |
| `ios/` | Generated Xcode project (created by `pnpm ios:add`) |
| `ios-app/AppStoreMetadata.md` | App Store listing copy and screenshot checklist |
| `ios-app/Info.plist.additions` | Permission usage strings to add to Info.plist |
| `ios-app/icon-1024.png` | Draft 1024×1024 app icon |
| `ios-app/BUILD_GUIDE.md` | This file |
| `src/lib/capacitor/is-native.ts` | Platform detection helper |
| `src/lib/capacitor/revenuecat-config.ts` | Product ID → role mapping + API key helpers |
| `src/lib/capacitor/open-external-checkout.ts` | Opens Stripe checkout in SFSafariViewController on native (Apple Pay) |
| `src/components/native-init.tsx` | RevenueCat SDK init + auth state tracking |
| `src/app/api/webhooks/revenuecat/route.ts` | RevenueCat webhook → subscriptions table |
| `src/app/subscription/_actions/sync-apple-entitlement.ts` | Eager post-purchase sync |
| `src/app/subscription/_components/subscription-content.tsx` | IAP branch for native |
| `src/app/settings/_actions/delete-account.ts` | Account deletion (Guideline 5.1.1(v)) |
| `makerkit/.../migrations/20260805000000_subscriptions_apple_iap.sql` | DB migration |
