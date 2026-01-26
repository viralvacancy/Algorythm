import React, { useRef, useEffect, useState } from 'react';
import { AudioEngine } from '../services/AudioEngine';
import { VisualizerMode, AudioData } from '../types';
import { WireframeMatrix, ParticleGalaxy, CrystalLattice, PlasmaWave } from './WebGLVisualizers';

interface Props {
  audioEngine: AudioEngine;
  mode: VisualizerMode;
  isPlaying: boolean;
}



// Easing functions for smoother animations
const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);
const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

const VisualizerCanvas: React.FC<Props> = ({ audioEngine, mode, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);
  const [audioData, setAudioData] = useState<AudioData>({
    frequencyData: new Uint8Array(0),
    timeData: new Uint8Array(0),
    rms: 0,
    bass: 0,
    mid: 0,
    treble: 0,
  });

  // Smoothed audio values for enhanced reactivity
  const smoothedBassRef = useRef<number>(0);
  const smoothedMidRef = useRef<number>(0);
  const smoothedTrebleRef = useRef<number>(0);
  const beatDetectedRef = useRef<boolean>(false);
  const lastBassRef = useRef<number>(0);
  
  // History for trails and effects
  const historyRef = useRef<number[][]>([]);
  const maxHistory = 30;

  // Check if this is a WebGL mode
  const isWebGLMode = [
    VisualizerMode.WireframeMatrix,
    VisualizerMode.ParticleGalaxy,
    VisualizerMode.CrystalLattice,
    VisualizerMode.PlasmaWave
  ].includes(mode);

  // Cleanup state on mode change
  useEffect(() => {
    rotationRef.current = 0;
    historyRef.current = [];
  }, [mode]);

  // Smooth audio values with lerp
  const smoothValue = (current: number, target: number, factor: number = 0.15): number => {
    return current + (target - current) * factor;
  };

  // Beat detection
  const detectBeat = (bass: number): boolean => {
    const threshold = 1.4;
    const isBeat = bass > lastBassRef.current * threshold && bass > 120;
    lastBassRef.current = bass;
    return isBeat;
  };

  // Enhanced Spectrogram with bloom and better colors
  const renderSpectrogram = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    const cx = width / 2;
    const cy = height / 2;
    
    // Smooth fade for trails
    ctx.fillStyle = 'rgba(5, 5, 10, 0.25)';
    ctx.fillRect(0, 0, width, height);

    const barCount = Math.floor(data.frequencyData.length / 2.5);
    const barWidth = (width / barCount) * 1.2;
    const bass = smoothedBassRef.current / 255;
    const treble = smoothedTrebleRef.current / 255;
    
    // Dynamic hue shift based on audio
    const hueShift = (Date.now() * 0.05) % 360;
    
    // Update history for glow effect
    const currentFrame = Array.from(data.frequencyData.slice(0, barCount));
    historyRef.current.push(currentFrame);
    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift();
    }

    // Draw ghost trails first
    ctx.globalAlpha = 0.1;
    historyRef.current.forEach((frame, histIdx) => {
      const alpha = (histIdx / historyRef.current.length) * 0.15;
      ctx.globalAlpha = alpha;
      let x = 0;
      for (let i = 0; i < frame.length; i++) {
        const val = frame[i];
        const scale = Math.log2(i + 2) / Math.log2(barCount + 2);
        const barHeight = Math.pow(val / 255, 1.3) * (height * 0.35) * (1 + scale);
        
        if (barHeight > 2) {
          const hue = (hueShift + i * 2 + histIdx * 5) % 360;
          ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
          ctx.fillRect(cx + x, cy - barHeight, barWidth - 1, barHeight);
          ctx.fillRect(cx - x - barWidth, cy - barHeight, barWidth - 1, barHeight);
        }
        x += barWidth;
      }
    });
    ctx.globalAlpha = 1.0;

    // Main bars with gradient
    let x = 0;
    for (let i = 0; i < barCount; i++) {
      const val = data.frequencyData[i];
      const scale = Math.log2(i + 2) / Math.log2(barCount + 2);
      const barHeight = Math.pow(val / 255, 1.4) * (height * 0.4) * (1 + scale * 0.5);

      if (barHeight > 2) {
        const hue = (hueShift + i * 3) % 360;
        const saturation = 80 + treble * 20;
        const lightness = 50 + bass * 20;
        
        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(0, cy - barHeight, 0, cy);
        gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness + 20}%, 1)`);
        gradient.addColorStop(0.5, `hsla(${(hue + 30) % 360}, ${saturation}%, ${lightness}%, 1)`);
        gradient.addColorStop(1, `hsla(${(hue + 60) % 360}, ${saturation}%, ${lightness - 10}%, 0.8)`);
        
        ctx.fillStyle = gradient;
        
        // Glow effect
        ctx.shadowBlur = 15 + bass * 20;
        ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.8)`;
        
        // Top bars
        ctx.fillRect(cx + x, cy - barHeight, barWidth - 2, barHeight);
        ctx.fillRect(cx - x - barWidth, cy - barHeight, barWidth - 2, barHeight);

        // Bottom reflection with fade
        ctx.globalAlpha = 0.25;
        ctx.shadowBlur = 5;
        ctx.fillRect(cx + x, cy, barWidth - 2, barHeight * 0.6);
        ctx.fillRect(cx - x - barWidth, cy, barWidth - 2, barHeight * 0.6);
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      }
      x += barWidth;
    }
    
    // Pulsing center line
    const lineGlow = 0.3 + bass * 0.7;
    ctx.strokeStyle = `rgba(255, 255, 255, ${lineGlow})`;
    ctx.lineWidth = 1 + bass * 2;
    ctx.shadowBlur = 10 + bass * 15;
    ctx.shadowColor = `hsla(${hueShift}, 100%, 70%, 0.8)`;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  // Enhanced Circular with better particle effects and glow
  const renderCircular = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, width, height);
    
    const cx = width / 2;
    const cy = height / 2;
    const minDim = Math.min(width, height);
    const radius = minDim * 0.12;
    const bass = smoothedBassRef.current / 255;
    const mid = smoothedMidRef.current / 255;
    const treble = smoothedTrebleRef.current / 255;
    
    // Pulse effect
    const pulse = 1 + bass * 0.35 + (beatDetectedRef.current ? 0.15 : 0);
    const effectiveRadius = radius * pulse;
    
    // Hue cycling
    const baseHue = (Date.now() * 0.03) % 360;

    rotationRef.current += 0.004 + mid * 0.015;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotationRef.current);

    // Outer glow rings
    for (let ring = 3; ring >= 0; ring--) {
      const ringRadius = effectiveRadius * (1 + ring * 0.8);
      const alpha = 0.1 - ring * 0.02;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${(baseHue + ring * 30) % 360}, 100%, 60%, ${alpha + bass * 0.1})`;
      ctx.lineWidth = 2 + bass * 3;
      ctx.stroke();
    }

    // Inner Core with dynamic gradient
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, effectiveRadius);
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.2, `hsla(${baseHue}, 100%, 70%, 1)`);
    coreGradient.addColorStop(0.5, `hsla(${(baseHue + 30) % 360}, 100%, 50%, 1)`);
    coreGradient.addColorStop(1, `hsla(${(baseHue + 60) % 360}, 100%, 30%, 0.5)`);
    
    ctx.beginPath();
    ctx.arc(0, 0, effectiveRadius, 0, Math.PI * 2);
    ctx.fillStyle = coreGradient;
    ctx.shadowBlur = 40 * pulse + bass * 30;
    ctx.shadowColor = `hsla(${baseHue}, 100%, 60%, 0.9)`;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Frequency bars radiating outward
    const segments = 72;
    const bufferLength = data.frequencyData.length;
    const step = Math.floor(bufferLength / 1.5 / segments);
    
    for (let i = 0; i < segments; i++) {
      const val = data.frequencyData[i * step];
      const normalizedVal = val / 255;
      const barHeight = normalizedVal * (minDim * 0.35);
      const angle = (i / segments) * Math.PI * 2;
      const hue = (baseHue + normalizedVal * 60 + i * 2) % 360;
      
      ctx.save();
      ctx.rotate(angle);
      ctx.translate(effectiveRadius + 8, 0);
      
      // Bar gradient
      const barGradient = ctx.createLinearGradient(0, 0, barHeight, 0);
      barGradient.addColorStop(0, `hsla(${hue}, 100%, 60%, 1)`);
      barGradient.addColorStop(0.7, `hsla(${(hue + 30) % 360}, 100%, 50%, 0.8)`);
      barGradient.addColorStop(1, `hsla(${(hue + 60) % 360}, 100%, 40%, 0)`);
      
      ctx.fillStyle = barGradient;
      ctx.shadowBlur = 8 + normalizedVal * 15;
      ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.7)`;
      
      // Tapered bar shape
      ctx.beginPath();
      ctx.moveTo(0, -3 - normalizedVal * 2);
      ctx.lineTo(barHeight, -1);
      ctx.lineTo(barHeight, 1);
      ctx.lineTo(0, 3 + normalizedVal * 2);
      ctx.closePath();
      ctx.fill();
      
      // Particle at end of bar
      if (normalizedVal > 0.5) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(barHeight + 3, 0, 2 + normalizedVal * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    }

    ctx.restore();
  };

  // Enhanced Waveform with phosphor glow effect
  const renderWaveform = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    // CRT-style background
    ctx.fillStyle = '#000805';
    ctx.fillRect(0, 0, width, height);
    
    const cy = height / 2;
    const bass = smoothedBassRef.current / 255;
    const mid = smoothedMidRef.current / 255;
    
    // Scanline effect
    ctx.fillStyle = 'rgba(0, 30, 0, 0.03)';
    for (let y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(0, 100, 0, 0.15)';
    ctx.lineWidth = 1;
    const gridSpacing = 50;
    for (let x = 0; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Multiple passes for glow effect
    const passes = [
      { blur: 25, alpha: 0.3, width: 8 },
      { blur: 15, alpha: 0.5, width: 5 },
      { blur: 8, alpha: 0.7, width: 3 },
      { blur: 0, alpha: 1.0, width: 2 }
    ];
    
    const hue = 120 + mid * 40; // Shift from green towards cyan based on mid
    
    passes.forEach(pass => {
      ctx.lineWidth = pass.width;
      ctx.strokeStyle = `hsla(${hue}, 100%, ${50 + bass * 20}%, ${pass.alpha})`;
      ctx.shadowBlur = pass.blur;
      ctx.shadowColor = `hsla(${hue}, 100%, 60%, 1)`;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      const sliceWidth = width / data.timeData.length;
      let x = 0;

      for (let i = 0; i < data.timeData.length; i++) {
        const v = data.timeData[i] / 128.0;
        const y = v * height / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }
      ctx.stroke();
    });
    
    ctx.shadowBlur = 0;
    
    // Center line indicator
    ctx.strokeStyle = `rgba(0, 255, 0, ${0.2 + bass * 0.3})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 10]);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Enhanced Kaleidoscope with more particles and bloom
  const renderKaleidoscope = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    const cx = width / 2;
    const cy = height / 2;
    const symmetry = 10;
    const angleStep = (Math.PI * 2) / symmetry;
    const bass = smoothedBassRef.current / 255;
    const mid = smoothedMidRef.current / 255;
    const treble = smoothedTrebleRef.current / 255;
    
    const baseHue = (Date.now() / 15) % 360;

    // Particle spawning with audio reactivity
    if (treble > 0.4 || beatDetectedRef.current) {
      const particlesToSpawn = Math.min(Math.floor(treble * 8) + (beatDetectedRef.current ? 5 : 0), 10);
      for (let i = 0; i < particlesToSpawn; i++) {
        const hue = (baseHue + Math.random() * 90) % 360;
        kaleidoscopeParticlesRef.current.push({
          x: 0,
          y: 0,
          angle: Math.random() * Math.PI * 2,
          speed: 3 + Math.random() * 8 + bass * 5,
          life: 1.0,
          color: `hsl(${hue}, 90%, 65%)`,
          size: 2 + Math.random() * 4 + bass * 3
        });
      }
    }
    
    // Update particles
    for (let i = kaleidoscopeParticlesRef.current.length - 1; i >= 0; i--) {
      const p = kaleidoscopeParticlesRef.current[i];
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      p.life -= 0.015;
      p.size *= 0.98;
      if (p.life <= 0) {
        kaleidoscopeParticlesRef.current.splice(i, 1);
      }
    }

    rotationRef.current += 0.003 + treble * 0.02;
    const scalePulse = 1 + bass * 0.4 + (beatDetectedRef.current ? 0.1 : 0);
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotationRef.current);
    ctx.scale(scalePulse, scalePulse);

    // Draw particles with symmetry
    if (kaleidoscopeParticlesRef.current.length > 0) {
      ctx.globalCompositeOperation = 'screen';
      kaleidoscopeParticlesRef.current.forEach(p => {
        for (let s = 0; s < symmetry; s++) {
          ctx.save();
          ctx.rotate(s * angleStep);
          
          const alpha = p.life * 0.9;
          ctx.fillStyle = p.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla');
          ctx.shadowBlur = 15 + p.life * 10;
          ctx.shadowColor = p.color;
          
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
          
          // Mirror
          ctx.beginPath();
          ctx.arc(p.x, -p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.restore();
        }
      });
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
    }

    // Draw frequency arms with bloom
    for (let i = 0; i < symmetry; i++) {
      ctx.save();
      ctx.rotate(i * angleStep);
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      
      const len = 80;
      const step = (Math.min(width, height) * 0.55) / len;
      
      for (let j = 0; j < len; j++) {
        const freqIndex = Math.min(j * 2, data.frequencyData.length - 1);
        const val = data.frequencyData[freqIndex];
        const x = j * step;
        const amp = (val / 255) * (x * 1.5 + 20) * (1 + mid * 0.5);
        ctx.lineTo(x, amp);
      }
      
      const armHue = (baseHue + i * 36) % 360;
      ctx.strokeStyle = `hsl(${armHue}, 85%, 55%)`;
      ctx.lineWidth = 2 + bass * 2;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 20 + bass * 15;
      ctx.shadowColor = `hsl(${armHue}, 100%, 60%)`;
      ctx.stroke();
      
      // Mirror arm
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let j = 0; j < len; j++) {
        const freqIndex = Math.min(j * 2, data.frequencyData.length - 1);
        const val = data.frequencyData[freqIndex];
        const x = j * step;
        const amp = (val / 255) * (x * 1.5 + 20) * (1 + mid * 0.5);
        ctx.lineTo(x, -amp);
      }
      ctx.stroke();
      
      ctx.restore();
    }
    
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  // Enhanced Pulse Tunnel with more depth
  const renderPulseTunnel = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const minDim = Math.min(width, height);
    const bass = smoothedBassRef.current / 255;
    const mid = smoothedMidRef.current / 255;
    const treble = smoothedTrebleRef.current / 255;

    rotationRef.current += 0.008 + mid * 0.025;
    const ringCount = 16;
    const baseHue = (Date.now() * 0.02) % 360;

    // Deep space background
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, minDim * 0.8);
    bg.addColorStop(0, '#050510');
    bg.addColorStop(0.5, '#020208');
    bg.addColorStop(1, '#000003');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Stars in background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 100; i++) {
      const sx = (Math.sin(i * 123.456) * 0.5 + 0.5) * width;
      const sy = (Math.cos(i * 789.012) * 0.5 + 0.5) * height;
      const size = 1 + Math.sin(rotationRef.current + i) * 0.5;
      ctx.fillRect(sx, sy, size, size);
    }

    // Concentric rings with enhanced effects
    for (let i = ringCount - 1; i >= 0; i--) {
      const progress = i / ringCount;
      const radius = Math.pow(progress, 1.1) * minDim * 0.65 * (1 + bass * 0.15);
      const hue = (baseHue + progress * 180) % 360;
      
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, 90%, ${45 + bass * 25}%, ${0.6 - progress * 0.5})`;
      ctx.lineWidth = 3 + Math.sin(rotationRef.current * 2 + i) * 2 + bass * 4;
      ctx.setLineDash([6 + i * 2, 12 - i]);
      ctx.lineDashOffset = rotationRef.current * 50 * (1 - progress * 0.3) * (i % 2 === 0 ? 1 : -1);
      ctx.shadowBlur = 10 + bass * 15;
      ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.5)`;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Radiating beams with gradient
    const beams = 144;
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < beams; i++) {
      const angle = (i / beams) * Math.PI * 2 + rotationRef.current * 0.4;
      const freqIndex = Math.floor((i / beams) * Math.min(data.frequencyData.length, 256));
      const val = data.frequencyData[freqIndex] / 255;
      const len = minDim * 0.2 + val * minDim * 0.4;
      const hue = (baseHue + val * 100 + i) % 360;
      
      ctx.save();
      ctx.rotate(angle);
      
      const beamGradient = ctx.createLinearGradient(minDim * 0.04, 0, len, 0);
      beamGradient.addColorStop(0, `hsla(${hue}, 100%, 60%, 0)`);
      beamGradient.addColorStop(0.3, `hsla(${hue}, 100%, 60%, ${0.3 + val * 0.5})`);
      beamGradient.addColorStop(1, `hsla(${(hue + 40) % 360}, 100%, 50%, 0)`);
      
      ctx.beginPath();
      ctx.moveTo(minDim * 0.04, 0);
      ctx.lineTo(len, 0);
      ctx.strokeStyle = beamGradient;
      ctx.lineWidth = 1 + val * 4;
      ctx.stroke();
      
      ctx.restore();
    }
    ctx.restore();

    // Central core glow
    const coreSize = minDim * 0.1 + bass * minDim * 0.06;
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize);
    core.addColorStop(0, 'rgba(255,255,255,0.95)');
    core.addColorStop(0.3, `hsla(${baseHue}, 100%, 70%, 0.8)`);
    core.addColorStop(0.7, `hsla(${(baseHue + 60) % 360}, 100%, 50%, 0.4)`);
    core.addColorStop(1, 'rgba(0, 200, 255, 0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, width, height);
  };

  // Enhanced Tidal Bloom with better caustics
  const renderTidalBloom = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    const bass = smoothedBassRef.current / 255;
    const mid = smoothedMidRef.current / 255;
    const treble = smoothedTrebleRef.current / 255;
    waterPhaseRef.current += 0.012 + mid * 0.035;
    const t = waterPhaseRef.current;

    // Enhanced ocean gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#021525');
    bg.addColorStop(0.25, '#032d52');
    bg.addColorStop(0.6, '#021f3d');
    bg.addColorStop(1, '#010a14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Animated light shafts
    const shafts = 8;
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < shafts; i++) {
      const phase = t * 0.4 + i * 0.8;
      const x = (Math.sin(phase) * 0.45 + 0.5) * width;
      const w = width * (0.04 + treble * 0.1 + Math.sin(t + i) * 0.02);
      const intensity = 0.06 + treble * 0.25 + Math.sin(t * 2 + i * 0.5) * 0.03;
      
      const grad = ctx.createLinearGradient(x - w, 0, x + w, height);
      grad.addColorStop(0, 'rgba(20,140,220,0)');
      grad.addColorStop(0.3, `rgba(60,180,240,${intensity})`);
      grad.addColorStop(0.7, `rgba(40,160,220,${intensity * 0.7})`);
      grad.addColorStop(1, 'rgba(20,120,200,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - w * 1.5, 0, w * 3, height);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Enhanced caustic lattice
    const cellSize = 30;
    ctx.lineCap = 'round';
    for (let y = 0; y < height; y += cellSize) {
      for (let x = 0; x < width; x += cellSize) {
        const wave1 = Math.sin((x * 0.025 + t * 3.5) + Math.cos(y * 0.035 + t * 2.5));
        const wave2 = Math.cos((y * 0.025 + t * 2.8) + Math.sin(x * 0.045 + t * 1.5));
        const wave = (wave1 + wave2) * 0.5;
        const intensity = (wave * 0.5 + 0.5) * (0.15 + bass * 0.8);
        
        ctx.strokeStyle = `rgba(80, 200, 255, ${intensity})`;
        ctx.lineWidth = 1 + bass * 2 + wave * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y + cellSize / 2 + wave * 4);
        ctx.quadraticCurveTo(
          x + cellSize / 2, y + cellSize / 2 - wave * 6,
          x + cellSize, y + cellSize / 2 + wave * 4
        );
        ctx.stroke();
      }
    }

    // Surface shimmer waves
    for (let layer = 0; layer < 3; layer++) {
      const shimmerY = 15 + layer * 8;
      ctx.strokeStyle = `rgba(180, 240, 255, ${0.08 - layer * 0.02 + treble * 0.15})`;
      ctx.lineWidth = 2.5 - layer * 0.5 + mid * 2;
      ctx.beginPath();
      for (let i = 0; i <= width; i += 8) {
        const py = shimmerY + Math.sin(t * 2.5 + i * 0.03 + layer) * (6 + mid * 4);
        if (i === 0) ctx.moveTo(i, py);
        else ctx.lineTo(i, py);
      }
      ctx.stroke();
    }

    // Enhanced bubbles
    if (bubbleFieldRef.current.length < 150 && Math.random() < 0.7 + bass * 0.3) {
      bubbleFieldRef.current.push({
        x: Math.random() * width,
        y: height + 15,
        radius: 2 + Math.random() * 7 + bass * 5,
        drift: Math.random() * 0.8 - 0.4,
        life: 1,
        speed: 1.2 + Math.random() * 2 + bass * 2,
      });
    }

    bubbleFieldRef.current = bubbleFieldRef.current.filter((b) => b.life > 0);
    bubbleFieldRef.current.forEach((b) => {
      b.y -= b.speed;
      b.x += b.drift + Math.sin(t * 1.5 + b.y * 0.015) * 0.6;
      b.life -= 0.003 + treble * 0.012;
      
      const bubbleAlpha = 0.35 + b.life * 0.65;
      const bubbleSize = b.radius * (1 + bass * 0.25) * (0.8 + b.life * 0.2);
      
      // Bubble body
      const bubbleGrad = ctx.createRadialGradient(
        b.x - bubbleSize * 0.3, b.y - bubbleSize * 0.3, 0,
        b.x, b.y, bubbleSize
      );
      bubbleGrad.addColorStop(0, `rgba(255, 255, 255, ${bubbleAlpha * 0.5})`);
      bubbleGrad.addColorStop(0.5, `rgba(180, 230, 255, ${bubbleAlpha * 0.3})`);
      bubbleGrad.addColorStop(1, `rgba(100, 200, 255, ${bubbleAlpha * 0.1})`);
      
      ctx.fillStyle = bubbleGrad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, bubbleSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Highlight
      ctx.fillStyle = `rgba(255, 255, 255, ${bubbleAlpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(b.x - bubbleSize * 0.35, b.y - bubbleSize * 0.35, bubbleSize * 0.25, 0, Math.PI * 2);
      ctx.fill();
    });

    // Depth fog overlay
    const fog = ctx.createLinearGradient(0, 0, 0, height);
    fog.addColorStop(0, 'rgba(0,0,0,0)');
    fog.addColorStop(0.7, 'rgba(0,5,15,0.3)');
    fog.addColorStop(1, 'rgba(0,8,20,0.7)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, width, height);
  };

  // Voxel helper function
  const drawVoxel = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, hue: number, depth: number, glow: number = 0) => {
    const light = 0.75 + Math.sin(depth * 0.5) * 0.1;
    const top = `hsl(${hue}, 80%, ${55 * light}%)`;
    const left = `hsl(${hue}, 70%, ${38 * light}%)`;
    const right = `hsl(${hue}, 70%, ${32 * light}%)`;

    if (glow > 0) {
      ctx.shadowBlur = glow;
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
    }

    // Top face
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.6);
    ctx.lineTo(x + size, y - size);
    ctx.lineTo(x + size * 2, y - size * 0.6);
    ctx.lineTo(x + size, y);
    ctx.closePath();
    ctx.fillStyle = top;
    ctx.fill();

    // Left face
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.6);
    ctx.lineTo(x, y + size * 0.6);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x + size, y);
    ctx.closePath();
    ctx.fillStyle = left;
    ctx.fill();

    // Right face
    ctx.beginPath();
    ctx.moveTo(x + size, y);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x + size * 2, y + size * 0.6);
    ctx.lineTo(x + size * 2, y - size * 0.6);
    ctx.closePath();
    ctx.fillStyle = right;
    ctx.fill();

    ctx.shadowBlur = 0;
  };

  // Enhanced Voxel Octopus
  const renderVoxelOctopus = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    const bass = smoothedBassRef.current / 255;
    const mid = smoothedMidRef.current / 255;
    const treble = smoothedTrebleRef.current / 255;
    octopusPulseRef.current += 0.012 + mid * 0.035;
    const t = octopusPulseRef.current;
    const cx = width / 2;
    const cy = height * 0.55;
    const minDim = Math.min(width, height);

    // Enhanced abyss background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#011528');
    bg.addColorStop(0.35, '#022438');
    bg.addColorStop(0.7, '#011020');
    bg.addColorStop(1, '#010610');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Volumetric god rays
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 7; i++) {
      const ang = i * 0.5 + Math.sin(t * 0.6) * 0.35;
      const rayX = cx + Math.sin(ang) * width * 0.55;
      const rayWidth = width * 0.18;
      
      const grad = ctx.createLinearGradient(rayX, 0, cx, cy);
      grad.addColorStop(0, 'rgba(15, 80, 140, 0)');
      grad.addColorStop(0.5, `rgba(60, 180, 240, ${0.06 + treble * 0.2})`);
      grad.addColorStop(1, `rgba(100, 220, 255, ${0.1 + treble * 0.3})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(rayX - rayWidth, 0);
      ctx.lineTo(rayX + rayWidth, 0);
      ctx.lineTo(cx + width * 0.12, cy);
      ctx.lineTo(cx - width * 0.12, cy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Floating particles with depth
    for (let i = 0; i < 180; i++) {
      const px = ((i * 89 + Math.sin(t * 0.8 + i) * 70) % width + width) % width;
      const py = (((i * 61 + Math.cos(t * 0.5 + i * 0.4) * 50) % height + height) % height) * 0.85;
      const particleDepth = (i % 3) + 1;
      const alpha = (0.08 + Math.sin(t + i) * 0.06 + treble * 0.15) / particleDepth;
      const size = (3 - particleDepth) + 1;
      
      ctx.fillStyle = `rgba(140, 200, 240, ${alpha})`;
      ctx.fillRect(px, py, size, size);
    }

    // Main body with glow
    const bodySize = minDim * 0.085 * (1 + bass * 0.3);
    const bodyHue = 290 + treble * 50;
    
    drawVoxel(ctx, cx - bodySize, cy - bodySize * 0.3, bodySize, bodyHue, 0, 15 + bass * 20);
    
    // Body highlight
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${0.12 + treble * 0.35})`;
    ctx.ellipse(cx, cy - bodySize * 0.55, bodySize * 0.75, bodySize * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Arms with improved animation
    const arms = 8;
    const segments = 16;
    const armLength = minDim * 0.38;
    const cubeBase = minDim * 0.02;

    const nodes: VoxelArmNode[] = [];
    for (let i = 0; i < arms; i++) {
      const baseAngle = (i / arms) * Math.PI * 2 + Math.sin(t * 0.35) * 0.25;
      for (let j = 0; j < segments; j++) {
        const p = j / segments;
        const radius = armLength * easeOutQuart(p);
        const waveIntensity = 0.12 + bass * 0.4;
        const wave = Math.sin(t * 2.2 + p * 7 + i) * waveIntensity;
        const sway = Math.sin(t * 0.9 + p * 9 + i * 0.6) * 0.35 * (0.5 + mid);
        const angle = baseAngle + wave + sway * 0.25;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius * 0.55 + Math.cos(p * 6 + t) * 8;
        const size = cubeBase * (1 - p * 0.55) * (1 + bass * 0.25);
        const depth = p + Math.sin(t + i) * 0.1;
        nodes.push({ x, y, size, depth, hue: bodyHue + p * 25 + i * 5 });
      }
    }

    nodes.sort((a, b) => a.depth - b.depth);
    nodes.forEach((n) => {
      const glow = treble > 0.4 ? 8 + treble * 12 : 0;
      drawVoxel(ctx, n.x - n.size, n.y - n.size * 0.3, n.size, n.hue, n.depth, glow);
    });

    // Expressive eyes
    const eyeSize = bodySize * 0.16;
    const eyeOffsetX = bodySize * 0.42;
    const eyeOffsetY = bodySize * 0.38;
    const blinkPhase = Math.sin(t * 0.3) > 0.95 ? 0.3 : 1;
    
    // Eye whites
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx - eyeOffsetX, cy - eyeOffsetY, eyeSize, eyeSize * blinkPhase, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + eyeOffsetX, cy - eyeOffsetY, eyeSize, eyeSize * blinkPhase, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupils that follow audio
    const pupilOffset = mid * 3;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx - eyeOffsetX + pupilOffset, cy - eyeOffsetY * 0.9, eyeSize * 0.55, 0, Math.PI * 2);
    ctx.arc(cx + eyeOffsetX + pupilOffset, cy - eyeOffsetY * 0.9, eyeSize * 0.55, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye shine
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(cx - eyeOffsetX - eyeSize * 0.2, cy - eyeOffsetY - eyeSize * 0.3, eyeSize * 0.25, 0, Math.PI * 2);
    ctx.arc(cx + eyeOffsetX - eyeSize * 0.2, cy - eyeOffsetY - eyeSize * 0.3, eyeSize * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Bioluminescent spots
    const spots = 30;
    for (let i = 0; i < spots; i++) {
      const ang = (i / spots) * Math.PI * 2 + t * 0.1;
      const r = bodySize * (0.25 + Math.sin(i * 1.5) * 0.35);
      const fx = cx + Math.cos(ang) * r;
      const fy = cy - bodySize * 0.35 + Math.sin(ang) * r * 0.5;
      const spotAlpha = 0.2 + treble * 0.7 + Math.sin(t * 3 + i) * 0.15;
      const spotSize = 2 + treble * 4 + Math.sin(t * 2 + i * 0.5) * 1;
      
      ctx.fillStyle = `hsla(${bodyHue + 90}, 100%, 70%, ${spotAlpha})`;
      ctx.shadowBlur = 10 + treble * 15;
      ctx.shadowColor = `hsla(${bodyHue + 90}, 100%, 70%, 0.8)`;
      ctx.beginPath();
      ctx.arc(fx, fy, spotSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Ambient bubbles
    if (Math.random() < 0.6 + treble * 0.4) {
      bubbleFieldRef.current.push({
        x: cx + (Math.random() - 0.5) * minDim * 0.7,
        y: cy + minDim * 0.15,
        radius: 1 + Math.random() * 5,
        drift: Math.random() * 0.5 - 0.25,
        life: 1,
        speed: 1.2 + Math.random() * 1.5,
      });
    }

    bubbleFieldRef.current = bubbleFieldRef.current.filter((b) => b.life > 0);
    bubbleFieldRef.current.forEach((b) => {
      b.y -= b.speed;
      b.x += b.drift + Math.sin(t + b.y * 0.02) * 0.3;
      b.life -= 0.007 + treble * 0.018;
      ctx.fillStyle = `rgba(180,220,255,${0.2 + b.life * 0.65})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * (1 + bass * 0.15), 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = audioEngine.getAudioData();
    const width = canvas.width;
    const height = canvas.height;

    // Update audio data state for WebGL components
    setAudioData(data);

    // Smooth audio values
    smoothedBassRef.current = smoothValue(smoothedBassRef.current, data.bass, 0.2);
    smoothedMidRef.current = smoothValue(smoothedMidRef.current, data.mid, 0.15);
    smoothedTrebleRef.current = smoothValue(smoothedTrebleRef.current, data.treble, 0.18);
    
    // Beat detection
    beatDetectedRef.current = detectBeat(data.bass);

    // Skip canvas rendering for WebGL modes
    if (isWebGLMode) {
      requestRef.current = requestAnimationFrame(draw);
      return;
    }

    // Context clearing logic per mode
    if (mode === VisualizerMode.Circular) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    switch (mode) {
      case VisualizerMode.Spectrogram:
        renderSpectrogram(ctx, width, height, data);
        break;
      case VisualizerMode.Circular:
        renderCircular(ctx, width, height, data);
        break;
      case VisualizerMode.Waveform:
        renderWaveform(ctx, width, height, data);
        break;
    }

    requestRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(draw);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [mode, isPlaying, audioEngine, isWebGLMode]);

  // Render WebGL visualizers
  if (isWebGLMode) {
    return (
      <>
        {/* Hidden canvas for audio data updates */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />
        {mode === VisualizerMode.WireframeMatrix && (
          <WireframeMatrix audioData={audioData} isPlaying={isPlaying} />
        )}
        {mode === VisualizerMode.ParticleGalaxy && (
          <ParticleGalaxy audioData={audioData} isPlaying={isPlaying} />
        )}
        {mode === VisualizerMode.CrystalLattice && (
          <CrystalLattice audioData={audioData} isPlaying={isPlaying} />
        )}
        {mode === VisualizerMode.PlasmaWave && (
          <PlasmaWave audioData={audioData} isPlaying={isPlaying} />
        )}
      </>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full z-0 block"
    />
  );
};

export default VisualizerCanvas;
