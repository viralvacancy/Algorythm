import { VisualizerMode } from './types';

export const FFT_SIZE = 2048; // High resolution
export const SMOOTHING_TIME_CONSTANT = 0.85;

export const MODES = [
  { id: VisualizerMode.Spectrogram, label: 'Neon Bars' },
  { id: VisualizerMode.Circular, label: 'Solar Vortex' },
  { id: VisualizerMode.Waveform, label: 'Oscilloscope' },
  { id: VisualizerMode.Kaleidoscope, label: 'Prism' },
  { id: VisualizerMode.Grid, label: 'Aurora Veil' },
];

export const COLOR_PALETTES = {
  neon: ['#f0f', '#0ff', '#00f'],
  fire: ['#f00', '#ff0', '#f80'],
  ocean: ['#0ff', '#00f', '#08f'],
};
