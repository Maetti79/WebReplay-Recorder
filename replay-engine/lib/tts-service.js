// TTS Service using ElevenLabs API

import fs from 'fs';
import path from 'path';

class TTSService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
  }

  /**
   * Get available voices
   */
  async getVoices() {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.voices;
    } catch (error) {
      console.error('Failed to get voices:', error);
      throw error;
    }
  }

  /**
   * Generate speech from text
   * @param {string} text - Text to convert to speech
   * @param {object} options - TTS options
   * @returns {Buffer} Audio data
   */
  async generateSpeech(text, options = {}) {
    const {
      voiceId = 'EXAVITQu4vr4xnSDxMaL', // Sarah - expressive voice
      modelId = 'eleven_monolingual_v1',
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0,
      useSpeakerBoost = true
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: useSpeakerBoost
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`TTS API error: ${response.status} - ${error}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Failed to generate speech:', error);
      throw error;
    }
  }

  /**
   * Generate speech and save to file
   */
  async generateSpeechToFile(text, outputPath, options = {}) {
    const audioBuffer = await this.generateSpeech(text, options);
    fs.writeFileSync(outputPath, audioBuffer);
    console.log(`TTS audio saved to: ${outputPath}`);
    return outputPath;
  }

  /**
   * Get character count and estimated cost
   */
  getEstimatedCost(text, pricePerCharacter = 0.00003) {
    const characterCount = text.length;
    const estimatedCost = characterCount * pricePerCharacter;
    return {
      characters: characterCount,
      cost: estimatedCost.toFixed(4)
    };
  }

  /**
   * Process narration script and generate timeline-synced TTS
   */
  async processNarrationScript(script, outputDir = './audio') {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const segments = [];
    let currentTime = 0;

    for (let i = 0; i < script.length; i++) {
      const segment = script[i];
      const { text, voiceId, settings } = segment;

      console.log(`Generating TTS for segment ${i + 1}/${script.length}...`);

      const audioPath = path.join(outputDir, `segment_${i}.mp3`);
      await this.generateSpeechToFile(text, audioPath, {
        voiceId,
        ...settings
      });

      // Estimate duration (rough: ~150 words per minute, ~5 chars per word)
      const words = text.split(/\s+/).length;
      const durationMs = (words / 150) * 60 * 1000;

      segments.push({
        index: i,
        text,
        audioPath,
        startTime: currentTime,
        duration: durationMs
      });

      currentTime += durationMs;
    }

    return segments;
  }

  /**
   * Generate narration from storyboard events
   */
  async generateNarrationFromStoryboard(storyboard, narrationScript, outputDir = './audio') {
    const ttsSegments = [];

    for (let i = 0; i < narrationScript.length; i++) {
      const narration = narrationScript[i];
      const audioPath = path.join(outputDir, `narration_${i}.mp3`);

      await this.generateSpeechToFile(narration.text, audioPath, {
        voiceId: narration.voiceId
      });

      ttsSegments.push({
        t: narration.startTime || 0,
        type: 'tts',
        source: audioPath,
        gainDb: 0,
        text: narration.text
      });
    }

    // Add TTS to storyboard
    if (!storyboard.audioTrack) {
      storyboard.audioTrack = [];
    }

    storyboard.audioTrack.push(...ttsSegments);

    return storyboard;
  }
}

export { TTSService };
