/**
 * Video Recorder utility — handles video + audio recording and upload.
 * Uses MediaRecorder API to capture candidate's camera and microphone.
 */

export class VideoRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.startTime = null;
  }

  /**
   * Start recording video and audio from user's camera and microphone.
   * Returns Promise that resolves when stream is ready.
   */
  async start() {
    try {
      // Get both video and audio streams
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Create MediaRecorder with supported mime type
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

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
      console.error('Failed to start recording:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Stop recording and return Blob of recorded video.
   */
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

          // Stop all tracks
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

  /**
   * Get a supported video mime type for the browser.
   */
  getSupportedMimeType() {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return ''; // Browser will use default
  }

  /**
   * Check if recording is currently active.
   */
  getIsRecording() {
    return this.isRecording;
  }

  /**
   * Get duration of current recording in milliseconds.
   */
  getDuration() {
    if (!this.isRecording || !this.startTime) {
      return 0;
    }
    return Date.now() - this.startTime;
  }
}

export default VideoRecorder;
