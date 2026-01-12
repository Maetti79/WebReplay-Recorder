// Webcam Picture-in-Picture Overlay Module

import fs from 'fs';
import path from 'path';

/**
 * Webcam overlay presets
 */
const PRESETS = {
  'bottom-right': {
    position: 'bottom-right',
    size: 0.25, // 25% of screen width
    padding: 20,
    borderRadius: 12,
    border: { width: 3, color: '#ffffff' }
  },
  'bottom-left': {
    position: 'bottom-left',
    size: 0.25,
    padding: 20,
    borderRadius: 12,
    border: { width: 3, color: '#ffffff' }
  },
  'top-right': {
    position: 'top-right',
    size: 0.2,
    padding: 20,
    borderRadius: 12,
    border: { width: 3, color: '#ffffff' }
  },
  'top-left': {
    position: 'top-left',
    size: 0.2,
    padding: 20,
    borderRadius: 12,
    border: { width: 3, color: '#ffffff' }
  },
  'sidebar-right': {
    position: 'right',
    size: 0.3,
    padding: 0,
    borderRadius: 0,
    border: null
  }
};

class WebcamOverlay {
  constructor(preset = 'bottom-right') {
    this.config = PRESETS[preset] || PRESETS['bottom-right'];
  }

  /**
   * Get CSS/overlay injection code for Playwright
   */
  getOverlayScript(webcamVideoPath, viewportWidth, viewportHeight) {
    const { position, size, padding, borderRadius, border } = this.config;

    const webcamWidth = Math.floor(viewportWidth * size);
    const webcamHeight = Math.floor(webcamWidth * (480 / 640)); // 4:3 aspect ratio

    let positionStyles = '';

    switch (position) {
      case 'bottom-right':
        positionStyles = `bottom: ${padding}px; right: ${padding}px;`;
        break;
      case 'bottom-left':
        positionStyles = `bottom: ${padding}px; left: ${padding}px;`;
        break;
      case 'top-right':
        positionStyles = `top: ${padding}px; right: ${padding}px;`;
        break;
      case 'top-left':
        positionStyles = `top: ${padding}px; left: ${padding}px;`;
        break;
      case 'right':
        positionStyles = `top: 0; right: 0; height: 100%;`;
        break;
    }

    const borderStyle = border
      ? `border: ${border.width}px solid ${border.color};`
      : '';

    return `
      (function() {
        const video = document.createElement('video');
        video.src = '${webcamVideoPath}';
        video.autoplay = true;
        video.muted = true;
        video.loop = false;

        video.style.cssText = \`
          position: fixed;
          width: ${webcamWidth}px;
          height: ${webcamHeight}px;
          ${positionStyles}
          ${borderStyle}
          border-radius: ${borderRadius}px;
          z-index: 999999;
          object-fit: cover;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        \`;

        video.id = 'webcam-overlay';

        // Wait for DOM to be ready
        if (document.body) {
          document.body.appendChild(video);
          video.play().catch(err => console.error('Webcam playback error:', err));
        } else {
          document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(video);
            video.play().catch(err => console.error('Webcam playback error:', err));
          });
        }

        console.log('[WebcamOverlay] Overlay injected');
      })();
    `;
  }

  /**
   * Inject webcam overlay into Playwright page
   */
  async injectIntoPage(page, webcamVideoUrl) {
    const viewport = page.viewportSize();
    const script = this.getOverlayScript(webcamVideoUrl, viewport.width, viewport.height);

    await page.addInitScript(script);
    console.log('[WebcamOverlay] Injected into page');
  }

  /**
   * Alternative: Use ffmpeg to composite videos (more reliable but requires post-processing)
   * This generates the ffmpeg command to overlay webcam on screen recording
   */
  generateFFmpegCommand(screenVideo, webcamVideo, outputVideo, viewportWidth = 1920, viewportHeight = 1080) {
    const { position, size, padding, borderRadius } = this.config;

    const webcamWidth = Math.floor(viewportWidth * size);
    const webcamHeight = Math.floor(webcamWidth * (480 / 640));

    let overlayX, overlayY;

    switch (position) {
      case 'bottom-right':
        overlayX = viewportWidth - webcamWidth - padding;
        overlayY = viewportHeight - webcamHeight - padding;
        break;
      case 'bottom-left':
        overlayX = padding;
        overlayY = viewportHeight - webcamHeight - padding;
        break;
      case 'top-right':
        overlayX = viewportWidth - webcamWidth - padding;
        overlayY = padding;
        break;
      case 'top-left':
        overlayX = padding;
        overlayY = padding;
        break;
      case 'right':
        overlayX = viewportWidth - webcamWidth;
        overlayY = 0;
        break;
      default:
        overlayX = viewportWidth - webcamWidth - padding;
        overlayY = viewportHeight - webcamHeight - padding;
    }

    // FFmpeg command to overlay videos
    return `ffmpeg -i "${screenVideo}" -i "${webcamVideo}" \
      -filter_complex "[1:v]scale=${webcamWidth}:${webcamHeight}[pip]; \
      [0:v][pip]overlay=${overlayX}:${overlayY}" \
      -c:a copy "${outputVideo}"`;
  }

  /**
   * Set custom configuration
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
  }
}

export { WebcamOverlay, PRESETS };
