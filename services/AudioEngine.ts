import { FFT_SIZE, SMOOTHING_TIME_CONSTANT } from '../constants';
import { AudioData } from '../types';

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null = null;
  
  private dataArray: Uint8Array | null = null;
  private timeArray: Uint8Array | null = null;

  constructor() {
    // Initial setup happens on user interaction due to browser policies
  }

  public init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
      
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      this.timeArray = new Uint8Array(bufferLength);
    }
  }

  public connectMicrophone = async (): Promise<void> => {
    this.init();
    if (!this.audioContext || !this.analyser) return;

    // Disconnect old source
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      // Mic goes to analyser, but NOT to gain/destination (to avoid feedback loop)
      this.sourceNode.connect(this.analyser);
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (err) {
      console.error("Error accessing microphone:", err);
      throw err;
    }
  };

  public connectAudioElement = (audioElement: HTMLAudioElement) => {
    this.init();
    if (!this.audioContext || !this.analyser || !this.gainNode) return;

    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }

    // Create source from audio element
    // Note: We need to ensure we don't create multiple sources for the same element in React strict mode
    try {
        this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
        this.sourceNode.connect(this.analyser);
        this.analyser.connect(this.gainNode);
    } catch (e) {
        // If source already exists for this element, we might need to handle it, 
        // but typically in this app structure, we manage the engine singleton carefully.
        console.warn("MediaElementSource attachment warning:", e);
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  };

  public setVolume(val: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = val;
    }
  }

  public getAudioData(): AudioData {
    if (!this.analyser || !this.dataArray || !this.timeArray) {
      return {
        frequencyData: new Uint8Array(0),
        timeData: new Uint8Array(0),
        rms: 0,
        bass: 0,
        mid: 0,
        treble: 0
      };
    }

    this.analyser.getByteFrequencyData(this.dataArray);
    this.analyser.getByteTimeDomainData(this.timeArray);

    // Calculate bands and RMS
    let sum = 0;
    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;
    
    // FFT_SIZE is 2048, binCount is 1024.
    // Sample rate 44.1k, so each bin is ~21.5Hz.
    // Bass: 20-140Hz (~bins 1-7)
    // Mid: 140-2000Hz (~bins 7-93)
    // Treble: 2k-20k (~bins 93-930)

    const binCount = this.analyser.frequencyBinCount;

    for (let i = 0; i < binCount; i++) {
      const val = this.dataArray[i];
      sum += val * val;

      if (i < 10) bassSum += val;
      else if (i < 100) midSum += val;
      else trebleSum += val;
    }

    const rms = Math.sqrt(sum / binCount);
    const bass = bassSum / 10;
    const mid = midSum / 90;
    const treble = trebleSum / (binCount - 100);

    return {
      frequencyData: this.dataArray,
      timeData: this.timeArray,
      rms,
      bass,
      mid,
      treble
    };
  }

  public resumeContext() {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}