import { VisualizerMode } from './types';

export const FFT_SIZE = 2048; // High resolution
export const SMOOTHING_TIME_CONSTANT = 0.85;

export const MODES = [
  { id: VisualizerMode.Spectrogram, label: 'Neon Bars' },
  { id: VisualizerMode.Circular, label: 'Solar Vortex' },
  { id: VisualizerMode.Waveform, label: 'Oscilloscope' },
  { id: VisualizerMode.Kaleidoscope, label: 'Prism' },
  { id: VisualizerMode.PulseTunnel, label: 'Pulse Tunnel' },
  { id: VisualizerMode.TidalBloom, label: 'Tidal Bloom' },
  { id: VisualizerMode.VoxelOctopus, label: 'Abyssal Voxelpod' },
  // New WebGL modes
  { id: VisualizerMode.NebulaStorm, label: 'Nebula Storm' },
  { id: VisualizerMode.WireframeMatrix, label: 'Wireframe Matrix' },
  { id: VisualizerMode.FractalCosmos, label: 'Fractal Cosmos' },
  { id: VisualizerMode.AuroraWeave, label: 'Aurora Weave' },
  { id: VisualizerMode.HyperTunnel, label: 'Hyper Tunnel' },
  { id: VisualizerMode.QuantumLattice, label: 'Quantum Lattice' },
  { id: VisualizerMode.IonSpire, label: 'Ion Spire' },
];

export const COLOR_PALETTES = {
  neon: ['#f0f', '#0ff', '#00f'],
  fire: ['#f00', '#ff0', '#f80'],
  ocean: ['#0ff', '#00f', '#08f'],
};
