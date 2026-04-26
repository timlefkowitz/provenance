# Provenance iOS App - Build Guide

Complete guide to building and submitting the Provenance iOS app to the App Store.

---

## Prerequisites

1. **Mac with Xcode 15+** installed from the App Store
2. **Apple Developer Account** ($99/year) - [Enroll here](https://developer.apple.com/programs/enroll/)
3. **Node.js 18+** and **pnpm** installed
4. **CocoaPods** (will be installed automatically)

---

## Step 1: Apple Developer Setup

### Create Developer Account
1. Go to [developer.apple.com](https://developer.apple.com)
2. Click "Account" and sign in with your Apple ID
3. Enroll in the Apple Developer Program ($99/year)
4. Wait for enrollment approval (usually within 48 hours)

### Create App ID
1. Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)
2. Click the "+" button to add a new identifier
3. Select "App IDs" and continue
4. Enter:
   - Description: `Provenance`
   - Bundle ID: `com.provenance.app` (or your preferred ID)
5. Enable Capabilities:
   - Push Notifications
   - Associated Domains (for deep linking)
6. Click "Continue" then "Register"

### Create Push Notification Key (APNs)
1. Go to [Keys](https://developer.apple.com/account/resources/authkeys/list)
2. Click "+" to create a new key
3. Enter key name: `Provenance Push Key`
4. Enable "Apple Push Notifications service (APNs)"
5. Click "Continue" then "Register"
6. **Download the key file** (you can only download it once!)
7. Note the Key ID for your backend configuration

---

## Step 2: Local Project Setup

### Install Dependencies
```bash
# Clone the repository (if not already done)
cd provenance

# Install all dependencies including Capacitor
chmod +x scripts/setup-ios.sh
./scripts/setup-ios.sh
```

### Configure Environment
Create/update `.env.local` with your production values:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
# Add any other required environment variables
```

---

## Step 3: Build the App

### Build Web Assets
```bash
pnpm ios:prepare
```

This command:
1. Builds your Next.js app with static export
2. Syncs the output to the iOS project

### Open in Xcode
```bash
pnpm ios:open
```

---

## Step 4: Configure Xcode

### Set Up Signing
1. In Xcode, select the "App" project in the navigator
2. Select the "App" target
3. Go to "Signing & Capabilities" tab
4. Check "Automatically manage signing"
5. Select your Team (your Apple Developer account)
6. Xcode will create provisioning profiles automatically

### Update Bundle Identifier
1. In "Signing & Capabilities", update Bundle Identifier to match your App ID
2. Example: `com.yourcompany.provenance`

### Add Capabilities
1. Click "+ Capability"
2. Add:
   - Push Notifications
   - Background Modes (check "Remote notifications")

### Update Info.plist
The setup script should have configured this, but verify:
1. Open `ios/App/App/Info.plist`
2. Ensure camera and photo library usage descriptions are present
3. Reference `ios-config/Info.plist.additions` for required entries

### Configure App Icons
1. Open `ios/App/App/Assets.xcassets`
2. Select "AppIcon"
3. Drag your 1024x1024 icon from `public/icons/icon-1024x1024.jpg`
4. Xcode will generate all required sizes

---

## Step 5: Test the App

### Run on Simulator
1. In Xcode, select a simulator (e.g., iPhone 15 Pro)
2. Press Cmd+R or click the Play button
3. Test all features:
   - Authentication flow
   - Camera capture
   - Push notification permission prompt
   - Offline functionality

### Run on Physical Device
1. Connect your iPhone via USB
2. Select your device in Xcode's device picker
3. Click Play to build and run
4. Trust the developer certificate on your iPhone if prompted:
   - Settings > General > VPN & Device Management

---

## Step 6: Prepare for App Store

### Create App Store Connect Entry
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click "My Apps" > "+" > "New App"
3. Fill in:
   - Platform: iOS
   - Name: Provenance
   - Primary Language: English
   - Bundle ID: (select the one you created)
   - SKU: `provenance-ios-001`
4. Click "Create"

### Upload App Information
1. Add App Store metadata from `ios-config/AppStoreMetadata.md`
2. Upload screenshots for required device sizes
3. Set age rating
4. Add privacy policy URL

### Create Archive
1. In Xcode, select "Any iOS Device (arm64)" as the destination
2. Go to Product > Archive
3. Wait for the archive to complete

### Upload to App Store Connect
1. When archive completes, the Organizer window opens
2. Select your archive
3. Click "Distribute App"
4. Select "App Store Connect"
5. Follow the prompts to upload

---

## Step 7: Submit for Review

1. In App Store Connect, go to your app
2. Click on the version under "iOS App"
3. Select the build you uploaded
4. Add release notes
5. Answer export compliance questions
6. Click "Submit for Review"

Review typically takes 24-48 hours.

---

## Updating the App

When you need to release updates:

```bash
# Make your code changes
# Update version in package.json

# Rebuild and sync
pnpm ios:prepare

# Open Xcode
pnpm ios:open

# Update version/build number in Xcode
# Archive and upload
```

---

## Troubleshooting

### Build Fails
- Run `pnpm ios:sync` to re-sync
- Clean build folder: Xcode > Product > Clean Build Folder
- Delete `ios/App/Pods` and run `pod install` in `ios/App/`

### Signing Issues
- Ensure Apple Developer membership is active
- Check certificate in Keychain Access
- Try revoking and recreating certificates in Developer portal

### Push Notifications Not Working
- Verify APNs key is configured
- Check entitlements include push notifications
- Test with a physical device (simulators don't receive real pushes)

### Camera Not Working
- Check Info.plist has camera usage description
- Test on physical device (simulator camera is limited)

---

## Support

For issues specific to this iOS implementation, check:
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor iOS Guide](https://capacitorjs.com/docs/ios)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
