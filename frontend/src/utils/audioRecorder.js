/**
 * Audio Recorder utility — handles audio recording for candidate answers.
 * Uses MediaRecorder API to capture candidate's microphone audio.
 */

export class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.startTime = null;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.recordedChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      return { success: true };
    } catch (error) {
      console.error('[AudioRecorder] Failed to start:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async stop() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('No active recording'));
      }

      this.mediaRecorder.addEventListener(
        'stop',
        () => {
          const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType });
          this.isRecording = false;

          // Stop all audio tracks
          if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
          }

          resolve({
            blob,
            duration: Date.now() - this.startTime,
            mimeType: this.mediaRecorder.mimeType,
          });
        },
        { once: true }
      );

      this.mediaRecorder.stop();
    });
  }

  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return ''; // default
  }

  getIsRecording() {
    return this.isRecording;
  }

  /** The live MediaStream while recording — for AudioVisualizer's AnalyserNode, so it taps the same getUserMedia grant instead of requesting a second one. */
  getStream() {
    return this.stream;
  }
}

export default AudioRecorder;
