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
// AETHER RINGS - Audio-charged ring tunnel with additive glow
// ============================================================================

interface AetherRingsProps {
  audioData: AudioData;
  isPlaying: boolean;
}

interface RingData {
  z: number;
  baseScale: number;
  speed: number;
  hue: number;
  index: number;
}

export const AetherRings: React.FC<AetherRingsProps> = ({ audioData, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const ringsRef = useRef<THREE.InstancedMesh | null>(null);
  const ringDataRef = useRef<RingData[]>([]);
  const dummyRef = useRef(new THREE.Object3D());
  const timeRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const init = useCallback(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05030c);
    scene.fog = new THREE.Fog(0x05030c, 20, 180);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.z = 40;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ringGeometry = new THREE.TorusGeometry(8, 0.25, 6, 48);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });

    const ringCount = 90;
    const instanced = new THREE.InstancedMesh(ringGeometry, ringMaterial, ringCount);
    const color = new THREE.Color();
    ringDataRef.current = [];

    for (let i = 0; i < ringCount; i += 1) {
      const z = -i * 4.2;
      const baseScale = 0.6 + Math.random() * 0.9;
      const speed = 0.6 + Math.random() * 0.7;
      const hue = 190 + Math.random() * 130;
      const index = Math.floor((i / ringCount) * 255);

      ringDataRef.current.push({ z, baseScale, speed, hue, index });
      color.setHSL(hue / 360, 0.85, 0.65);
      instanced.setColorAt(i, color);
    }

    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) {
      instanced.instanceColor.needsUpdate = true;
    }
    scene.add(instanced);
    ringsRef.current = instanced;

    const glowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshBasicMaterial({ color: 0x140022, transparent: true, opacity: 0.25 })
    );
    glowPlane.position.z = -60;
    scene.add(glowPlane);
  }, []);

  const animate = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !ringsRef.current) return;

    timeRef.current += 0.016;
    const time = timeRef.current;

    const bass = audioData.bass / 255;
    const mid = audioData.mid / 255;
    const treble = audioData.treble / 255;
    const dummy = dummyRef.current;
    const ringCount = ringDataRef.current.length;
    const resetDepth = -ringCount * 4.2;

    ringDataRef.current.forEach((ring, i) => {
      const sample = audioData.frequencyData[ring.index] ?? 0;
      const audioBoost = sample / 255;
      ring.z += (1.2 + bass * 2.2) * ring.speed;
      if (ring.z > 50) ring.z = resetDepth;

      const wobbleX = Math.sin(time * 0.7 + i) * 2.5 * mid;
      const wobbleY = Math.cos(time * 0.6 + i) * 2.5 * treble;
      const scale = ring.baseScale + audioBoost * 0.8 + bass * 0.3;

      dummy.position.set(wobbleX, wobbleY, ring.z);
      dummy.rotation.set(time * 0.3 + i * 0.05, time * 0.4 + i * 0.08, time * 0.2);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      ringsRef.current!.setMatrixAt(i, dummy.matrix);
    });

    ringsRef.current.instanceMatrix.needsUpdate = true;
    (ringsRef.current.material as THREE.MeshBasicMaterial).opacity = 0.6 + treble * 0.3;

    cameraRef.current.position.x = Math.sin(time * 0.2) * 6;
    cameraRef.current.position.y = Math.cos(time * 0.15) * 4;
    cameraRef.current.lookAt(0, 0, -40);

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
      if (ringsRef.current) {
        ringsRef.current.geometry.dispose();
        (ringsRef.current.material as THREE.Material).dispose();
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
// PRISM SHARD FIELD - Instanced crystalline shards with reactive lighting
// ============================================================================

interface PrismShardFieldProps {
  audioData: AudioData;
  isPlaying: boolean;
}

interface ShardData {
  position: THREE.Vector3;
  spin: THREE.Vector3;
  phase: number;
  index: number;
}

export const PrismShardField: React.FC<PrismShardFieldProps> = ({ audioData, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const shardsRef = useRef<THREE.InstancedMesh | null>(null);
  const shardDataRef = useRef<ShardData[]>([]);
  const dummyRef = useRef(new THREE.Object3D());
  const timeRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lightRef = useRef<THREE.PointLight | null>(null);

  const init = useCallback(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03040a);
    scene.fog = new THREE.Fog(0x03040a, 25, 120);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 8, 40);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const geometry = new THREE.IcosahedronGeometry(0.9, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.25,
      roughness: 0.35,
      transparent: true,
      opacity: 0.85,
      emissive: new THREE.Color(0x111133),
      vertexColors: true,
    });

    const shardCount = 620;
    const instanced = new THREE.InstancedMesh(geometry, material, shardCount);
    const color = new THREE.Color();
    shardDataRef.current = [];

    for (let i = 0; i < shardCount; i += 1) {
      const radius = 8 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const position = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
      const spin = new THREE.Vector3(
        Math.random() * 0.6 + 0.2,
        Math.random() * 0.6 + 0.2,
        Math.random() * 0.6 + 0.2
      );
      const phase = Math.random() * Math.PI * 2;
      const index = Math.floor((i / shardCount) * 255);

      shardDataRef.current.push({ position, spin, phase, index });
      const hue = (0.55 + radius / 80 + i / shardCount) % 1;
      color.setHSL(hue, 0.85, 0.6);
      instanced.setColorAt(i, color);
    }

    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) {
      instanced.instanceColor.needsUpdate = true;
    }
    scene.add(instanced);
    shardsRef.current = instanced;

    scene.add(new THREE.AmbientLight(0x223355, 0.6));
    const pointLight = new THREE.PointLight(0x99ccff, 1.2, 150);
    pointLight.position.set(0, 10, 20);
    scene.add(pointLight);
    lightRef.current = pointLight;

    const rimLight = new THREE.PointLight(0xff66ff, 0.7, 120);
    rimLight.position.set(-20, -10, -20);
    scene.add(rimLight);
  }, []);

  const animate = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !shardsRef.current) return;

    timeRef.current += 0.016;
    const time = timeRef.current;

    const bass = audioData.bass / 255;
    const mid = audioData.mid / 255;
    const treble = audioData.treble / 255;
    const dummy = dummyRef.current;

    shardDataRef.current.forEach((shard, i) => {
      const sample = audioData.frequencyData[shard.index] ?? 0;
      const audioBoost = sample / 255;
      const pulse = 0.7 + audioBoost * 1.4 + bass * 0.4;
      const drift = Math.sin(time * 0.6 + shard.phase) * 1.2 * mid;

      dummy.position.set(
        shard.position.x + drift,
        shard.position.y + Math.cos(time * 0.5 + shard.phase) * 0.8 * treble,
        shard.position.z
      );
      dummy.scale.set(pulse, pulse * (1 + mid * 0.2), pulse);
      dummy.rotation.set(
        time * shard.spin.x + shard.phase,
        time * shard.spin.y + shard.phase,
        time * shard.spin.z
      );
      dummy.updateMatrix();
      shardsRef.current!.setMatrixAt(i, dummy.matrix);
    });

    shardsRef.current.instanceMatrix.needsUpdate = true;
    const material = shardsRef.current.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 0.3 + treble * 0.8;

    if (lightRef.current) {
      lightRef.current.intensity = 0.8 + bass * 1.2;
      lightRef.current.position.x = Math.sin(time * 0.4) * 15;
      lightRef.current.position.z = Math.cos(time * 0.5) * 20;
    }

    cameraRef.current.position.x = Math.sin(time * 0.2) * 14;
    cameraRef.current.position.z = 40 + Math.cos(time * 0.15) * 6;
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
      if (shardsRef.current) {
        shardsRef.current.geometry.dispose();
        (shardsRef.current.material as THREE.Material).dispose();
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
// FLUX BLOOM - Fullscreen shader with pulsing energy fields
// ============================================================================

interface FluxBloomProps {
  audioData: AudioData;
  isPlaying: boolean;
}

export const FluxBloom: React.FC<FluxBloomProps> = ({ audioData, isPlaying }) => {
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

    vec3 palette(float t, vec3 shift) {
      return 0.55 + 0.45 * cos(6.28318 * (vec3(0.2, 0.35, 0.55) * t + shift));
    }

    float blob(vec2 uv, vec2 center, float radius) {
      float d = length(uv - center);
      return radius / (d + 0.15);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
      float t = uTime * 0.35;

      vec2 c1 = vec2(sin(t * 0.9), cos(t * 0.7)) * (0.55 + uBass * 0.25);
      vec2 c2 = vec2(cos(t * 0.6 + 1.2), sin(t * 0.8 + 2.1)) * (0.7 + uMid * 0.3);
      vec2 c3 = vec2(sin(t * 1.1 + 2.4), cos(t * 0.5 + 1.5)) * (0.6 + uTreble * 0.35);

      float field = 0.0;
      field += blob(uv, c1, 0.55 + uBass * 0.2);
      field += blob(uv, c2, 0.5 + uMid * 0.2);
      field += blob(uv, c3, 0.45 + uTreble * 0.2);

      float ripple = sin((uv.x + uv.y) * 6.0 - t * 4.0) * 0.08;
      field += ripple;

      float glow = smoothstep(1.0, 2.4, field);
      vec3 color = palette(field * 0.35, vec3(0.12 + uBass * 0.2, 0.32 + uMid * 0.2, 0.6 + uTreble * 0.2));
      color = mix(color, vec3(0.05, 0.02, 0.08), smoothstep(0.0, 0.5, length(uv)));
      color += glow * vec3(0.3, 0.45, 0.9) * (0.6 + uTreble);
      color *= 0.7 + uRms * 0.6;

      float vignette = smoothstep(1.2, 0.2, length(uv));
      color *= vignette;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const vertexShader = `
    void main() {
      gl_Position = vec4(position, 1.0);
    }
  `;

  const init = useCallback(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

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

    const material = meshRef.current.material as THREE.ShaderMaterial;
    material.uniforms.uTime.value = timeRef.current;
    material.uniforms.uBass.value = audioData.bass / 255;
    material.uniforms.uMid.value = audioData.mid / 255;
    material.uniforms.uTreble.value = audioData.treble / 255;
    material.uniforms.uRms.value = audioData.rms / 255;

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
    } else if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, animate]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
};
