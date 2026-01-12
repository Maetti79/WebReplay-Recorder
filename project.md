You’re basically building **“Loom + deterministic web-replay + editable timeline”**. The critical design choice is: **capture events in a way that can be reliably replayed later**, even if the DOM changes a bit, and let the user **edit timing + narration** before generating the final MP4.

Below is a practical architecture and a storyboard format that will actually work.

---

## 1) High-level architecture

### A) Browser Extension (recording + interactive storyboard editor)

**Responsibilities**

* Record: screen/tab, mic, optional webcam
* Capture: mouse + keyboard intent **as semantic actions** (click this element, type into this input, upload this file)
* Build: **Storyboard JSON** (timeline of events + audio segments + metadata)
* Provide: a timeline UI to adjust:

  * pauses between actions
  * typing speed
  * cursor smoothing level
  * “wait for selector / wait for navigation” rules
  * audio alignment (“make screen wait until this sentence ends”)

**Chrome APIs**

* `chrome.tabCapture` or `getDisplayMedia` (tab/window capture)
* `MediaRecorder` (audio/video/webcam)
* Content script to listen for interactions and resolve element selectors
* `chrome.scripting` to inject content scripts
* `chrome.storage` for drafts

### B) Replay/Render Engine (local app or server worker)

You *can* replay inside the extension, but generating clean MP4 reliably is much easier with a render engine:

* Headless browser automation: **Playwright** (recommended) or Puppeteer
* It loads the site, replays the actions, renders video frames, and muxes audio.
* Produces MP4 via **ffmpeg**.

**Why not only extension for MP4?**

* Extensions can record what you do, but “replaying + recording again” is fragile, and MP4 encoding control is limited.
* A render engine can generate consistent results: resolution, fps, cursor overlay, smooth motion, stable timings.

---

## 2) What to record (don’t record raw mouse coordinates only)

Raw mouse coords will break on different screen sizes, responsive layouts, or minor DOM shifts.

Record each interaction as:

* **target** = robust element locator
* **action** = click / type / select / scroll / drag / upload / wait
* **timing** = when it happens, plus optional constraints
* **context** = viewport size, url, device emulation, zoom, etc.

### Robust element locator strategy (use multiple fallbacks)

For each target element, store:

* best CSS selector you can generate
* text hint (button label)
* attributes hint (name/id/aria-label/placeholder)
* DOM path fingerprint (limited depth)
* bounding box at record time (for sanity)

At replay time, resolve with a priority order:

1. stable attributes (`data-testid`, `aria-label`, `name`, `id`)
2. text-based match (“Submit”, “Continue”)
3. CSS path fallback
4. visual/bounding-box fallback (last resort)

---

## 3) Storyboard file format (practical JSON)

This is a **timeline** with tracks: browser actions, audio, webcam (optional), overlays.

### Example: `storyboard.json`

```json
{
  "version": "1.0",
  "meta": {
    "title": "Demo walkthrough",
    "createdAt": "2026-01-09T20:30:00Z",
    "viewport": { "width": 1440, "height": 900, "deviceScaleFactor": 1 },
    "baseUrl": "https://example.com",
    "locale": "en-US"
  },
  "assets": {
    "micWav": "audio/mic.wav",
    "ttsMp3": "audio/tts.mp3",
    "webcamMp4": "video/webcam.mp4",
    "uploads": [
      { "id": "file1", "path": "uploads/sample.pdf", "sha256": "..." }
    ]
  },
  "settings": {
    "cursor": {
      "visible": true,
      "style": "mac",
      "smooth": 0.85,
      "minMoveDurationMs": 120,
      "maxSpeedPxPerSec": 1600
    },
    "typing": {
      "charsPerSec": 12,
      "randomize": 0.15,
      "pasteLongTextOver": 80
    },
    "render": {
      "fps": 60,
      "resolution": { "width": 1920, "height": 1080 }
    }
  },
  "timeline": [
    {
      "t": 0,
      "type": "navigate",
      "url": "https://example.com/login",
      "waitFor": { "type": "selector", "value": "input[name='email']" }
    },
    {
      "t": 1200,
      "type": "click",
      "target": {
        "selectors": [
          "input[name='email']",
          "input[placeholder*='Email']"
        ],
        "textHint": null
      }
    },
    {
      "t": 1600,
      "type": "type",
      "target": { "selectors": ["input[name='email']"] },
      "text": "demo@example.com",
      "typing": { "charsPerSec": 10 }
    },
    {
      "t": 3200,
      "type": "click",
      "target": {
        "selectors": ["button[type='submit']"],
        "textHint": "Sign in"
      },
      "waitFor": { "type": "navigation", "timeoutMs": 15000 }
    },
    {
      "t": 6500,
      "type": "upload",
      "target": { "selectors": ["input[type='file']"] },
      "fileRef": "file1"
    },
    {
      "t": 9000,
      "type": "pause",
      "durationMs": 2000,
      "reason": "Let narration finish"
    }
  ],
  "audioTrack": [
    {
      "t": 0,
      "type": "voice",
      "source": "micWav",
      "gainDb": 0
    },
    {
      "t": 0,
      "type": "tts",
      "source": "ttsMp3",
      "gainDb": -2
    }
  ]
}
```

### Why this format works

* Every event has a scheduled time `t`, but you can also support **relative** timing (“after previous + 500ms”).
* The editor can do simple operations: stretch a segment, insert pauses, adjust typing speed, etc.
* Replay engine can convert this into Playwright actions deterministically.

---

## 4) Recording details (extension)

### Mouse recording

Record:

* click target selector bundle (as above)
* click type (left/right/dbl)
* optional: scroll events as “scroll to element” or “scroll by”
  Avoid storing full mouse movement as raw points. Instead:
* store **key cursor positions** (before click, after click, during highlight)
* generate smooth movement in replay with bezier/easing

### Keyboard recording

Record *intent*, not raw keycodes:

* for input fields: store final text + insertion method (typed/paste)
* for shortcuts: store as explicit action (e.g., “press Enter”)
* for navigation keys: explicit “press Tab x2”, etc.

### File uploads

You can’t access the user’s filesystem freely at replay time in an automated browser unless you supply the file from the engine side.
So:

* store file as an asset (or request re-link at render time)
* store sha256 to detect changes

### Voice recording + STT + TTS (ElevenLabs)

Pipeline:

1. record mic to `wav` (or webm/opus then convert)
2. STT → transcript with timestamps (word or sentence-level)
3. user edits text
4. ElevenLabs TTS → mp3
5. align timeline: optionally auto-insert pauses so actions don’t outrun narration

Key feature: **“Narration locks”**

* timeline marker like: “do not proceed past event #12 until audio timecode 00:00:32.400”.

---

## 5) Replay + MP4 generation

**Replay engine steps**

1. Launch Playwright with target viewport + device emulation
2. Navigate + wait conditions (selectors/network idle/navigation)
3. For each event:

   * move cursor to element (smooth)
   * click/type/upload/scroll
   * wait rules
4. Render frames:

   * easiest reliable approach: record the browser viewport to frames (or video) while replay runs
   * overlay cursor (and optional click ripple) during rendering
5. Mux audio (mic or TTS) + video into MP4 with ffmpeg

**Cursor smoothing**

* generate cursor path with:

  * ease-in/out
  * minimum duration clamp (so it doesn’t teleport)
  * max speed clamp
* allow per-event overrides in storyboard

**Typing speed control**

* implement “human typing” with jitter
* for long text: switch to “paste” (instant) or “fast type” after N chars

---

## 6) Storyboard editor (what users will actually want)

Minimum editor capabilities that unlock 80% value:

* timeline view with draggable event blocks
* per-event controls:

  * delay before event
  * cursor speed/smoothness
  * typing speed
  * wait condition (selector visible / enabled / network idle / fixed time)
* audio track with waveform
* “snap events to audio” button:

  * auto-insert pause blocks when narration runs longer than actions
* “regenerate TTS” button after text edits
* validation warnings:

  * “selector not stable”
  * “upload file missing”
  * “event occurs before page loaded”

---

## 7) MVP plan (fastest path to something shippable)

### MVP 1: Recorder + Storyboard JSON

* record click + type + navigate + scroll
* mic recording
* export storyboard JSON + audio file

### MVP 2: Editor

* timeline adjustments
* typing speed, pause insertion, wait-for-selector

### MVP 3: Renderer

* Playwright replay + ffmpeg mp4 output
* cursor overlay + smoothing

### MVP 4: Webcam + picture-in-picture

* optional webcam track in corner
* simple layout presets

---

## 8) Two big “gotchas” you should design for now

1. **Privacy / sensitive data**

* typed passwords: record as “masked” and require manual re-entry or token-based login flow for demos
* allow “redaction zones” (blur rectangle) or “blur selectors” (blur this element)

2. **Replay reliability**

* dynamic apps change selectors; build a “selector health score”
* encourage developers to add `data-testid` / `data-demo-id` attributes for rock-solid targeting

