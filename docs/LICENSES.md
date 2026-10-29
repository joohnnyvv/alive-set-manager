# Dependency licensing

The project is ISC. Direct runtime dependencies are MIT. AbletonJS 4.1.0 and its bundled Python Remote Script use the same MIT notice, including Leo Bernard’s copyright. Attribution and license inclusion are required; prominent advertising or a permanent UI logo is not.

`npm run prepare:resources` derives the runtime inventory from the lockfile, reads installed license/notice files, and adds frontend fonts, Electron and the embedded RtMidi notice. It fails on unreviewed licenses or missing texts. qrcode-generator publishes an MIT source header but no standalone license file; the generator preserves that header and supplies the standard MIT text with its original copyright.

Outputs: `resources/THIRD_PARTY_NOTICES.txt`, `resources/sbom.json` (CycloneDX), the matching AbletonJS folder including LICENSE, and Chromium’s full license HTML. Packaged Help exposes the notices; release jobs attach per-platform inventories and notices. Electron’s own distribution notices are retained.

Fonts: DM Sans, DM Mono and DM Serif Display use SIL OFL 1.1. Fontsource packages are build inputs; their font files and OFL notices are distributed in the frontend. Build-only Vite/Lightning CSS/caniuse-lite are excluded and checked in packaged archives. The complete development lockfile also contains licenses such as MPL-2.0 and CC-BY-4.0; they must not be mistaken for shipped runtime code.

The inventory records exact package versions and notice hashes. Review new dependencies and changes to vendored native components manually; automatic metadata checks do not replace inspection of final distribution contents. Do not remove Chromium notices or treat every file under an MIT npm package as automatically covered without checking bundled components.

The UUID override for AbletonJS uses the compatible named `v4` export from patched uuid 11.1.1. Keep the protocol/script pairing unchanged unless testing an intentional AbletonJS upgrade.
