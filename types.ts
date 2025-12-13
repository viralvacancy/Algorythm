export enum VisualizerMode {
  Spectrogram = 'Spectrogram',
  Circular = 'Circular',
  Waveform = 'Waveform',
  Kaleidoscope = 'Kaleidoscope',
  PulseTunnel = 'PulseTunnel',
  Starfall = 'Starfall',
  Lattice = 'Lattice'
}

export interface Track {
  id: string;
  file: File;
  name: string;
  url: string;
}

export interface AudioData {
  frequencyData: Uint8Array;
  timeData: Uint8Array;
  rms: number; // Root Mean Square (Volume/Amplitude)
  bass: number; // Isolated bass energy
  mid: number;
  treble: number;
}
