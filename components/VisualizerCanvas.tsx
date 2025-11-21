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

const VisualizerCanvas: React.FC<Props> = ({ audioEngine, mode, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);
  
  // History for Grid Mode
  const gridHistoryRef = useRef<Uint8Array[]>([]);
  // Particles for Kaleidoscope Mode
  const kaleidoscopeParticlesRef = useRef<KaleidoscopeParticle[]>([]);

  // Cleanup state on mode change
  useEffect(() => {
    gridHistoryRef.current = [];
    kaleidoscopeParticlesRef.current = [];
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
    // 1. Update History
    const slicesToKeep = 80; 
    const pointsPerSlice = 60; 
    
    const slice = new Uint8Array(pointsPerSlice);
    const binSize = Math.floor((data.frequencyData.length / 4) / pointsPerSlice); 
    
    for(let i=0; i<pointsPerSlice; i++) {
        let sum = 0;
        for(let j=0; j<binSize; j++) sum += data.frequencyData[i*binSize + j];
        slice[i] = sum / binSize;
    }
    
    gridHistoryRef.current.unshift(slice);
    if (gridHistoryRef.current.length > slicesToKeep) {
        gridHistoryRef.current.pop();
    }

    // 2. Setup Perspective
    const cx = width / 2;
    const horizonY = height * 0.25; 
    
    const bassKick = data.bass / 255;
    
    // Enhanced Responsiveness
    // More aggressive shake only on hard hits
    const shakeThreshold = 0.6;
    const shakeIntensity = bassKick > shakeThreshold ? Math.pow((bassKick - shakeThreshold) * 2, 2) * 30 : 0;
    const shakeX = (Math.random() - 0.5) * shakeIntensity;
    const shakeY = (Math.random() - 0.5) * shakeIntensity;
    
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Background Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#000010');
    skyGrad.addColorStop(0.25, '#200030'); 
    skyGrad.addColorStop(1, '#000'); 
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Sun - Pulsing
    const sunSize = height * 0.15 + bassKick * 80; // More expansion
    const sunY = horizonY - height * 0.05; 
    const sunGrad = ctx.createLinearGradient(cx, sunY - sunSize, cx, sunY + sunSize);
    const sunHue = 280 + bassKick * 60; 
    sunGrad.addColorStop(0, `hsl(60, 100%, 80%)`);
    sunGrad.addColorStop(0.5, `hsl(${sunHue}, 100%, 60%)`);
    sunGrad.addColorStop(1, `hsl(${sunHue}, 100%, 40%)`);
    
    ctx.shadowBlur = 40 + bassKick * 60;
    ctx.shadowColor = `hsl(${sunHue}, 100%, 60%)`;
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(cx, sunY, sunSize, 0, Math.PI*2);
    ctx.fill();

    // Horizon Line
    ctx.shadowBlur = 20 + bassKick * 20;
    ctx.shadowColor = '#00ffff';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2 + bassKick * 2;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.stroke();

    // 3. Draw 3D Grid
    const gridWidth = width * 12; 
    const cameraAltitude = height * 0.9; 
    
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;

    // Longitudinal Lines
    for(let xIndex = 0; xIndex < pointsPerSlice; xIndex++) {
         ctx.beginPath();
         let firstPoint = true;
         
         for(let zIndex = 0; zIndex < gridHistoryRef.current.length; zIndex++) {
             const val = gridHistoryRef.current[zIndex][xIndex];
             const zProgress = zIndex / slicesToKeep;
             const z = 0.1 + Math.pow(zProgress, 1.1) * 4.0; 
             const scale = 1 / z;
             
             const xNorm = (xIndex / pointsPerSlice) - 0.5;
             const xScreen = cx + xNorm * gridWidth * scale;
             
             // Terrain Height Multiplier - drastically increases on beats
             const terrainMult = 1.2 + bassKick * 2.5; 
             const yNorm = (val / 255) * terrainMult; 

             const yGround = horizonY + cameraAltitude * scale;
             const yScreen = yGround - (yNorm * height * 0.5) * scale;

             if (firstPoint) {
                 ctx.moveTo(xScreen, yScreen);
                 firstPoint = false;
             } else {
                 ctx.lineTo(xScreen, yScreen);
             }
         }
         ctx.strokeStyle = `rgba(0, 240, 255, 0.3)`;
         ctx.stroke();
    }

    // Latitudinal Lines
    for(let zIndex = 0; zIndex < gridHistoryRef.current.length; zIndex++) {
        if (zIndex % 2 !== 0) continue; 
        
        const slice = gridHistoryRef.current[zIndex];
        const zProgress = zIndex / slicesToKeep;
        const z = 0.1 + Math.pow(zProgress, 1.1) * 4.0;
        const scale = 1 / z;
        
        const alpha = Math.max(0, 1 - Math.pow(zProgress, 0.5));

        ctx.beginPath();
        
        for(let xIndex = 0; xIndex < pointsPerSlice; xIndex++) {
             const val = slice[xIndex];
             const xNorm = (xIndex / pointsPerSlice) - 0.5;
             const xScreen = cx + xNorm * gridWidth * scale;
             
             const terrainMult = 1.2 + bassKick * 2.5;
             const yNorm = (val / 255) * terrainMult; 
             const yGround = horizonY + cameraAltitude * scale;
             const yScreen = yGround - (yNorm * height * 0.5) * scale;
             
             if (xIndex === 0) ctx.moveTo(xScreen, yScreen);
             else ctx.lineTo(xScreen, yScreen);
        }
        
        if (zIndex === 0) {
            ctx.strokeStyle = '#ff00aa';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff00aa';
            ctx.lineWidth = 2;
        } else {
            ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1.5;
        }
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