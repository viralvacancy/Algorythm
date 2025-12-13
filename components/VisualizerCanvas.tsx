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

interface BubbleParticle {
  x: number;
  y: number;
  radius: number;
  drift: number;
  life: number;
  speed: number;
}

interface VoxelArmNode {
  x: number;
  y: number;
  size: number;
  depth: number;
  hue: number;
}

const VisualizerCanvas: React.FC<Props> = ({ audioEngine, mode, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);

  // Particles for Kaleidoscope Mode
  const kaleidoscopeParticlesRef = useRef<KaleidoscopeParticle[]>([]);
  const bubbleFieldRef = useRef<BubbleParticle[]>([]);
  const waterPhaseRef = useRef<number>(0);
  const octopusPulseRef = useRef<number>(0);

  // Cleanup state on mode change
  useEffect(() => {
    kaleidoscopeParticlesRef.current = [];
    bubbleFieldRef.current = [];
    waterPhaseRef.current = 0;
    octopusPulseRef.current = 0;
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

  const renderTidalBloom = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    const bass = data.bass / 255;
    const mid = data.mid / 255;
    const treble = data.treble / 255;
    waterPhaseRef.current += 0.01 + mid * 0.03;
    const t = waterPhaseRef.current;

    // Deep ocean gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#031320');
    bg.addColorStop(0.35, '#042742');
    bg.addColorStop(1, '#030b16');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Light shafts responding to treble
    const shafts = 6;
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < shafts; i++) {
      const phase = t * 0.5 + i * 0.7;
      const x = (Math.sin(phase) * 0.4 + 0.5) * width;
      const w = width * (0.05 + treble * 0.08);
      const grad = ctx.createLinearGradient(x - w, 0, x + w, height);
      grad.addColorStop(0, 'rgba(20,120,200,0)');
      grad.addColorStop(0.5, `rgba(80,200,255,${0.08 + treble * 0.2})`);
      grad.addColorStop(1, 'rgba(20,120,200,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - w, 0, w * 2, height);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Caustic lattice driven by bass
    const cellSize = 36;
    for (let y = 0; y < height; y += cellSize) {
      for (let x = 0; x < width; x += cellSize) {
        const wave =
          Math.sin((x * 0.02 + t * 3) + Math.cos(y * 0.03 + t * 2)) +
          Math.cos((y * 0.02 + t * 2) + Math.sin(x * 0.04 + t));
        const intensity = (wave * 0.5 + 0.5) * (0.2 + bass * 0.7);
        ctx.strokeStyle = `rgba(100, 220, 255, ${intensity})`;
        ctx.lineWidth = 1.2 + bass * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y + cellSize / 2 + wave * 3);
        ctx.lineTo(x + cellSize, y + cellSize / 2 - wave * 3);
        ctx.stroke();
      }
    }

    // Surface shimmer
    const shimmerHeight = height * 0.35;
    for (let i = 0; i < 40; i++) {
      const px = (i / 40) * width;
      const py = Math.sin(t * 2 + i * 0.6) * 8 + 16;
      ctx.strokeStyle = `rgba(180, 240, 255, ${0.06 + treble * 0.2})`;
      ctx.lineWidth = 2 + mid * 1.5;
      ctx.beginPath();
      ctx.moveTo(px - 20, py);
      ctx.lineTo(px + 20, py + 6);
      ctx.stroke();
    }

    // Bubbles rising
    if (bubbleFieldRef.current.length < 120 && Math.random() < 0.6 + treble * 0.3) {
      bubbleFieldRef.current.push({
        x: Math.random() * width,
        y: height + 10,
        radius: 2 + Math.random() * 6 + bass * 4,
        drift: Math.random() * 0.6 - 0.3,
        life: 1,
        speed: 1 + Math.random() * 1.5 + bass * 1.5,
      });
    }

    bubbleFieldRef.current = bubbleFieldRef.current.filter((b) => b.life > 0);
    bubbleFieldRef.current.forEach((b) => {
      b.y -= b.speed;
      b.x += b.drift + Math.sin(t + b.y * 0.01) * 0.4;
      b.life -= 0.004 + treble * 0.01;
      ctx.fillStyle = `rgba(200, 240, 255, ${0.3 + b.life * 0.7})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * (1 + bass * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.4, b.radius * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Depth fog
    const fog = ctx.createLinearGradient(0, 0, 0, height);
    fog.addColorStop(0, 'rgba(0,0,0,0)');
    fog.addColorStop(1, 'rgba(0,5,12,0.6)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, width, height);
  };

  const drawVoxel = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, hue: number, depth: number) => {
    const light = 0.7 + Math.sin(depth * 0.5) * 0.1;
    const top = `hsl(${hue}, 80%, ${50 * light}%)`;
    const left = `hsl(${hue}, 70%, ${35 * light}%)`;
    const right = `hsl(${hue}, 70%, ${30 * light}%)`;

    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.6);
    ctx.lineTo(x + size, y - size);
    ctx.lineTo(x + size * 2, y - size * 0.6);
    ctx.lineTo(x + size, y);
    ctx.closePath();
    ctx.fillStyle = top;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.6);
    ctx.lineTo(x, y + size * 0.6);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x + size, y);
    ctx.closePath();
    ctx.fillStyle = left;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + size, y);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x + size * 2, y + size * 0.6);
    ctx.lineTo(x + size * 2, y - size * 0.6);
    ctx.closePath();
    ctx.fillStyle = right;
    ctx.fill();
  };

  const renderVoxelOctopus = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    const bass = data.bass / 255;
    const mid = data.mid / 255;
    const treble = data.treble / 255;
    octopusPulseRef.current += 0.01 + mid * 0.03;
    const t = octopusPulseRef.current;
    const cx = width / 2;
    const cy = height * 0.6;
    const minDim = Math.min(width, height);

    // Abyss background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#021022');
    bg.addColorStop(0.45, '#031c2f');
    bg.addColorStop(1, '#010813');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // God rays
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i++) {
      const ang = i * 0.6 + Math.sin(t * 0.7) * 0.3;
      const rayX = cx + Math.sin(ang) * width * 0.5;
      const grad = ctx.createLinearGradient(rayX, 0, cx, cy);
      grad.addColorStop(0, 'rgba(20, 90, 150, 0)');
      grad.addColorStop(1, `rgba(80, 200, 255, ${0.08 + treble * 0.25})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(rayX - width * 0.15, 0);
      ctx.lineTo(rayX + width * 0.15, 0);
      ctx.lineTo(cx + width * 0.1, cy);
      ctx.lineTo(cx - width * 0.1, cy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Suspended particles
    ctx.fillStyle = 'rgba(160, 210, 240, 0.08)';
    for (let i = 0; i < 140; i++) {
      const px = ((i * 83 + Math.sin(t + i) * 60) % width + width) % width;
      const py = (((i * 57 + Math.cos(t * 0.5 + i * 0.4) * 40) % height + height) % height) * 0.8;
      ctx.globalAlpha = 0.1 + Math.sin(t + i) * 0.08 + treble * 0.2;
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.globalAlpha = 1;

    const bodySize = minDim * 0.08 * (1 + bass * 0.25);
    const bodyHue = 300 + treble * 40;
    drawVoxel(ctx, cx - bodySize, cy - bodySize * 0.3, bodySize, bodyHue, 0);
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${0.1 + treble * 0.3})`;
    ctx.ellipse(cx, cy - bodySize * 0.6, bodySize * 0.8, bodySize * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    const arms = 8;
    const segments = 14;
    const armLength = minDim * 0.35;
    const cubeBase = minDim * 0.018;

    const nodes: VoxelArmNode[] = [];
    for (let i = 0; i < arms; i++) {
      const baseAngle = (i / arms) * Math.PI * 2 + Math.sin(t * 0.4) * 0.2;
      for (let j = 0; j < segments; j++) {
        const p = j / segments;
        const radius = armLength * p;
        const wave = Math.sin(t * 2 + p * 6 + i) * 0.15 + bass * 0.35;
        const sway = Math.sin(t + p * 8 + i * 0.5) * 0.4 * (0.6 + mid);
        const angle = baseAngle + wave + sway * 0.2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius * 0.6 + Math.cos(p * 5 + t) * 6;
        const size = cubeBase * (1 - p * 0.6) * (1 + bass * 0.2);
        const depth = p + Math.sin(t + i) * 0.1;
        nodes.push({ x, y, size, depth, hue: bodyHue + p * 20 });
      }
    }

    nodes.sort((a, b) => a.depth - b.depth);
    nodes.forEach((n) => drawVoxel(ctx, n.x - n.size, n.y - n.size * 0.3, n.size, n.hue, n.depth));

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - bodySize * 0.4, cy - bodySize * 0.4, bodySize * 0.14, 0, Math.PI * 2);
    ctx.arc(cx + bodySize * 0.4, cy - bodySize * 0.4, bodySize * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx - bodySize * 0.35, cy - bodySize * 0.35, bodySize * 0.08, 0, Math.PI * 2);
    ctx.arc(cx + bodySize * 0.35, cy - bodySize * 0.35, bodySize * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Bioluminescent freckles reacting to treble
    const freckles = 24;
    for (let i = 0; i < freckles; i++) {
      const ang = (i / freckles) * Math.PI * 2;
      const r = bodySize * (0.2 + Math.random() * 0.5);
      const fx = cx + Math.cos(ang) * r;
      const fy = cy - bodySize * 0.4 + Math.sin(ang) * r * 0.6;
      ctx.fillStyle = `hsla(${bodyHue + 80}, 100%, 70%, ${0.2 + treble * 0.6})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 2 + treble * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rising bubbles near arms
    if (Math.random() < 0.5 + treble * 0.4) {
      bubbleFieldRef.current.push({
        x: cx + (Math.random() - 0.5) * minDim * 0.6,
        y: cy + minDim * 0.1,
        radius: 1 + Math.random() * 4,
        drift: Math.random() * 0.4 - 0.2,
        life: 1,
        speed: 1 + Math.random() * 1.2,
      });
    }

    bubbleFieldRef.current = bubbleFieldRef.current.filter((b) => b.life > 0);
    bubbleFieldRef.current.forEach((b) => {
      b.y -= b.speed;
      b.x += b.drift;
      b.life -= 0.008 + treble * 0.015;
      ctx.fillStyle = `rgba(200,230,255,${0.25 + b.life * 0.6})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
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

    // Context clearing logic per mode
    if (mode === VisualizerMode.Kaleidoscope) {
         ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
         ctx.fillRect(0, 0, width, height);
    } else if (mode === VisualizerMode.TidalBloom) {
         ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
         ctx.fillRect(0,0,width,height);
    } else {
         ctx.clearRect(0,0,width,height);
    }
    // Spectrogram/Circular/Waveform/PulseTunnel handle their own clears inside render methods.

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
      case VisualizerMode.TidalBloom:
        renderTidalBloom(ctx, width, height, data);
        break;
      case VisualizerMode.VoxelOctopus:
        renderVoxelOctopus(ctx, width, height, data);
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