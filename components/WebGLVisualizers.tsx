import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { AudioData } from '../types';

// ============================================================================
// WIREFRAME MATRIX - Cyberpunk terrain with vertex displacement (FIXED)
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
        const canvas = rendererRef.current.domElement;
        if (canvas.parentElement === containerRef.current) {
          containerRef.current.removeChild(canvas);
        }
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
// PARTICLE GALAXY - Spiraling galaxy of audio-reactive particles
// ============================================================================

interface ParticleGalaxyProps {
  audioData: AudioData;
  isPlaying: boolean;
}

export const ParticleGalaxy: React.FC<ParticleGalaxyProps> = ({ audioData, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
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
    attribute float radius;
    
    varying vec3 vColor;
    varying float vAlpha;
    
    void main() {
      vColor = customColor;
      
      vec3 pos = position;
      
      // Spiral rotation
      float angle = uTime * 0.3 + phase + radius * 0.5;
      float newX = cos(angle) * radius;
      float newZ = sin(angle) * radius;
      
      pos.x = newX + sin(uTime * 2.0 + phase) * uTreble * 2.0;
      pos.y = position.y + sin(uTime + phase * 2.0) * uMid * 3.0;
      pos.z = newZ + cos(uTime * 1.5 + phase) * uTreble * 2.0;
      
      // Pulse outward with bass
      float pulse = 1.0 + uBass * 0.3;
      pos *= pulse;
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      
      // Size attenuation with audio reactivity
      float sizeAtten = size * (400.0 / -mvPosition.z);
      gl_PointSize = sizeAtten * (1.0 + uBass * 0.6 + uTreble * 0.4);
      
      vAlpha = smoothstep(1000.0, 100.0, -mvPosition.z) * (0.5 + uMid * 0.5);
      
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
      
      // Add bright core
      float core = exp(-dist * 12.0) * 0.8;
      
      // Add glow halo
      float glow = exp(-dist * 3.0) * 0.4;
      
      vec3 finalColor = vColor * (1.0 + core * 2.0 + glow);
      
      gl_FragColor = vec4(finalColor, alpha + core * 0.5);
    }
  `;

  const init = useCallback(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005);
    scene.fog = new THREE.FogExp2(0x000008, 0.0005);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );
    camera.position.z = 600;
    camera.position.y = 200;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create particle system
    const particleCount = 20000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);
    const radii = new Float32Array(particleCount);

    const colorPalette = [
      new THREE.Color(0x6666ff), // Blue
      new THREE.Color(0xff00ff), // Magenta
      new THREE.Color(0x00ffff), // Cyan
      new THREE.Color(0xff66ff), // Pink
      new THREE.Color(0x4444ff), // Deep Blue
      new THREE.Color(0x00ff88), // Teal
    ];

    for (let i = 0; i < particleCount; i++) {
      // Create spiral galaxy distribution
      const radius = Math.pow(Math.random(), 0.7) * 500;
      const spinAngle = radius * 0.02 + Math.random() * Math.PI * 2;
      const branchAngle = (Math.floor(Math.random() * 5) / 5) * Math.PI * 2;
      
      const randomRadius = Math.pow(Math.random(), 3) * 40;
      const randomAngle = Math.random() * Math.PI * 2;
      const randomY = (Math.random() - 0.5) * 80;

      positions[i * 3] = Math.cos(branchAngle + spinAngle) * radius + Math.cos(randomAngle) * randomRadius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 80 + randomY;
      positions[i * 3 + 2] = Math.sin(branchAngle + spinAngle) * radius + Math.sin(randomAngle) * randomRadius;

      // Color based on distance from center
      const colorIndex = Math.floor(radius / 100) % colorPalette.length;
      const color = colorPalette[colorIndex];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = Math.random() * 4 + 2;
      phases[i] = Math.random() * Math.PI * 2;
      radii[i] = radius;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('radius', new THREE.BufferAttribute(radii, 1));

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

      // Rotate the entire galaxy
      particlesRef.current.rotation.y = time * 0.05 + mid * 0.02;
      particlesRef.current.rotation.x = Math.sin(time * 0.2) * 0.1 + bass * 0.1;
    }

    // Camera orbit
    cameraRef.current.position.x = Math.sin(time * 0.1) * 300;
    cameraRef.current.position.z = Math.cos(time * 0.1) * 600;
    cameraRef.current.position.y = 200 + Math.sin(time * 0.15) * 100;
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
        const canvas = rendererRef.current.domElement;
        if (canvas.parentElement === containerRef.current) {
          containerRef.current.removeChild(canvas);
        }
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
// CRYSTAL LATTICE - Geometric crystal formation with audio modulation
// ============================================================================

interface CrystalLatticeProps {
  audioData: AudioData;
  isPlaying: boolean;
}

export const CrystalLattice: React.FC<CrystalLatticeProps> = ({ audioData, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const crystalsRef = useRef<THREE.InstancedMesh | null>(null);
  const dummyRef = useRef(new THREE.Object3D());
  const timeRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const crystalDataRef = useRef<{ x: number; y: number; z: number; phase: number; index: number }[]>([]);

  const init = useCallback(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000510);
    scene.fog = new THREE.Fog(0x000510, 20, 100);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      300
    );
    camera.position.set(0, 0, 50);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create crystal lattice
    const gridSize = 12;
    const spacing = 4.5;
    const count = gridSize * gridSize * gridSize;
    
    // Use octahedron for crystal shape
    const geometry = new THREE.OctahedronGeometry(0.8, 0);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      wireframe: true,
      vertexColors: true,
    });
    
    const instanced = new THREE.InstancedMesh(geometry, material, count);
    const dummy = dummyRef.current;
    const color = new THREE.Color();

    crystalDataRef.current = [];
    let idx = 0;
    
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          const offsetX = (x - gridSize / 2) * spacing;
          const offsetY = (y - gridSize / 2) * spacing;
          const offsetZ = (z - gridSize / 2) * spacing;
          
          dummy.position.set(offsetX, offsetY, offsetZ);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
          );
          dummy.updateMatrix();
          instanced.setMatrixAt(idx, dummy.matrix);

          // Color based on position
          const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ);
          const hue = 0.5 + (dist / (gridSize * spacing)) * 0.3 + (y / gridSize) * 0.2;
          color.setHSL(hue % 1, 0.8, 0.6);
          instanced.setColorAt(idx, color);

          const audioIndex = Math.floor((idx / count) * 255);
          crystalDataRef.current.push({
            x: offsetX,
            y: offsetY,
            z: offsetZ,
            phase: Math.random() * Math.PI * 2,
            index: audioIndex
          });
          idx += 1;
        }
      }
    }
    
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) {
      instanced.instanceColor.needsUpdate = true;
    }
    scene.add(instanced);
    crystalsRef.current = instanced;

    // Add ambient light effect
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x88ccff, 1, 100);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

  }, []);

  const animate = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !crystalsRef.current) return;

    timeRef.current += 0.016;
    const bass = audioData.bass / 255;
    const mid = audioData.mid / 255;
    const treble = audioData.treble / 255;
    const dummy = dummyRef.current;

    crystalDataRef.current.forEach((crystal, i) => {
      const sample = audioData.frequencyData[crystal.index] ?? 0;
      const audioReact = (sample / 255) * (2 + mid * 3);
      
      // Oscillating scale
      const baseScale = 0.5 + audioReact;
      const pulse = 1.0 + Math.sin(timeRef.current * 3.0 + crystal.phase) * 0.2 * treble;
      const scale = baseScale * pulse;
      
      // Subtle position animation
      const wobbleX = Math.sin(timeRef.current + crystal.phase) * 0.3 * mid;
      const wobbleY = Math.cos(timeRef.current * 1.2 + crystal.phase * 0.7) * 0.3 * mid;
      const wobbleZ = Math.sin(timeRef.current * 0.8 + crystal.phase * 1.3) * 0.3 * mid;
      
      dummy.position.set(
        crystal.x + wobbleX,
        crystal.y + wobbleY,
        crystal.z + wobbleZ
      );
      dummy.scale.set(scale, scale * (1 + bass * 0.5), scale);
      dummy.rotation.x = timeRef.current * 0.5 + crystal.phase;
      dummy.rotation.y = timeRef.current * 0.3 + crystal.phase * 0.5;
      dummy.rotation.z = timeRef.current * 0.7 + crystal.phase * 1.5;
      dummy.updateMatrix();
      crystalsRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    crystalsRef.current.instanceMatrix.needsUpdate = true;
    (crystalsRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + treble * 0.3;

    // Camera orbit
    const radius = 50;
    cameraRef.current.position.x = Math.sin(timeRef.current * 0.15) * radius;
    cameraRef.current.position.y = Math.cos(timeRef.current * 0.1) * radius * 0.5;
    cameraRef.current.position.z = Math.cos(timeRef.current * 0.15) * radius;
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
        const canvas = rendererRef.current.domElement;
        if (canvas.parentElement === containerRef.current) {
          containerRef.current.removeChild(canvas);
        }
        rendererRef.current.dispose();
      }
      if (crystalsRef.current) {
        crystalsRef.current.geometry.dispose();
        (crystalsRef.current.material as THREE.Material).dispose();
      }
    };
  }, [init]);

  useEffect(() => {
    if (isPlaying) {
      frameRef.current = requestAnimationFrame(animate);
    } else if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, animate]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
};

// ============================================================================
// PLASMA WAVE - Fullscreen shader with organic plasma effects
// ============================================================================

interface PlasmaWaveProps {
  audioData: AudioData;
  isPlaying: boolean;
}

export const PlasmaWave: React.FC<PlasmaWaveProps> = ({ audioData, isPlaying }) => {
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
    
    // Plasma wave functions
    float plasma(vec2 p, float time) {
      float a = sin(p.x * 3.0 + time * 0.8 + uBass * 5.0);
      float b = cos(p.y * 2.5 - time * 0.6 + uMid * 4.0);
      float c = sin((p.x + p.y) * 2.0 + time + uTreble * 3.0);
      float d = cos(length(p) * 4.0 - time * 1.2 + uBass * 2.0);
      return (a + b + c + d) * 0.25;
    }
    
    vec3 palette(float t) {
      // Dynamic color palette based on audio
      vec3 a = vec3(0.5, 0.5, 0.5);
      vec3 b = vec3(0.5, 0.5, 0.5);
      vec3 c = vec3(1.0, 1.0, 1.0);
      vec3 d = vec3(0.0 + uBass * 0.3, 0.33 + uMid * 0.3, 0.67 + uTreble * 0.3);
      return a + b * cos(6.28318 * (c * t + d));
    }
    
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
      
      // Multi-layer plasma
      float time = uTime * 0.5;
      
      // Layer 1 - Base plasma
      float p1 = plasma(uv * 2.0, time);
      
      // Layer 2 - Distorted plasma
      vec2 distorted = uv + vec2(
        sin(uv.y * 5.0 + time * 0.7) * 0.1 * uMid,
        cos(uv.x * 5.0 - time * 0.8) * 0.1 * uMid
      );
      float p2 = plasma(distorted * 1.5, time * 1.3);
      
      // Layer 3 - Radial plasma
      float angle = atan(uv.y, uv.x);
      float radius = length(uv);
      vec2 polar = vec2(angle * 2.0 / 3.14159, radius);
      float p3 = plasma(polar * 3.0, time * 0.7);
      
      // Combine layers
      float value = (p1 + p2 + p3) * 0.333;
      value = value * 0.5 + 0.5; // Normalize to 0-1
      
      // Audio reactivity
      value += uRms * 0.3;
      value += sin(radius * 10.0 - time * 3.0) * uBass * 0.2;
      
      // Color mapping
      vec3 col = palette(value + time * 0.1);
      
      // Add glow around center
      float glow = 1.0 / (1.0 + radius * radius * 2.0);
      col += glow * vec3(0.2, 0.3, 0.5) * uTreble;
      
      // Pulsing vignette
      float vig = 1.0 - length(uv) * (0.3 + uBass * 0.3);
      vig = smoothstep(0.0, 1.0, vig);
      col *= vig;
      
      // Add scanlines
      float scanline = sin(gl_FragCoord.y * 2.0 + time * 10.0) * 0.02 + 0.98;
      col *= scanline;
      
      // Enhance brightness on beat
      col *= (1.0 + uBass * 0.3);
      
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
        const canvas = rendererRef.current.domElement;
        if (canvas.parentElement === containerRef.current) {
          containerRef.current.removeChild(canvas);
        }
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
