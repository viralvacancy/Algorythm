export enum VisualizerMode {
  Spectrogram = 'Spectrogram',
  Circular = 'Circular',
  Waveform = 'Waveform',
  WireframeMatrix = 'WireframeMatrix',
  ParticleGalaxy = 'ParticleGalaxy',
  CrystalLattice = 'CrystalLattice',
  PlasmaWave = 'PlasmaWave'
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
