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

interface AuroraBand {
  points: number[];
  hue: number;
  sway: number;
}

const VisualizerCanvas: React.FC<Props> = ({ audioEngine, mode, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);
  
  // Particles for Kaleidoscope Mode
  const kaleidoscopeParticlesRef = useRef<KaleidoscopeParticle[]>([]);
  // Aurora ribbons for Grid mode replacement
  const auroraBandsRef = useRef<AuroraBand[]>([]);

  // Cleanup state on mode change
  useEffect(() => {
    kaleidoscopeParticlesRef.current = [];
    auroraBandsRef.current = [];
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

  const renderGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, data: AudioData) => {
    // Aurora ribbons flowing across the screen
    if (auroraBandsRef.current.length === 0) {
      auroraBandsRef.current = Array.from({ length: 4 }).map((_, i) => ({
        points: Array.from({ length: 40 }).map(() => Math.random() * 0.4),
        hue: 180 + i * 35,
        sway: Math.random() * Math.PI * 2,
      }));
    }

    const bass = data.bass / 255;
    const mid = data.mid / 255;
    const treble = data.treble / 255;
    const energy = Math.max(bass, mid * 0.9, treble * 0.8);

    // Background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#050512');
    skyGrad.addColorStop(0.4, '#0a0f2b');
    skyGrad.addColorStop(1, '#050910');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Misty glow reacting to bass hits
    ctx.save();
    ctx.globalAlpha = 0.12 + energy * 0.25;
    ctx.filter = 'blur(60px)';
    ctx.fillStyle = `hsl(${200 + bass * 60}, 80%, ${40 + mid * 20}%)`;
    ctx.beginPath();
    ctx.ellipse(width / 2, height * (0.55 - bass * 0.15), width * 0.9, height * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Twinkling stars
    ctx.save();
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + Date.now() * 0.02) % width;
      const y = (i * 53) % Math.floor(height * 0.45);
      const sparkle = 0.4 + Math.sin((Date.now() + i * 200) * 0.003) * 0.2;
      ctx.fillStyle = `rgba(255,255,255,${sparkle})`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();

    auroraBandsRef.current.forEach((band, bandIndex) => {
      const baseY = height * (0.35 + bandIndex * 0.12);
      const maxPoints = 140;
      const newPoint = 0.2 + energy * 0.8 + Math.sin(band.sway + rotationRef.current * 2 + bandIndex) * 0.15;

      band.points.push(newPoint);
      if (band.points.length > maxPoints) band.points.shift();

      band.sway += 0.01 + treble * 0.02;

      const len = band.points.length;
      if (len < 2) return;

      const step = width / (len - 1);
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, `hsla(${band.hue}, 80%, 60%, ${0.4 + energy * 0.3})`);
      grad.addColorStop(0.5, `hsla(${band.hue + 30}, 90%, 70%, ${0.8 + treble * 0.2})`);
      grad.addColorStop(1, `hsla(${band.hue + 60}, 80%, 60%, ${0.4 + energy * 0.3})`);

      ctx.save();
      ctx.lineWidth = 2 + bandIndex * 0.5 + energy * 2;
      ctx.shadowBlur = 30 + energy * 40;
      ctx.shadowColor = `hsla(${band.hue + 20}, 90%, 60%, 0.9)`;
      ctx.strokeStyle = grad;
      ctx.globalCompositeOperation = 'screen';

      ctx.beginPath();
      let prevX = 0;
      let prevY = baseY;
      for (let i = 0; i < len; i++) {
        const x = i * step;
        const amplitude = band.points[i];
        const y = baseY - Math.sin(i * 0.18 + rotationRef.current * 3) * 25 - amplitude * (height * 0.22 + bandIndex * 10);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const cpX = prevX + step / 2;
          const cpY = (prevY + y) / 2;
          ctx.quadraticCurveTo(cpX, cpY, x, y);
        }

        prevX = x;
        prevY = y;
      }

      ctx.stroke();
      ctx.restore();
    });

    // Bass ripples
    const rippleCount = Math.min(3, Math.floor(bass * 5));
    ctx.save();
    ctx.translate(width / 2, height * 0.65);
    for (let i = 0; i < rippleCount; i++) {
      const radius = (i + 1) * (60 + bass * 140);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 255, 255, ${0.25 - i * 0.05})`;
      ctx.lineWidth = 1 + bass * 3;
      ctx.stroke();
    }
    ctx.restore();
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
    } else if (mode === VisualizerMode.Grid) {
         ctx.clearRect(0,0,width,height);
    } 
    // Spectrogram/Circular/Waveform now handle their own full clears in their render methods
    // to prevent artifacting or ghosting when switching.

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
      case VisualizerMode.Grid:
        renderGrid(ctx, width, height, data);
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