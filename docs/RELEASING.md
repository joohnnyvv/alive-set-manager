# Release procedure

1. Use Node 24 and `npm ci`. Review the changelog, license inventory and security audit. Commit the version and lockfile together; all three must match the release tag.
2. Merge through the Verify workflow. Require `Quality and browser tests`, `Package (mac-arm64)`, `Package (mac-x64)`, and `Package (win-x64)` in the `master` branch protection settings. Enable required pull requests, resolved conversations, and disallow force pushes/deletion. These protection settings were applied to the repository during alpha preparation. The workflows must still be pushed and pass. The reproducible policy is in `scripts/branch-protection.json`; local workflow files alone cannot activate repository settings.
3. Confirm Dependabot updates and security alerts are enabled in GitHub. The committed configuration schedules npm and action updates weekly.
4. Tag the reviewed master commit `v0.1.0-alpha.1` and push that tag. The tag workflow validates master ancestry and version/changelog agreement, runs verification, packages all targets, and creates a **draft prerelease**. Only the final job can write releases. Nothing is published automatically.
5. Download each draft artifact and complete `RELEASE_CHECKLIST.md`. Check the SHA256SUMS file, clean-machine installation, native MIDI, Live behavior and upgrade data preservation. Update the acceptance record in a follow-up change if needed.
6. Publish the complete draft only after required checks pass. Never replace published binaries; use a new version. A retry may replace draft assets, but the workflow refuses modifications to a published release.

The alpha uses ad-hoc macOS signing for executable integrity, not Developer ID signing or notarization. Windows is unsigned. Keep these distinctions in release notes. macOS artifacts are separate arm64/x64 DMG and ZIP files; Windows uses a per-user x64 NSIS installer.

## Signed beta gate

Before enabling installation of updates, provide protected-environment signing credentials, configure Developer ID signing and notarization on macOS and publisher signing on Windows, and require signing in release builds. Integrate electron-updater behind the desktop API; test previous-version upgrades, failed downloads/signatures, explicit restart consent and refusal while playback is active. Do not enable automatic installation in the unsigned alpha. This work is intentionally not represented as completed by the alpha release.
