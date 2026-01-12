# WebReplay MVP - Changelog

All notable changes to this project will be documented in this file.

---

## [1.0.2] - 2026-01-09

### Added
- Environment variable support for ElevenLabs API key
  - Created `.env.example` template file
  - Added `dotenv` package dependency
  - Updated `tts.js` to automatically load from `.env`
- MIT LICENSE file in project root
- Comprehensive SETUP.md guide with troubleshooting
- `.gitignore` file to protect sensitive data (.env, node_modules, etc.)
- CHANGELOG.md (this file)
- TEST_PLAN.md and QUICK_TEST.md for validation

### Fixed
- **Critical #1:** "Could not establish connection. Receiving end does not exist." error
  - Added `ensureContentScript()` function in background.js
  - Automatically injects content script if not present on the page
  - Provides helpful error messages for restricted pages
- **Critical #2:** "Cannot read properties of undefined (reading 'success')" download error
  - Rewrote DOWNLOAD_STORYBOARD handler using async IIFE pattern
  - Now properly handles async operations with sendResponse
  - Added better error handling in popup.js
- **Critical #3:** "URL.createObjectURL is not a function" error (Manifest V3 service worker issue)
  - Replaced URL.createObjectURL with FileReader.readAsDataURL
  - Converted all blobs to data URLs before download
  - Downloads now work in service worker context
- **Critical #4:** "Cannot read properties of undefined (reading 'download')" error
  - Added missing "downloads" permission to manifest.json
  - Permission was documented but not actually present in manifest
  - **IMPORTANT:** Users must reload extension to apply new permission

### Changed
- Version bumped to 1.0.2 in manifest.json
- Added "downloads" permission to manifest.json
- Updated PROJECT_IMPROVEMENTS.md with new changes
- Improved error messages throughout the extension
- Download handler completely rewritten for service worker compatibility

### ⚠️ Breaking Changes / Action Required
- **Extension must be reloaded** in chrome://extensions/ for permissions to take effect
- Chrome may prompt to approve new "downloads" permission
- After reload, all download functionality will work

---

## [1.0.1] - 2026-01-09

### Added
- Delete recordings feature
  - Delete button (🗑️) in popup UI next to each recording
  - Confirmation dialog ("This cannot be undone")
  - Complete cleanup from all storage locations:
    - In-memory `storyboards` object
    - `chrome.storage.local`
    - IndexedDB (audio recordings)
    - IndexedDB (webcam recordings)
  - Automatic lastRecordingId cleanup
- Comprehensive quality audit documentation
- PROJECT_IMPROVEMENTS.md document

### Changed
- Updated popup.js with delete functionality
- Enhanced background.js with DELETE_RECORDING handler
- Improved documentation with quality metrics

---

## [1.0.0] - 2026-01-09 - Initial Release

### Added - Core Features

#### Browser Extension
- Event capture (clicks, typing, navigation, scrolling)
- Robust selector generation with multiple fallbacks
- Audio recording with configurable settings
- Webcam recording with 5 position presets
- Settings panel with persistent preferences
- IndexedDB storage for recordings
- Service worker architecture (Manifest V3)

#### Timeline Editor
- Visual timeline with drag-and-drop
- Property editing panel
- Multi-track layout (navigation, interaction, input, control)
- Playback preview with timing controls
- Zoom and navigation controls
- Event management (add, edit, delete)

#### Replay Engine
- Playwright-based deterministic replay
- Smooth cursor animation with cubic easing
- Human-like typing simulation
- Video recording at 60fps, 1080p
- Webcam picture-in-picture overlay
- CLI validation and info tools

#### TTS Integration
- ElevenLabs API integration
- Voice selection and preview
- Auto-generated narration from events
- Custom narration scripts
- Timeline-synced audio
- Cost estimation

### Documentation
- README.md - Main documentation
- QUICKSTART.md - 5-minute setup
- NEW_FEATURES.md - Feature overview
- WEBCAM_CONFIG.md - Configuration guide
- TESTING_GUIDE.md - Test suite
- QUICK_REFERENCE.md - Command cheatsheet
- STRUCTURE.md - Architecture details
- RELEASE_NOTES.md - Version 1.0 notes
- PROJECT_COMPLETE.md - Completion report

### Examples
- test-page.html - Interactive test form
- simple-demo.json - Local demo storyboard
- example-storyboard.json - Sample recording

---

## Version History Summary

| Version | Date | Type | Description |
|---------|------|------|-------------|
| 1.0.2 | 2026-01-09 | Patch | Critical bug fixes + env config |
| 1.0.1 | 2026-01-09 | Minor | Delete feature + quality audit |
| 1.0.0 | 2026-01-09 | Major | Initial MVP release |

---

## Upgrade Instructions

### From 1.0.1 to 1.0.2

1. Pull latest changes
2. Reload the browser extension in `chrome://extensions/`
3. Install new dependencies:
   ```bash
   cd replay-engine
   npm install
   ```
4. (Optional) Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and add your ELEVENLABS_API_KEY
   ```

### From 1.0.0 to 1.0.1

1. Pull latest changes
2. Reload the browser extension in `chrome://extensions/`
3. No additional steps required

---

## Known Issues

### Current Limitations

1. **Extension Icons**
   - Placeholder icons (red dot) need professional design
   - Recommendation: Camera/video symbol with red accent
   - See SETUP.md for customization instructions

2. **Large Webcam Files**
   - Files >100MB may timeout on data URL conversion
   - Workaround: Use FFmpeg post-processing (documented in WEBCAM_CONFIG.md)

3. **Bot Detection**
   - Some sites detect Playwright automation
   - Limitation: Cannot replay on sites with aggressive bot detection
   - Recommendation: Use on sites you control or local test pages

### Planned Improvements

See PROJECT_IMPROVEMENTS.md for roadmap.

---

## Support

- **Setup Help:** See SETUP.md
- **Quick Reference:** See QUICK_REFERENCE.md
- **Testing:** See TESTING_GUIDE.md
- **Source Code:** All files are well-commented

---

## Contributors

Project developed as WebReplay MVP v1.0

---

## License

MIT License - See LICENSE file for details

---

*Last Updated: January 9, 2026*
*WebReplay MVP - Changelog*
