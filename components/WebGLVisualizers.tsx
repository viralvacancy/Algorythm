import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { AudioData } from '../types';

// ============================================================================
// NEBULA STORM - Particle-based cosmic nebula with volumetric effects
// ============================================================================

interface NebulaStormProps {
  audioData: AudioData;
  isPlaying: boolean;
}

export const NebulaStorm: React.FC<NebulaStormProps> = ({ audioData, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const coreRef = useRef<THREE.Mesh | null>(null);
  const ringSystemRef = useRef<THREE.Group | null>(null);
  const timeRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const vertexShader = `
    uniform float uTime;
    uniform float uBass;
    uniform float uMid;
    uniform float uTreble;
    
    attribute float size;
    attribute vec3 customColor;
    attribute float phase;
    
    varying vec3 vColor;
    varying float vAlpha;
    
    void main() {
      vColor = customColor;
      
      vec3 pos = position;
      
      // Spiral motion with audio reactivity
      float angle = uTime * 0.5 + phase;
      float radius = length(pos.xz);
      float spiralFactor = sin(radius * 0.1 - uTime) * uBass * 2.0;
      
      pos.x += cos(angle + radius * 0.05) * spiralFactor;
      pos.z += sin(angle + radius * 0.05) * spiralFactor;
      pos.y += sin(uTime * 2.0 + phase * 3.0) * uMid * 1.5;
      
      // Pulse with treble
      float pulse = 1.0 + uTreble * 0.5 * sin(uTime * 10.0 + phase);
      pos *= pulse;
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      
      // Size attenuation
      float sizeAtten = size * (300.0 / -mvPosition.z);
      gl_PointSize = sizeAtten * (1.0 + uBass * 0.5);
      
      vAlpha = smoothstep(800.0, 100.0, -mvPosition.z) * (0.6 + uMid * 0.4);
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;
    
    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      
      // Soft glow falloff
      float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
      
      // Add glow halo
      float glow = exp(-dist * 4.0) * 0.5;
      
      vec3 finalColor = vColor + glow * vColor;
      
      gl_FragColor = vec4(finalColor, alpha + glow * 0.3);
    }
  `;

  const init = useCallback(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000011, 0.0008);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );
    camera.position.z = 500;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create particle system
    const particleCount = 15000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);

    const colorPalette = [
      new THREE.Color(0xff00ff), // Magenta
      new THREE.Color(0x00ffff), // Cyan
      new THREE.Color(0x8800ff), // Purple
      new THREE.Color(0xff0088), // Pink
      new THREE.Color(0x0088ff), // Blue
    ];

    for (let i = 0; i < particleCount; i++) {
      // Distribute in a nebula-like cloud
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = Math.pow(Math.random(), 0.5) * 400;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.4;
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = Math.random() * 8 + 2;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // Central core
    const coreGeometry = new THREE.IcosahedronGeometry(30, 4);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);
    coreRef.current = core;

    // Orbital rings
    const ringGroup = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const ringGeometry = new THREE.TorusGeometry(60 + i * 25, 0.5, 16, 100);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: colorPalette[i % colorPalette.length],
        transparent: true,
        opacity: 0.4,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      ring.rotation.y = Math.random() * Math.PI;
      ringGroup.add(ring);
    }
    scene.add(ringGroup);
    ringSystemRef.current = ringGroup;

  }, []);

  const animate = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

    timeRef.current += 0.016;
    const time = timeRef.current;

    const bass = audioData.bass / 255;
    const mid = audioData.mid / 255;
    const treble = audioData.treble / 255;

    // Update shader uniforms
    if (particlesRef.current) {
      const material = particlesRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = time;
      material.uniforms.uBass.value = bass;
      material.uniforms.uMid.value = mid;
      material.uniforms.uTreble.value = treble;

      particlesRef.current.rotation.y += 0.002 + mid * 0.005;
      particlesRef.current.rotation.x += 0.001 + treble * 0.002;
    }

    // Animate core
    if (coreRef.current) {
      const scale = 1 + bass * 0.5;
      coreRef.current.scale.set(scale, scale, scale);
      coreRef.current.rotation.x += 0.01;
      coreRef.current.rotation.y += 0.02;
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + treble * 0.5;
    }

    // Animate rings
    if (ringSystemRef.current) {
      ringSystemRef.current.children.forEach((ring, i) => {
        ring.rotation.z += 0.005 * (i + 1) * (1 + mid);
        const ringMaterial = (ring as THREE.Mesh).material as THREE.MeshBasicMaterial;
        ringMaterial.opacity = 0.2 + bass * 0.4;
      });
    }

    // Camera movement
    cameraRef.current.position.x = Math.sin(time * 0.1) * 100;
    cameraRef.current.position.y = Math.cos(time * 0.15) * 50;
    cameraRef.current.lookAt(0, 0, 0);

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    frameRef.current = requestAnimationFrame(animate);
  }, [audioData]);

  useEffect(() => {
    init();

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [init]);

  useEffect(() => {
    if (isPlaying) {
      frameRef.current = requestAnimationFrame(animate);
    } else {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    }

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, animate]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
};

// ============================================================================
// WIREFRAME MATRIX - Cyberpunk terrain with vertex displacement
// ============================================================================

interface WireframeMatrixProps {
  audioData: AudioData;
  isPlaying: boolean;
}

export const WireframeMatrix: React.FC<WireframeMatrixProps> = ({ audioData, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const terrainRef = useRef<THREE.Mesh | null>(null);
  const gridLinesRef = useRef<THREE.LineSegments | null>(null);
  const sunRef = useRef<THREE.Mesh | null>(null);
  const timeRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const audioHistoryRef = useRef<number[]>(new Array(128).fill(0));

  const terrainVertexShader = `
    uniform float uTime;
    uniform float uBass;
    uniform float uMid;
    uniform float uTreble;
    uniform float uAudioData[128];
    
    varying vec3 vPosition;
    varying float vElevation;
    
    // Simplex noise functions
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
    
    void main() {
      vPosition = position;
      
      // Get audio sample based on position
      float audioIndex = (position.x + 50.0) / 100.0 * 127.0;
      int idx = int(clamp(audioIndex, 0.0, 127.0));
      float audioSample = uAudioData[idx];
      
      // Multi-layered terrain with audio reactivity
      float noise1 = snoise(vec3(position.x * 0.02, position.z * 0.02 + uTime * 0.5, uTime * 0.1));
      float noise2 = snoise(vec3(position.x * 0.05, position.z * 0.05 + uTime * 0.3, uTime * 0.2)) * 0.5;
      float noise3 = snoise(vec3(position.x * 0.1, position.z * 0.1, uTime * 0.3)) * 0.25;
      
      float terrainNoise = (noise1 + noise2 + noise3) * (5.0 + uBass * 15.0);
      
      // Audio-reactive peaks
      float audioPeak = audioSample * 20.0 * (1.0 + uMid);
      
      // Distance-based wave from center
      float dist = length(position.xz);
      float wave = sin(dist * 0.1 - uTime * 3.0) * uBass * 8.0;
      
      float elevation = terrainNoise + audioPeak + wave;
      vElevation = elevation;
      
      vec3 newPosition = position;
      newPosition.y = elevation;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `;

  const terrainFragmentShader = `
    uniform float uTime;
    uniform float uBass;
    uniform float uTreble;
    
    varying vec3 vPosition;
    varying float vElevation;
    
    void main() {
      // Neon grid color based on elevation and position
      float elevationNorm = (vElevation + 20.0) / 40.0;
      
      // Cyberpunk color palette
      vec3 lowColor = vec3(0.0, 0.5, 1.0);   // Deep blue
      vec3 midColor = vec3(1.0, 0.0, 1.0);   // Magenta
      vec3 highColor = vec3(0.0, 1.0, 1.0);  // Cyan
      
      vec3 color;
      if (elevationNorm < 0.5) {
        color = mix(lowColor, midColor, elevationNorm * 2.0);
      } else {
        color = mix(midColor, highColor, (elevationNorm - 0.5) * 2.0);
      }
      
      // Add glow based on audio
      float glow = uBass * 0.5 + uTreble * 0.3;
      color += glow * 0.3;
      
      // Scanline effect
      float scanline = sin(vPosition.z * 2.0 + uTime * 5.0) * 0.1 + 0.9;
      color *= scanline;
      
      gl_FragColor = vec4(color, 0.9);
    }
  `;

  const init = useCallback(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);
    scene.fog = new THREE.Fog(0x000011, 50, 200);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 30, 60);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create terrain
    const terrainGeometry = new THREE.PlaneGeometry(100, 200, 128, 128);
    terrainGeometry.rotateX(-Math.PI / 2);

    const terrainMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uAudioData: { value: new Array(128).fill(0) },
      },
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      wireframe: true,
      transparent: true,
    });

    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrain.position.z = -50;
    scene.add(terrain);
    terrainRef.current = terrain;

    // Horizontal grid lines
    const gridGeometry = new THREE.BufferGeometry();
    const gridPositions: number[] = [];
    const gridCount = 40;
    
    for (let i = 0; i < gridCount; i++) {
      const z = (i / gridCount) * 200 - 150;
      gridPositions.push(-50, 0, z, 50, 0, z);
    }
    
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
    const gridMaterial = new THREE.LineBasicMaterial({ 
      color: 0xff00ff, 
      transparent: true, 
      opacity: 0.3 
    });
    const gridLines = new THREE.LineSegments(gridGeometry, gridMaterial);
    scene.add(gridLines);
    gridLinesRef.current = gridLines;

    // Retro sun
    const sunGeometry = new THREE.CircleGeometry(30, 64);
    const sunMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float y = vUv.y;
          vec3 topColor = vec3(1.0, 0.4, 0.1);
          vec3 bottomColor = vec3(1.0, 0.0, 0.5);
          vec3 color = mix(bottomColor, topColor, y);
          
          // Horizontal lines
          float lines = step(0.5, fract(y * 15.0 - uTime * 0.5));
          color *= 0.7 + lines * 0.3;
          
          // Bottom cutoff
          float cutoff = smoothstep(0.0, 0.5, y);
          
          gl_FragColor = vec4(color, cutoff);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
    
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(0, 25, -150);
    scene.add(sun);
    sunRef.current = sun;

    // Stars
    const starsGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 400;
      starPositions[i * 3 + 1] = Math.random() * 100 + 20;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 400 - 50;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

  }, []);

  const animate = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

    timeRef.current += 0.016;
    const time = timeRef.current;

    const bass = audioData.bass / 255;
    const mid = audioData.mid / 255;
    const treble = audioData.treble / 255;

    // Update audio history for terrain
    const freqData = audioData.frequencyData;
    for (let i = 0; i < 128 && i < freqData.length; i++) {
      audioHistoryRef.current[i] = freqData[i] / 255;
    }

    // Update terrain uniforms
    if (terrainRef.current) {
      const material = terrainRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = time;
      material.uniforms.uBass.value = bass;
      material.uniforms.uMid.value = mid;
      material.uniforms.uTreble.value = treble;
      material.uniforms.uAudioData.value = audioHistoryRef.current;

      // Move terrain towards camera for infinite scroll effect
      terrainRef.current.position.z += 0.5 + bass * 0.5;
      if (terrainRef.current.position.z > 50) {
        terrainRef.current.position.z = -50;
      }
    }

    // Update grid
    if (gridLinesRef.current) {
      gridLinesRef.current.position.z += 0.5 + bass * 0.5;
      if (gridLinesRef.current.position.z > 5) {
        gridLinesRef.current.position.z = 0;
      }
      (gridLinesRef.current.material as THREE.LineBasicMaterial).opacity = 0.2 + bass * 0.3;
    }

    // Update sun
    if (sunRef.current) {
      const sunMaterial = sunRef.current.material as THREE.ShaderMaterial;
      sunMaterial.uniforms.uTime.value = time;
      const scale = 1 + bass * 0.2;
      sunRef.current.scale.set(scale, scale, 1);
    }

    // Camera bob
    cameraRef.current.position.y = 30 + Math.sin(time * 0.5) * 3 + bass * 5;
    cameraRef.current.rotation.z = Math.sin(time * 0.3) * 0.02;

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    frameRef.current = requestAnimationFrame(animate);
  }, [audioData]);

  useEffect(() => {
    init();

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [init]);

  useEffect(() => {
    if (isPlaying) {
      frameRef.current = requestAnimationFrame(animate);
    } else {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    }

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, animate]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
};

// ============================================================================
// FRACTAL COSMOS - Raymarched fractal with real-time audio modulation
// ============================================================================

interface FractalCosmosProps {
  audioData: AudioData;
  isPlaying: boolean;
}

export const FractalCosmos: React.FC<FractalCosmosProps> = ({ audioData, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const timeRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const fragmentShader = `
    precision highp float;
    
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uBass;
    uniform float uMid;
    uniform float uTreble;
    uniform float uRms;
    
    #define MAX_STEPS 100
    #define MAX_DIST 100.0
    #define SURF_DIST 0.001
    #define PI 3.14159265359
    
    // Rotation matrix
    mat2 rot2D(float a) {
      float s = sin(a), c = cos(a);
      return mat2(c, -s, s, c);
    }
    
    // Mandelbulb distance estimator
    float mandelbulb(vec3 p, float power) {
      vec3 z = p;
      float dr = 1.0;
      float r = 0.0;
      
      for (int i = 0; i < 8; i++) {
        r = length(z);
        if (r > 2.0) break;
        
        float theta = acos(z.z / r) + uTime * 0.1;
        float phi = atan(z.y, z.x) + uTime * 0.15;
        dr = pow(r, power - 1.0) * power * dr + 1.0;
        
        float zr = pow(r, power);
        theta = theta * power;
        phi = phi * power;
        
        z = zr * vec3(
          sin(theta) * cos(phi),
          sin(phi) * sin(theta),
          cos(theta)
        );
        z += p;
      }
      
      return 0.5 * log(r) * r / dr;
    }
    
    // Scene SDF
    float scene(vec3 p) {
      // Rotate based on time and audio
      p.xy *= rot2D(uTime * 0.2 + uMid * 0.5);
      p.xz *= rot2D(uTime * 0.15 + uBass * 0.3);
      
      // Dynamic power based on audio
      float power = 8.0 + uBass * 4.0 + sin(uTime * 0.5) * 2.0;
      
      float d = mandelbulb(p, power);
      
      // Add audio-reactive displacement
      d += sin(p.x * 10.0 + uTime) * sin(p.y * 10.0) * sin(p.z * 10.0) * 0.02 * uTreble;
      
      return d;
    }
    
    // Normal calculation
    vec3 getNormal(vec3 p) {
      float d = scene(p);
      vec2 e = vec2(0.001, 0);
      vec3 n = d - vec3(
        scene(p - e.xyy),
        scene(p - e.yxy),
        scene(p - e.yyx)
      );
      return normalize(n);
    }
    
    // Raymarching
    float rayMarch(vec3 ro, vec3 rd) {
      float dO = 0.0;
      
      for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * dO;
        float dS = scene(p);
        dO += dS;
        if (dO > MAX_DIST || dS < SURF_DIST) break;
      }
      
      return dO;
    }
    
    // Ambient occlusion
    float getAO(vec3 p, vec3 n) {
      float occ = 0.0;
      float sca = 1.0;
      for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        float d = scene(p + h * n);
        occ += (h - d) * sca;
        sca *= 0.95;
      }
      return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
    }
    
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
      
      // Camera setup
      float camDist = 2.5 - uBass * 0.5;
      vec3 ro = vec3(
        sin(uTime * 0.3) * camDist,
        cos(uTime * 0.2) * camDist * 0.5,
        cos(uTime * 0.3) * camDist
      );
      
      vec3 lookAt = vec3(0.0);
      vec3 forward = normalize(lookAt - ro);
      vec3 right = normalize(cross(vec3(0, 1, 0), forward));
      vec3 up = cross(forward, right);
      
      vec3 rd = normalize(forward + uv.x * right + uv.y * up);
      
      // Background gradient
      vec3 col = vec3(0.0);
      float bgGrad = length(uv) * 0.5;
      col = mix(
        vec3(0.05, 0.0, 0.1),
        vec3(0.0, 0.0, 0.05),
        bgGrad
      );
      
      // Raymarching
      float d = rayMarch(ro, rd);
      
      if (d < MAX_DIST) {
        vec3 p = ro + rd * d;
        vec3 n = getNormal(p);
        
        // Lighting
        vec3 lightPos = vec3(2.0, 3.0, -2.0);
        vec3 lightDir = normalize(lightPos - p);
        
        float diff = max(dot(n, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 32.0);
        float ao = getAO(p, n);
        
        // Dynamic coloring based on audio
        vec3 baseColor = vec3(0.5 + uBass * 0.5, 0.2 + uMid * 0.3, 0.8 + uTreble * 0.2);
        
        // Fresnel effect
        float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
        vec3 fresnelColor = vec3(0.0, 1.0, 1.0) * fresnel;
        
        // Color based on position and normal
        vec3 posColor = 0.5 + 0.5 * sin(vec3(0.0, 2.0, 4.0) + p.x * 2.0 + uTime);
        vec3 normColor = 0.5 + 0.5 * n;
        
        col = baseColor * diff * ao;
        col += spec * vec3(1.0, 0.8, 0.9) * (1.0 + uTreble);
        col += fresnelColor * (0.3 + uMid * 0.3);
        col = mix(col, posColor * normColor, 0.3);
        
        // Glow effect
        float glow = 1.0 / (1.0 + d * d * 0.1);
        col += glow * vec3(0.2, 0.1, 0.3) * uRms;
      }
      
      // Post-processing
      // Vignette
      float vig = 1.0 - length(uv) * 0.5;
      col *= vig;
      
      // Chromatic aberration on beat
      if (uBass > 0.5) {
        vec2 offset = uv * 0.01 * uBass;
        col.r = col.r;
        col.b = col.b;
      }
      
      // Gamma correction
      col = pow(col, vec3(0.8));
      
      // Add subtle noise
      float noise = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
      col += noise * 0.02;
      
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const vertexShader = `
    void main() {
      gl_Position = vec4(position, 1.0);
    }
  `;

  const init = useCallback(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Orthographic camera for fullscreen quad
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uRms: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

  }, []);

  const animate = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !meshRef.current) return;

    timeRef.current += 0.016;

    const bass = audioData.bass / 255;
    const mid = audioData.mid / 255;
    const treble = audioData.treble / 255;
    const rms = audioData.rms / 255;

    const material = meshRef.current.material as THREE.ShaderMaterial;
    material.uniforms.uTime.value = timeRef.current;
    material.uniforms.uBass.value = bass;
    material.uniforms.uMid.value = mid;
    material.uniforms.uTreble.value = treble;
    material.uniforms.uRms.value = rms;

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    frameRef.current = requestAnimationFrame(animate);
  }, [audioData]);

  useEffect(() => {
    init();

    const handleResize = () => {
      if (!rendererRef.current || !meshRef.current) return;
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [init]);

  useEffect(() => {
    if (isPlaying) {
      frameRef.current = requestAnimationFrame(animate);
    } else {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    }

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, animate]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
};
