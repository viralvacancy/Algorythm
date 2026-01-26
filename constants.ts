import { VisualizerMode } from './types';

export const FFT_SIZE = 2048; // High resolution
export const SMOOTHING_TIME_CONSTANT = 0.85;

export const MODES = [
  { id: VisualizerMode.Spectrogram, label: 'Neon Bars' },
  { id: VisualizerMode.Circular, label: 'Solar Vortex' },
  { id: VisualizerMode.Waveform, label: 'Oscilloscope' },
  { id: VisualizerMode.WireframeMatrix, label: 'Cyber Grid' },
  { id: VisualizerMode.AetherRings, label: 'Aether Rings' },
  { id: VisualizerMode.PrismShardField, label: 'Prism Shards' },
  { id: VisualizerMode.FluxBloom, label: 'Flux Bloom' },
];

export const COLOR_PALETTES = {
  neon: ['#f0f', '#0ff', '#00f'],
  fire: ['#f00', '#ff0', '#f80'],
  ocean: ['#0ff', '#00f', '#08f'],
};
