#!/usr/bin/env node

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebcamOverlay } from '../lib/webcam-overlay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utility to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Easing function for smooth cursor movement
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Generate smooth cursor path between two points
function generateCursorPath(from, to, settings) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 5) {
    return [to]; // Too close, just jump
  }

  const maxSpeed = settings.maxSpeedPxPerSec || 1600;
  const minDuration = settings.minMoveDurationMs || 120;

  // Calculate duration based on distance
  let durationMs = (distance / maxSpeed) * 1000;
  durationMs = Math.max(durationMs, minDuration);

  const steps = Math.max(10, Math.floor(durationMs / 16)); // ~60fps
  const path = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const eased = easeInOutCubic(t);

    path.push({
      x: from.x + dx * eased,
      y: from.y + dy * eased,
      duration: durationMs / steps
    });
  }

  return path;
}

// Resolve element using multiple selector strategies
async function resolveElement(page, target) {
  if (!target || !target.selectors) {
    throw new Error('Invalid target: missing selectors');
  }

  // Try each selector in order
  for (const selector of target.selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        return element;
      }
    } catch (e) {
      console.warn(`Selector failed: ${selector}`, e.message);
    }
  }

  // Try text-based matching as fallback
  if (target.textHint) {
    try {
      const element = await page.locator(`text="${target.textHint}"`).first();
      if (await element.count() > 0) {
        return element;
      }
    } catch (e) {
      console.warn('Text-based selector failed');
    }
  }

  throw new Error(`Could not resolve element with selectors: ${target.selectors.join(', ')}`);
}

// Replay engine
class ReplayEngine {
  constructor(storyboard, options = {}) {
    this.storyboard = storyboard;
    this.options = options;
    this.browser = null;
    this.page = null;
    this.currentCursor = { x: 0, y: 0 };
  }

  async initialize() {
    console.log('Launching browser...');

    const viewport = this.storyboard.meta.viewport || { width: 1440, height: 900 };

    this.browser = await chromium.launch({
      headless: false, // Show browser for debugging
      args: ['--no-sandbox']
    });

    const context = await this.browser.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height
      },
      deviceScaleFactor: viewport.deviceScaleFactor || 1,
      recordVideo: this.options.recordVideo ? {
        dir: this.options.videoDir || './videos',
        size: this.storyboard.settings.render.resolution || viewport
      } : undefined
    });

    this.page = await context.newPage();

    // Enable cursor tracking
    await this.page.addInitScript(() => {
      // Create cursor element
      const cursor = document.createElement('div');
      cursor.id = 'replay-cursor';
      cursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        border: 2px solid black;
        border-radius: 50%;
        pointer-events: none;
        z-index: 999999;
        background: rgba(255, 255, 255, 0.5);
        transform: translate(-50%, -50%);
        transition: none;
      `;

      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(cursor);
      });

      // Expose function to move cursor
      window.__moveCursor = (x, y) => {
        const cursor = document.getElementById('replay-cursor');
        if (cursor) {
          cursor.style.left = x + 'px';
          cursor.style.top = y + 'px';
        }
      };
    });

    // Add webcam overlay if available
    if (this.options.webcamVideo && fs.existsSync(this.options.webcamVideo)) {
      console.log('Adding webcam overlay...');

      // Use position from options, storyboard settings, or default to bottom-right
      const webcamPosition = this.options.webcamPosition
        || this.storyboard.settings?.webcam?.position
        || 'bottom-right';

      const webcamOverlay = new WebcamOverlay(webcamPosition);

      // Serve webcam video as data URL
      const webcamBuffer = fs.readFileSync(this.options.webcamVideo);
      const webcamBase64 = webcamBuffer.toString('base64');
      const webcamDataUrl = `data:video/webm;base64,${webcamBase64}`;

      await webcamOverlay.injectIntoPage(this.page, webcamDataUrl);
      console.log('Webcam overlay added');
    }

    console.log('Browser initialized');
  }

  async moveCursorSmooth(toX, toY) {
    const settings = this.storyboard.settings.cursor;
    const path = generateCursorPath(this.currentCursor, { x: toX, y: toY }, settings);

    for (const point of path) {
      await this.page.evaluate((pos) => {
        if (window.__moveCursor) {
          window.__moveCursor(pos.x, pos.y);
        }
      }, point);

      await sleep(point.duration || 16);
      this.currentCursor = { x: point.x, y: point.y };
    }
  }

  async executeEvent(event) {
    console.log(`[${event.t}ms] Executing: ${event.type}`);

    try {
      switch (event.type) {
        case 'navigate':
          await this.page.goto(event.url, { waitUntil: 'domcontentloaded' });

          if (event.waitFor) {
            if (event.waitFor.type === 'selector') {
              await this.page.waitForSelector(event.waitFor.value, {
                timeout: event.waitFor.timeoutMs || 30000
              });
            } else if (event.waitFor.type === 'load') {
              await this.page.waitForLoadState('load');
            } else if (event.waitFor.type === 'navigation') {
              await this.page.waitForLoadState('networkidle', {
                timeout: event.waitFor.timeoutMs || 15000
              });
            }
          }
          break;

        case 'click':
          const clickElement = await resolveElement(this.page, event.target);
          const clickBox = await clickElement.boundingBox();

          if (clickBox) {
            const centerX = clickBox.x + clickBox.width / 2;
            const centerY = clickBox.y + clickBox.height / 2;

            await this.moveCursorSmooth(centerX, centerY);
            await clickElement.click();
          }

          if (event.waitFor) {
            if (event.waitFor.type === 'navigation') {
              await this.page.waitForLoadState('networkidle', {
                timeout: event.waitFor.timeoutMs || 15000
              });
            } else if (event.waitFor.type === 'selector') {
              await this.page.waitForSelector(event.waitFor.value);
            }
          }
          break;

        case 'type':
          const typeElement = await resolveElement(this.page, event.target);
          await typeElement.click(); // Focus first

          const typingSettings = event.typing || this.storyboard.settings.typing;
          const charsPerSec = typingSettings.charsPerSec || 10;

          // Type with human-like delay
          if (event.text.length > (typingSettings.pasteLongTextOver || 80)) {
            // Paste long text
            await typeElement.fill(event.text);
          } else {
            // Type character by character
            for (const char of event.text) {
              await this.page.keyboard.type(char);
              const delay = (1000 / charsPerSec) * (1 + (Math.random() - 0.5) * (typingSettings.randomize || 0.15));
              await sleep(delay);
            }
          }
          break;

        case 'keypress':
          const modifiers = event.modifiers || {};
          const keys = [];

          if (modifiers.ctrl) keys.push('Control');
          if (modifiers.alt) keys.push('Alt');
          if (modifiers.shift) keys.push('Shift');
          if (modifiers.meta) keys.push('Meta');

          for (const key of keys) {
            await this.page.keyboard.down(key);
          }

          await this.page.keyboard.press(event.key);

          for (const key of keys.reverse()) {
            await this.page.keyboard.up(key);
          }
          break;

        case 'scroll':
          await this.page.evaluate((pos) => {
            window.scrollTo(pos.x, pos.y);
          }, event.position);
          await sleep(300); // Wait for scroll to settle
          break;

        case 'pause':
          await sleep(event.durationMs || 1000);
          break;

        case 'upload':
          const fileInput = await resolveElement(this.page, event.target);
          const filePath = path.join(this.options.assetsDir || '.', event.fileRef);

          if (fs.existsSync(filePath)) {
            await fileInput.setInputFiles(filePath);
          } else {
            console.warn(`Upload file not found: ${filePath}`);
          }
          break;

        default:
          console.warn(`Unknown event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Error executing event ${event.type}:`, error.message);
      throw error;
    }
  }

  async replay() {
    console.log('Starting replay...');
    console.log(`Total events: ${this.storyboard.timeline.length}`);

    let lastTime = 0;

    for (const event of this.storyboard.timeline) {
      // Wait for scheduled time
      const waitTime = event.t - lastTime;
      if (waitTime > 0) {
        await sleep(waitTime);
      }

      await this.executeEvent(event);
      lastTime = event.t;
    }

    console.log('Replay complete!');
  }

  async close() {
    if (this.page) {
      // Wait a bit before closing to ensure video is saved
      await sleep(1000);
    }

    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node replay.js <storyboard.json> [options]');
    console.log('Options:');
    console.log('  --record-video              Record video of the replay');
    console.log('  --video-dir=DIR             Directory to save video (default: ./videos)');
    console.log('  --assets-dir=DIR            Directory containing assets (default: current dir)');
    console.log('  --webcam=FILE               Webcam video file to overlay');
    console.log('  --webcam-position=POSITION  Webcam position (bottom-right, bottom-left, top-right, top-left)');
    process.exit(1);
  }

  const storyboardPath = args[0];
  const options = {
    recordVideo: args.includes('--record-video'),
    videoDir: args.find(a => a.startsWith('--video-dir='))?.split('=')[1],
    assetsDir: args.find(a => a.startsWith('--assets-dir='))?.split('=')[1],
    webcamVideo: args.find(a => a.startsWith('--webcam='))?.split('=')[1],
    webcamPosition: args.find(a => a.startsWith('--webcam-position='))?.split('=')[1] || 'bottom-right'
  };

  // Load storyboard
  if (!fs.existsSync(storyboardPath)) {
    console.error(`Storyboard file not found: ${storyboardPath}`);
    process.exit(1);
  }

  const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf-8'));
  console.log(`Loaded storyboard: ${storyboard.meta.title}`);
  console.log(`Events: ${storyboard.timeline.length}`);

  // Create replay engine
  const engine = new ReplayEngine(storyboard, options);

  try {
    await engine.initialize();
    await engine.replay();
  } catch (error) {
    console.error('Replay failed:', error);
  } finally {
    await engine.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ReplayEngine };
