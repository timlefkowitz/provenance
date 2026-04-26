#!/bin/bash

# Provenance iOS App Setup Script
# This script sets up the iOS project for Capacitor

set -e

echo "=================================="
echo "Provenance iOS App Setup"
echo "=================================="
echo ""

# Check for required tools
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "Error: pnpm is not installed"
    exit 1
fi

if ! command -v xcodebuild &> /dev/null; then
    echo "Error: Xcode is not installed"
    echo "Please install Xcode from the App Store"
    exit 1
fi

echo "All prerequisites met!"
echo ""

# Install Capacitor dependencies
echo "Installing Capacitor dependencies..."
pnpm add -D @capacitor/cli @capacitor/core
pnpm add @capacitor/ios @capacitor/camera @capacitor/push-notifications @capacitor/haptics @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard @capacitor/app @capacitor/preferences

echo ""
echo "Initializing Capacitor iOS project..."

# Initialize iOS project if it doesn't exist
if [ ! -d "ios" ]; then
    npx cap add ios
    echo "iOS project created!"
else
    echo "iOS project already exists, syncing..."
fi

# Build the web app for iOS
echo ""
echo "Building web app for iOS..."
pnpm ios:build

# Sync with iOS project
echo ""
echo "Syncing with iOS project..."
npx cap sync ios

echo ""
echo "=================================="
echo "Setup Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Sign up for an Apple Developer account at https://developer.apple.com"
echo "2. Open Xcode: pnpm ios:open"
echo "3. Configure signing in Xcode (Team, Bundle ID)"
echo "4. Update the Bundle ID to match your App Store Connect entry"
echo "5. Build and test on a simulator or device"
echo "6. Archive and submit to App Store Connect"
echo ""
echo "Useful commands:"
echo "  pnpm ios:open     - Open project in Xcode"
echo "  pnpm ios:run      - Run on connected device/simulator"
echo "  pnpm ios:prepare  - Build web + sync iOS"
echo ""
