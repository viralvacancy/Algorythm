import React, { useRef, useEffect } from 'react';
import { AudioEngine } from '../services/AudioEngine';
import { VisualizerMode, AudioData } from '../types';

interface Props {
  audioEngine: AudioEngine;
  mode: VisualizerMode;
  isPlaying: boolean;
}

interface KaleidoscopeParticle {
  x: number;
  y: number;
  angle: number;
  speed: number;
  life: number;
  color: string;
}

interface StarParticle {
  x: number;
  y: number;
  speed: number;
  size: number;
  twinkle: number;
}

const VisualizerCanvas: React.FC<Props> = ({ audioEngine, mode, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);

  // Particles for Kaleidoscope Mode
  const kaleidoscopeParticlesRef = useRef<KaleidoscopeParticle[]>([]);
  // Starfield particles for Starfall mode
  const starfieldRef = useRef<StarParticle[]>([]);
  const latticePhaseRef = useRef<number>(0);

  // Cleanup state on mode change
  useEffect(() => {
    kaleidoscopeParticlesRef.current = [];
    starfieldRef.current = [];
    latticePhaseRef.current = 0;
    // Reset rotation when switching modes to prevent jarring jumps
    rotationRef.current = 0;
  }, [mode]);

  const renderSpectrogram = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    const cx = width / 2;
    const cy = height / 2;
    
    // Clear with fade for slight trail
    ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
    ctx.fillRect(0, 0, width, height);

    const barCount = Math.floor(data.frequencyData.length / 2);
    const barWidth = (width / barCount) * 1.5;
    let x = 0;

    const gradient = ctx.createLinearGradient(0, cy - height * 0.4, 0, cy + height * 0.4);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
    gradient.addColorStop(0.2, 'rgba(0, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 0, 255, 1)');
    gradient.addColorStop(0.8, 'rgba(0, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');

    ctx.fillStyle = gradient;

    // Draw from center
    for (let i = 0; i < barCount; i++) {
      // Logarithmic scaling for better bass visibility
      const val = data.frequencyData[i];
      const scale = Math.log2(i + 2) / Math.log2(barCount + 2); // Dampen highs slightly
      const barHeight = Math.pow(val / 255, 1.5) * (height * 0.4) * (1 + scale);

      if (barHeight > 2) {
          // Top
          ctx.fillRect(cx + x, cy - barHeight, barWidth - 1, barHeight);
          ctx.fillRect(cx - x - barWidth, cy - barHeight, barWidth - 1, barHeight);

          // Bottom (Reflection) - Lower opacity
          ctx.globalAlpha = 0.4;
          ctx.fillRect(cx + x, cy, barWidth - 1, barHeight);
          ctx.fillRect(cx - x - barWidth, cy, barWidth - 1, barHeight);
          ctx.globalAlpha = 1.0;
      }
      x += barWidth;
    }
    
    // Center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();
  };

  const renderCircular = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    // Classic Solar Vortex
    ctx.clearRect(0, 0, width, height);
    
    const cx = width / 2;
    const cy = height / 2;
    const minDim = Math.min(width, height);
    const radius = minDim * 0.15;
    const bassKick = data.bass / 255;
    
    // Pulse the radius with bass
    const pulse = 1 + bassKick * 0.2;
    const effectiveRadius = radius * pulse;

    rotationRef.current += 0.005 + (data.mid / 255) * 0.01;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotationRef.current);

    // Inner Glowing Core
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, effectiveRadius);
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.3, '#ffaa00');
    coreGradient.addColorStop(1, '#ff0000');
    
    ctx.beginPath();
    ctx.arc(0, 0, effectiveRadius, 0, Math.PI * 2);
    ctx.fillStyle = coreGradient;
    ctx.shadowBlur = 50 * pulse;
    ctx.shadowColor = '#ff4400';
    ctx.fill();
    
    // External Bars
    const bufferLength = data.frequencyData.length;
    const segments = 64; // Standard visualizer count
    const step = Math.floor(bufferLength / 1.5 / segments);
    
    for (let i = 0; i < segments; i++) {
      const val = data.frequencyData[i * step];
      const barHeight = (val / 255) * (minDim * 0.3);
      const angle = (i / segments) * Math.PI * 2;
      
      ctx.save();
      ctx.rotate(angle);
      ctx.translate(effectiveRadius + 5, 0); // Start slightly outside core
      
      ctx.fillStyle = `hsl(${10 + (val/255) * 50}, 100%, 50%)`;
      ctx.fillRect(0, -2, barHeight, 4); // Draw bar extending outward
      
      // Small dot at end of bar
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(barHeight + 2, 0, 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }

    ctx.restore();
  };

  const renderWaveform = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    ctx.clearRect(0, 0, width, height);
    
    // Solid dark background for contrast
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const cy = height / 2;

    // Classic Oscilloscope Style: Single high-contrast line
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#00ff00'; // Classic Hacker Green
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff00';
    
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
  };

  const renderKaleidoscope = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    const cx = width / 2;
    const cy = height / 2;
    const symmetry = 8;
    const angleStep = (Math.PI * 2) / symmetry;
    
    const baseHue = (Date.now() / 20) % 360;

    // --- Particle Logic ---
    if (data.treble > 110) {
        const particlesToSpawn = Math.min(Math.floor((data.treble - 100) / 40), 3);
        for(let i=0; i < particlesToSpawn; i++) {
             const hue = (baseHue + Math.random() * 60) % 360;
             kaleidoscopeParticlesRef.current.push({
                 x: 0,
                 y: 0,
                 angle: (Math.random() * Math.PI * 2), 
                 speed: 4 + Math.random() * 6,
                 life: 1.0,
                 color: `hsl(${hue}, 90%, 70%)`
             });
        }
    }
    
    for (let i = kaleidoscopeParticlesRef.current.length - 1; i >= 0; i--) {
        const p = kaleidoscopeParticlesRef.current[i];
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;
        p.life -= 0.02;
        if (p.life <= 0) {
            kaleidoscopeParticlesRef.current.splice(i, 1);
        }
    }

    rotationRef.current += 0.002 + (data.treble / 255) * 0.015; 
    const scalePulse = 1 + (data.bass / 255) * 0.3; 
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotationRef.current);
    ctx.scale(scalePulse, scalePulse);

    if (kaleidoscopeParticlesRef.current.length > 0) {
        ctx.globalCompositeOperation = 'screen';
        kaleidoscopeParticlesRef.current.forEach(p => {
            ctx.fillStyle = p.color.replace(')', `, ${p.life})`);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
    }

    for (let i = 0; i < symmetry; i++) {
        ctx.save();
        ctx.rotate(i * angleStep);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        
        const len = 64; 
        const step = (Math.min(width, height) * 0.6) / len;
        
        for(let j=0; j<len; j++) {
            const val = data.frequencyData[j * 2]; 
            const x = j * step;
            const amp = (val / 255) * (x * 1.8); 
            ctx.lineTo(x, amp);
        }
        
        ctx.strokeStyle = `hsl(${baseHue + i * 20}, 80%, 60%)`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 20;
        ctx.shadowColor = `hsl(${baseHue + i * 20}, 80%, 60%)`;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
         for(let j=0; j<len; j++) {
            const val = data.frequencyData[j * 2];
            const x = j * step;
            const amp = (val / 255) * (x * 1.8);
            ctx.lineTo(x, -amp);
        }
        ctx.stroke();
        
        ctx.restore();
    }
    
    ctx.restore();
  };

  const renderPulseTunnel = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const minDim = Math.min(width, height);
    const bass = data.bass / 255;
    const mid = data.mid / 255;

    rotationRef.current += 0.01 + mid * 0.02;
    const ringCount = 12;

    // Background vignette
    const bg = ctx.createRadialGradient(cx, cy, minDim * 0.05, cx, cy, minDim * 0.7);
    bg.addColorStop(0, '#04060a');
    bg.addColorStop(1, '#010203');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Concentric rings
    for (let i = 0; i < ringCount; i++) {
      const progress = i / ringCount;
      const radius = (progress ** 1.2) * minDim * 0.6 * (1 + bass * 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${200 + progress * 120}, 80%, ${50 + bass * 30}%, ${0.5 - progress * 0.4})`;
      ctx.lineWidth = 2 + Math.sin(rotationRef.current + i) * 1.5 + bass * 2;
      ctx.setLineDash([8 + i * 1.5, 14 - i]);
      ctx.lineDashOffset = rotationRef.current * 40 * (1 - progress * 0.5);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Radiating beams
    const beams = 120;
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < beams; i++) {
      const angle = (i / beams) * Math.PI * 2 + rotationRef.current * 0.5;
      const val = data.frequencyData[Math.floor((i / beams) * data.frequencyData.length)] / 255;
      const len = minDim * 0.25 + val * minDim * 0.35;
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(minDim * 0.05, 0);
      ctx.lineTo(len, 0);
      ctx.strokeStyle = `hsla(${180 + val * 80}, 100%, ${60 + val * 20}%, ${0.2 + val * 0.6})`;
      ctx.lineWidth = 1.5 + val * 3;
      ctx.stroke();
      ctx.rotate(-angle);
    }
    ctx.restore();

    // Central glow
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, minDim * 0.12 + bass * minDim * 0.05);
    core.addColorStop(0, `rgba(255,255,255,0.9)`);
    core.addColorStop(1, `rgba(0, 220, 255, 0)`);
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, width, height);
  };

  const renderStarfall = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, width, height);

    const bass = data.bass / 255;
    const treble = data.treble / 255;

    if (starfieldRef.current.length === 0) {
      const count = 160;
      starfieldRef.current = Array.from({ length: count }).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 1 + Math.random() * 2,
        size: 1 + Math.random() * 2,
        twinkle: Math.random() * Math.PI * 2,
      }));
    }

    // Meteor streaks on treble spikes
    const streaks = Math.min(4, Math.floor((treble * 5)));
    for (let i = 0; i < streaks; i++) {
      const x = (Date.now() * 0.08 + i * 120) % width;
      const y = ((Date.now() * 0.05 + i * 90) % height) * 0.6;
      ctx.strokeStyle = `hsla(${190 + treble * 100}, 100%, 70%, 0.7)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 80, y + 60);
      ctx.stroke();
    }

    starfieldRef.current.forEach((star) => {
      star.y += star.speed * (1 + bass * 1.5);
      star.x += Math.sin(star.y * 0.002 + rotationRef.current) * 0.5;
      if (star.y > height) {
        star.y = -10;
        star.x = Math.random() * width;
      }
      star.twinkle += 0.05 + treble * 0.1;
      const twinkleAlpha = 0.4 + Math.sin(star.twinkle) * 0.3 + treble * 0.3;

      ctx.fillStyle = `rgba(180, 220, 255, ${twinkleAlpha})`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#8ad7ff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size + bass * 1.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Connect nearby stars
    ctx.shadowBlur = 0;
    for (let i = 0; i < starfieldRef.current.length; i++) {
      const a = starfieldRef.current[i];
      for (let j = i + 1; j < starfieldRef.current.length; j++) {
        const b = starfieldRef.current[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 90) {
          const strength = 1 - dist / 90;
          ctx.strokeStyle = `rgba(120, 200, 255, ${strength * (0.2 + treble * 0.6)})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
  };

  const renderLattice = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    ctx.clearRect(0, 0, width, height);

    const bass = data.bass / 255;
    const mid = data.mid / 255;
    const treble = data.treble / 255;
    const spacing = 50;
    const cols = Math.ceil(width / spacing) + 2;
    const rows = Math.ceil(height / spacing) + 2;

    latticePhaseRef.current += 0.02 + treble * 0.05;
    const phase = latticePhaseRef.current;

    // Background grid glow
    ctx.fillStyle = '#05060b';
    ctx.fillRect(0, 0, width, height);

    for (let y = -1; y < rows; y++) {
      for (let x = -1; x < cols; x++) {
        const px = x * spacing + ((y % 2) * spacing) / 2;
        const py = y * spacing;

        const wave = Math.sin(phase + x * 0.6 + y * 0.8) * 10;
        const lift = Math.cos(phase * 1.4 + x * 0.3) * 6;
        const jitter = (data.frequencyData[(x * y + y * 3) % data.frequencyData.length] / 255) * 12;
        const finalX = px + wave + jitter * mid;
        const finalY = py + lift - bass * 15;

        // Points
        ctx.beginPath();
        ctx.fillStyle = `hsla(${180 + treble * 120}, 90%, ${40 + mid * 30}%, 0.8)`;
        ctx.arc(finalX, finalY, 2 + bass * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Horizontal connections
        const nextX = x + 1;
        if (nextX < cols) {
          const nextPx = nextX * spacing + ((y % 2) * spacing) / 2;
          const nextWave = Math.sin(phase + nextX * 0.6 + y * 0.8) * 10;
          const nextLift = Math.cos(phase * 1.4 + nextX * 0.3) * 6;
          const nextJitter = (data.frequencyData[(nextX * y + y * 3) % data.frequencyData.length] / 255) * 12;
          const hx = nextPx + nextWave + nextJitter * mid;
          const hy = py + nextLift - bass * 15;
          ctx.strokeStyle = `rgba(0, 255, 200, ${0.12 + bass * 0.4})`;
          ctx.lineWidth = 1 + treble * 1.5;
          ctx.beginPath();
          ctx.moveTo(finalX, finalY);
          ctx.lineTo(hx, hy);
          ctx.stroke();
        }

        // Vertical connections
        const nextY = y + 1;
        if (nextY < rows) {
          const vy = nextY * spacing;
          const vWave = Math.sin(phase + x * 0.6 + nextY * 0.8) * 10;
          const vLift = Math.cos(phase * 1.4 + x * 0.3) * 6;
          const vJitter = (data.frequencyData[(x * nextY + nextY * 3) % data.frequencyData.length] / 255) * 12;
          const vx = px + vWave + vJitter * mid + ((nextY % 2) * spacing) / 2;
          const vyPos = vy + vLift - bass * 15;
          ctx.strokeStyle = `rgba(0, 180, 255, ${0.1 + treble * 0.5})`;
          ctx.lineWidth = 1 + bass * 1.2;
          ctx.beginPath();
          ctx.moveTo(finalX, finalY);
          ctx.lineTo(vx, vyPos);
          ctx.stroke();
        }
      }
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = audioEngine.getAudioData();
    const width = canvas.width;
    const height = canvas.height;

    // Context clearing logic per mode
    if (mode === VisualizerMode.Kaleidoscope) {
         ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
         ctx.fillRect(0, 0, width, height);
    } else if (mode !== VisualizerMode.Starfall) {
         ctx.clearRect(0,0,width,height);
    }
    // Spectrogram/Circular/Waveform/PulseTunnel/Lattice handle their own clears inside render methods.

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
      case VisualizerMode.Kaleidoscope:
        renderKaleidoscope(ctx, width, height, data);
        break;
      case VisualizerMode.PulseTunnel:
        renderPulseTunnel(ctx, width, height, data);
        break;
      case VisualizerMode.Starfall:
        renderStarfall(ctx, width, height, data);
        break;
      case VisualizerMode.Lattice:
        renderLattice(ctx, width, height, data);
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
  }, [mode, isPlaying, audioEngine]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full z-0 block"
    />
  );
};

export default VisualizerCanvas;