/**
 * knowledge-map-3d  --  KnowledgeMap component
 *
 * A standalone 3-D visualization of documents, clusters, and nebulae.
 * Accepts all data through props — no API calls, no routing, no auth.
 *
 * Features:
 *   - Three.js scene with UnrealBloomPass post-processing
 *   - Kepler elliptical orbits with per-document eccentricity
 *   - Cluster center stars, orbital rings, nebula particle clouds
 *   - Dock-magnification on mouse proximity
 *   - Search highlighting (matched vs. faded)
 *   - Star-birth and supernova celestial event effects
 *   - Hand tracking camera control (MediaPipe)
 *   - Optional ambient audio with fade-in
 *   - Sidebar with stats, type filters, and cluster list
 *   - Embeddable mode (no sidebar / search bar)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { useHandTracking } from './hooks/useHandTracking';
import type { MapDocument, ClusterMeta, NebulaMeta, Stats } from './types';
import styles from './KnowledgeMap.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KnowledgeMapProps {
  /** Documents to render as orbiting planets / moons. */
  documents: MapDocument[];
  /** Cluster stars and their metadata. */
  clusters: ClusterMeta[];
  /** Nebula clouds between overlapping clusters. */
  nebulae: NebulaMeta[];
  /** Optional aggregate stats shown in the sidebar. */
  stats?: Stats | null;

  /** Fired when a document node is clicked.  Receives the full document. */
  onDocumentClick?: (doc: MapDocument) => void;
  /** Fired when a cluster star is clicked. */
  onClusterClick?: (cluster: ClusterMeta) => void;

  /**
   * Set of document IDs to highlight (search results).
   * When non-empty, non-matching nodes are faded.
   */
  highlightIds?: Set<string>;

  /** If true, hide sidebar, search bar, legend, and zoom controls. */
  embedded?: boolean;

  /**
   * Color mapping from document `type` to CSS hex string.
   * Falls back to a built-in palette for unmapped types.
   */
  typeColors?: Record<string, string>;

  /**
   * Filter label list shown in the sidebar.
   * Each string becomes a toggle button; the first entry is the "all" option.
   * Defaults to `['', 'principle', 'learning', 'retro']`.
   */
  typeFilters?: string[];

  /** Called when the user changes the type filter in the sidebar. */
  onTypeFilterChange?: (filter: string) => void;

  /** Sidebar title.  Defaults to "Knowledge Universe". */
  sidebarTitle?: string;

  /** Optional URL for ambient background music. */
  ambientAudioSrc?: string;

  /** CSS class applied to the root container. */
  className?: string;

  /** Height mode: 'full' (100vh), 'auto' (100% of parent), 'embed' (100vh, no chrome). */
  heightMode?: 'full' | 'auto' | 'embed';
}

// ---------------------------------------------------------------------------
// Default palette
// ---------------------------------------------------------------------------

const DEFAULT_TYPE_COLORS: Record<string, string> = {
  principle: '#60a5fa',
  learning: '#a78bfa',
  retro: '#fbbf24',
  unknown: '#666666',
};

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function buildTypeColorNums(map: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) out[k] = hexToNum(v);
  return out;
}

// 12-color cluster palette
const CLUSTER_PALETTE = [
  0xff6b6b, 0x2dd4bf, 0xfbbf24, 0xa78bfa, 0x4ade80, 0xf472b6,
  0x38bdf8, 0xfb923c, 0x818cf8, 0x34d399, 0xf59e0b, 0x94a3b8,
];

const CLUSTER_PALETTE_CSS = [
  '#ff6b6b', '#2dd4bf', '#fbbf24', '#a78bfa', '#4ade80', '#f472b6',
  '#38bdf8', '#fb923c', '#818cf8', '#34d399', '#f59e0b', '#94a3b8',
];

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/** Damped spring tween */
function cdsTween(state: { x: number; v: number }, target: number, speed: number, dt: number) {
  const n1 = state.v - (state.x - target) * (speed * speed * dt);
  const n2 = 1 + speed * dt;
  const nv = n1 / (n2 * n2);
  return { x: state.x + nv * dt, v: nv };
}

function xxhash(seed: number, data: number): number {
  let h = ((seed + 374761393) >>> 0);
  h = ((h + (data * 3266489917 >>> 0)) >>> 0);
  h = ((((h << 17) | (h >>> 15)) * 668265263) >>> 0);
  h ^= h >>> 15;
  h = ((h * 2246822519) >>> 0);
  h ^= h >>> 13;
  h = ((h * 3266489917) >>> 0);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function noise1D(p: number, seed: number): number {
  const i = Math.floor(p);
  const f = p - i;
  const u = f * f * (3 - 2 * f);
  const g0 = xxhash(seed, i) * 2 - 1;
  const g1 = xxhash(seed, i + 1) * 2 - 1;
  return g0 * (1 - u) + g1 * u;
}

// ---------------------------------------------------------------------------
// Texture helpers
// ---------------------------------------------------------------------------

function createNebulaTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createSupernovaTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.15, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.4, 'rgba(255,220,180,0.4)');
  gradient.addColorStop(0.7, 'rgba(255,180,100,0.1)');
  gradient.addColorStop(1, 'rgba(255,150,50,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Scale helpers
// ---------------------------------------------------------------------------

/** Mass-based scale -- file size determines planet size (log). */
function massScale(contentLength: number): number {
  if (!contentLength || contentLength <= 0) return 0.7;
  const kb = contentLength / 1024;
  return Math.max(0.5, Math.min(2.0, 0.3 + Math.log2(kb + 1) * 0.2));
}

// ---------------------------------------------------------------------------
// Title extraction
// ---------------------------------------------------------------------------

function extractTitle(sourceFile: string): string {
  const parts = sourceFile.split('/');
  const filename = parts[parts.length - 1] || sourceFile;
  return filename.replace(/\.md$/, '').replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KnowledgeMap({
  documents,
  clusters,
  nebulae,
  stats,
  onDocumentClick,
  onClusterClick,
  highlightIds,
  embedded = false,
  typeColors: typeColorsProp,
  typeFilters = ['', 'principle', 'learning', 'retro'],
  onTypeFilterChange,
  sidebarTitle = 'Knowledge Universe',
  ambientAudioSrc,
  className,
  heightMode = 'full',
}: KnowledgeMapProps) {
  // Merge colours
  const TYPE_COLORS = { ...DEFAULT_TYPE_COLORS, ...typeColorsProp };
  const TYPE_COLORS_NUM = buildTypeColorNums(TYPE_COLORS);

  const containerRef = useRef<HTMLDivElement>(null);
  const [matchIds, setMatchIds] = useState<Set<string>>(new Set());
  const [hoveredDoc, setHoveredDoc] = useState<MapDocument | null>(null);
  const [focusedCluster, setFocusedCluster] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Use external highlight ids when provided
  const effectiveMatchIds = highlightIds ?? matchIds;

  const matchIdsRef = useRef<Set<string>>(new Set());
  const hoveredDocRef = useRef<MapDocument | null>(null);
  const animRef = useRef<number>(0);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const clusterMeshesRef = useRef<THREE.Mesh[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const mouseNDC = useRef(new THREE.Vector2(10, 10));
  const labelsRef = useRef<HTMLDivElement>(null);

  // Celestial event tracking
  const prevDocIdsRef = useRef<Set<string>>(new Set());
  const supernovaQueueRef = useRef<Array<{ x: number; y: number; z: number; color: number }>>([]);
  const starBirthQueueRef = useRef<Array<{ x: number; y: number; z: number; color: number }>>([]);

  // Star Birth effect state
  const activeStarBirthsRef = useRef<Array<{
    particles: THREE.Points;
    flash: THREE.PointLight;
    startTime: number;
    origin: THREE.Vector3;
    particleOrigins: Float32Array;
    duration: number;
    phase: 'collapse' | 'ignition' | 'shine' | 'settle';
  }>>([]);

  const activeSupernovaeRef = useRef<Array<{
    particles: THREE.Points;
    flash: THREE.PointLight;
    rings: THREE.Mesh[];
    startTime: number;
    origin: THREE.Vector3;
    velocities: Float32Array;
    layers: Float32Array;
    baseColor: number;
    duration: number;
    waveRadius: number;
    waveSpeed: number;
    phase: 'collapse' | 'bounce' | 'breakout' | 'expand' | 'fade';
  }>>([]);

  // Camera orbit state
  const camAngleX = useRef({ x: 0, v: 0 });
  const camAngleY = useRef({ x: 0.3, v: 0 });
  const camDist = useRef({ x: 28, v: 0 });
  const targetAngleX = useRef(0);
  const targetAngleY = useRef(0.3);
  const targetDist = useRef(28);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Camera lookAt target (for cluster zoom)
  const lookAtX = useRef({ x: 0, v: 0 });
  const lookAtY = useRef({ x: 0, v: 0 });
  const lookAtZ = useRef({ x: 0, v: 0 });
  const targetLookAtX = useRef(0);
  const targetLookAtY = useRef(0);
  const targetLookAtZ = useRef(0);

  // Background music
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioStartedRef = useRef(false);
  const [muted, setMuted] = useState(false);

  const fadeInAudio = useCallback((audio: HTMLAudioElement) => {
    audio.volume = 0;
    const steps = 50;
    const stepTime = 5000 / steps;
    const stepSize = 0.35 / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      audio.volume = Math.min(0.35, stepSize * step);
      if (step >= steps) clearInterval(interval);
    }, stepTime);
  }, []);

  useEffect(() => {
    if (embedded || !ambientAudioSrc) return;
    const audio = new Audio(ambientAudioSrc);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;

    const startAudio = () => {
      if (audioStartedRef.current) return;
      audioStartedRef.current = true;
      audio.play().then(() => fadeInAudio(audio)).catch(() => {
        audioStartedRef.current = false;
      });
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener('click', startAudio);
      document.removeEventListener('keydown', startAudio);
      document.removeEventListener('touchstart', startAudio);
      document.removeEventListener('wheel', startAudio);
    };

    audio.play().then(() => {
      audioStartedRef.current = true;
      fadeInAudio(audio);
    }).catch(() => {
      document.addEventListener('click', startAudio);
      document.addEventListener('keydown', startAudio);
      document.addEventListener('touchstart', startAudio);
      document.addEventListener('wheel', startAudio);
    });

    return () => {
      audio.pause();
      audio.src = '';
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambientAudioSrc]);

  const fadeAudio = useCallback((audio: HTMLAudioElement, from: number, to: number, duration: number) => {
    audio.volume = from;
    const steps = 30;
    const stepTime = duration / steps;
    const stepSize = (to - from) / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      audio.volume = Math.min(1, Math.max(0, from + stepSize * step));
      if (step >= steps) clearInterval(interval);
    }, stepTime);
    return interval;
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const isPlaying = !audio.paused;
    if (isPlaying) {
      fadeAudio(audio, audio.volume, 0, 800);
      setTimeout(() => audio.pause(), 850);
      setMuted(true);
    } else {
      audio.volume = 0;
      audio.play().catch(() => {});
      fadeAudio(audio, 0, 0.35, 1500);
      audioStartedRef.current = true;
      setMuted(false);
    }
  }, [fadeAudio]);

  // ---------- Hand tracking ----------
  const [handMode, setHandMode] = useState(false);
  const handModeRef = useRef(false);

  const handleHandMove = useCallback((pos: { x: number; y: number }) => {
    targetAngleX.current = (pos.x - 0.5) * Math.PI * 2;
    targetAngleY.current = (pos.y - 0.5) * -1;
  }, []);

  const {
    isReady: handReady,
    isTracking: handTracking,
    error: handError,
    handPosition,
    gesture,
    debug: handDebug,
    startTracking,
    stopTracking,
  } = useHandTracking({
    enabled: handMode,
    onHandMove: handleHandMove,
  });

  const toggleHandMode = useCallback(() => {
    if (handMode) {
      stopTracking();
      setHandMode(false);
    } else {
      setHandMode(true);
    }
  }, [handMode, stopTracking]);

  useEffect(() => {
    if (handMode && handReady && !handTracking) {
      startTracking();
    }
  }, [handMode, handReady, handTracking, startTracking]);

  useEffect(() => { handModeRef.current = handMode; }, [handMode]);

  // Gesture-based zoom
  useEffect(() => {
    if (!handMode) return;
    const interval = setInterval(() => {
      if (gesture === 'fist') {
        targetDist.current = Math.max(3, targetDist.current - 0.3);
      } else if (gesture === 'open') {
        targetDist.current = Math.min(40, targetDist.current + 0.3);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [handMode, gesture]);

  useEffect(() => { matchIdsRef.current = effectiveMatchIds; }, [effectiveMatchIds]);
  useEffect(() => { hoveredDocRef.current = hoveredDoc; }, [hoveredDoc]);

  // Zoom to cluster
  const zoomToCluster = useCallback((cluster: ClusterMeta) => {
    targetLookAtX.current = cluster.cx;
    targetLookAtY.current = cluster.cy;
    targetLookAtZ.current = cluster.cz;
    targetDist.current = cluster.radius * 4;
    setFocusedCluster(cluster.id);
  }, []);

  // Zoom out to universe view
  const zoomOut = useCallback(() => {
    targetLookAtX.current = 0;
    targetLookAtY.current = 0;
    targetLookAtZ.current = 0;
    targetDist.current = 28;
    setFocusedCluster(null);
  }, []);

  // PostMessage commands (embed mode)
  useEffect(() => {
    if (!embedded) return;
    const handler = (e: MessageEvent) => {
      const { type, cluster: clusterId } = e.data || {};
      if (type === 'zoom-to-cluster') {
        const cluster = clusters.find(c => c.id === clusterId);
        if (cluster) {
          const mult = e.data.zoomMultiplier ?? 4;
          targetLookAtX.current = cluster.cx;
          targetLookAtY.current = cluster.cy;
          targetLookAtZ.current = cluster.cz;
          targetDist.current = cluster.radius * mult;
          setFocusedCluster(cluster.id);
          setTimeout(() => {
            window.parent.postMessage({ type: 'zoom-complete', cluster: clusterId }, '*');
          }, 1500);
        } else {
          window.parent.postMessage({ type: 'zoom-complete', cluster: clusterId }, '*');
        }
      } else if (type === 'zoom-out') {
        zoomOut();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [embedded, clusters, zoomToCluster, zoomOut]);

  // Star Birth: detect new documents
  useEffect(() => {
    if (documents.length === 0) return;
    const currentIds = new Set(documents.map(d => d.id));
    const prevIds = prevDocIdsRef.current;
    const now = Date.now();
    const RECENT_WINDOW = 5 * 60 * 1000;
    const BIRTH_INTERVAL = 1000;

    if (prevIds.size > 0) {
      const newDocs = documents.filter(d => !prevIds.has(d.id));
      const sorted = newDocs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      sorted.forEach((doc, i) => {
        const color = TYPE_COLORS_NUM[doc.type] || TYPE_COLORS_NUM.unknown || 0x666666;
        setTimeout(() => {
          starBirthQueueRef.current.push({ x: doc.x, y: doc.y, z: doc.z, color });
        }, i * BIRTH_INTERVAL);
      });
    } else {
      const recentDocs = documents.filter(d =>
        d.createdAt && (now - d.createdAt) < RECENT_WINDOW
      );
      const sorted = recentDocs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      sorted.forEach((doc, i) => {
        const color = TYPE_COLORS_NUM[doc.type] || TYPE_COLORS_NUM.unknown || 0x666666;
        setTimeout(() => {
          starBirthQueueRef.current.push({ x: doc.x, y: doc.y, z: doc.z, color });
        }, i * BIRTH_INTERVAL);
      });
    }

    prevDocIdsRef.current = currentIds;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  // Escape key handler
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') zoomOut();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomOut]);

  // ---------- Three.js scene ----------
  useEffect(() => {
    const container = containerRef.current;
    if (!container || documents.length === 0) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020208);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.z = 28;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Post-processing: bloom
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.0,   // strength
      0.4,   // radius
      0.15,  // threshold
    );
    composer.addPass(bloomPass);

    // Lighting
    const ambient = new THREE.AmbientLight(0x404060, 0.4);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.6);
    directional.position.set(5, 5, 5);
    scene.add(directional);

    // Star field background
    const starCount = 2000;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let si = 0; si < starCount; si++) {
      starPositions[si * 3] = (Math.random() - 0.5) * 100;
      starPositions[si * 3 + 1] = (Math.random() - 0.5) * 100;
      starPositions[si * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.04, transparent: true, opacity: 0.6,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Build cluster orthonormal bases
    const clusterBases = new Map<string, { cx: number; cy: number; cz: number; ux: number; uy: number; uz: number; vx: number; vy: number; vz: number; nx: number; ny: number; nz: number }>();
    clusters.forEach(cluster => {
      const cx = cluster.cx, cy = cluster.cy, cz = cluster.cz;
      const len = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
      const nx = cx / len, ny = cy / len, nz = cz / len;
      let ux: number, uy: number, uz: number;
      if (Math.abs(ny) < 0.9) {
        ux = nz; uy = 0; uz = -nx;
      } else {
        ux = 0; uy = -nz; uz = ny;
      }
      const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
      ux /= uLen; uy /= uLen; uz /= uLen;
      const vx = ny * uz - nz * uy;
      const vy = nz * ux - nx * uz;
      const vz = nx * uy - ny * ux;
      clusterBases.set(cluster.id, { cx, cy, cz, ux, uy, uz, vx, vy, vz, nx, ny, nz });
    });

    // Cluster center stars
    const starGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const clusterMeshes: THREE.Mesh[] = [];

    clusters.forEach((cluster, i) => {
      const colorIdx = i % CLUSTER_PALETTE.length;
      const color = CLUSTER_PALETTE[colorIdx];
      const material = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.1,
        roughness: 0.1,
        emissive: color,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.95,
      });

      const mesh = new THREE.Mesh(starGeometry, material);
      mesh.position.set(cluster.cx, cluster.cy, cluster.cz);
      mesh.userData = { cluster, isCluster: true };
      scene.add(mesh);
      clusterMeshes.push(mesh);

      // Orbital rings
      const base = clusterBases.get(cluster.id);
      const clusterDocs = documents.filter(d => d.clusterId === cluster.id && d.parentId === null);
      const orbitRadii = clusterDocs.map(d => d.orbitRadius).sort((a, b) => a - b);
      const ringSet = new Set<number>();
      if (orbitRadii.length > 0) {
        const binSize = cluster.radius / Math.min(4, Math.ceil(Math.sqrt(clusterDocs.length / 4)));
        for (const r of orbitRadii) {
          const bin = Math.round(r / binSize) * binSize;
          if (bin > 0) ringSet.add(bin);
        }
      }
      const ringRadii = [...ringSet].sort((a, b) => a - b);
      for (let ri = 0; ri < ringRadii.length; ri++) {
        const ringRadius = ringRadii[ri];
        const ringEcc = 0.02 + ((ri * 1.7 + i * 2.3) % 1.0) * 0.23;
        const ringB = ringRadius * Math.sqrt(1 - ringEcc * ringEcc);
        const focalOffset = ringRadius * ringEcc;

        const SEGMENTS = 64;
        const ellipsePoints: THREE.Vector3[] = [];
        for (let si = 0; si <= SEGMENTS; si++) {
          const theta = (si / SEGMENTS) * Math.PI * 2;
          ellipsePoints.push(new THREE.Vector3(
            ringRadius * Math.cos(theta) - focalOffset,
            ringB * Math.sin(theta),
            0
          ));
        }
        const ellipseGeo = new THREE.BufferGeometry().setFromPoints(ellipsePoints);
        const ellipseMat = new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.08,
        });
        const ellipseLine = new THREE.Line(ellipseGeo, ellipseMat);
        ellipseLine.position.set(cluster.cx, cluster.cy, cluster.cz);

        if (base) {
          const tiltAngle = ((ri * 1.7 + i * 2.3) % 1.0) * 0.5 - 0.25;
          const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle);
          const tux = base.ux * cosT + base.nx * sinT;
          const tuy = base.uy * cosT + base.ny * sinT;
          const tuz = base.uz * cosT + base.nz * sinT;
          const tnx = tuy * base.vz - tuz * base.vy;
          const tny = tuz * base.vx - tux * base.vz;
          const tnz = tux * base.vy - tuy * base.vx;
          const omega = ((ri * 4.1 + i * 1.3) % 1.0) * Math.PI * 2;
          const m = new THREE.Matrix4();
          m.makeBasis(
            new THREE.Vector3(tux, tuy, tuz),
            new THREE.Vector3(tnx, tny, tnz),
            new THREE.Vector3(base.vx, base.vy, base.vz),
          );
          ellipseLine.quaternion.setFromRotationMatrix(m);
          ellipseLine.rotateZ(omega);
        }

        scene.add(ellipseLine);
      }
    });
    clusterMeshesRef.current = clusterMeshes;

    // Nebula particle clouds
    const nebulaTexture = createNebulaTexture();
    const nebulaPoints: THREE.Points[] = [];
    nebulae.forEach(neb => {
      const clA = clusters.find(c => c.id === neb.clusterA);
      const clB = clusters.find(c => c.id === neb.clusterB);
      const ax = clA?.cx ?? neb.cx, ay = clA?.cy ?? neb.cy, az = clA?.cz ?? neb.cz;
      const bx = clB?.cx ?? neb.cx, by = clB?.cy ?? neb.cy, bz = clB?.cz ?? neb.cz;
      const distAB = Math.sqrt((bx-ax)**2 + (by-ay)**2 + (bz-az)**2) || 1;

      const cloudRadius = distAB * 0.25 + neb.strength * 1.5;

      const cx = (ax + bx) / 2, cy = (ay + by) / 2, cz = (az + bz) / 2;
      const densityCenters = [
        { x: cx, y: cy, z: cz, w: 0.4 },
        { x: ax + (bx-ax)*0.3 + (Math.random()-0.5)*cloudRadius*0.5, y: ay + (by-ay)*0.3 + (Math.random()-0.5)*cloudRadius*0.5, z: az + (bz-az)*0.3 + (Math.random()-0.5)*cloudRadius*0.5, w: 0.25 },
        { x: ax + (bx-ax)*0.7 + (Math.random()-0.5)*cloudRadius*0.5, y: ay + (by-ay)*0.7 + (Math.random()-0.5)*cloudRadius*0.5, z: az + (bz-az)*0.7 + (Math.random()-0.5)*cloudRadius*0.5, w: 0.25 },
        { x: cx + (Math.random()-0.5)*cloudRadius*0.8, y: cy + (Math.random()-0.5)*cloudRadius*0.8, z: cz + (Math.random()-0.5)*cloudRadius*0.8, w: 0.1 },
      ];

      const PARTICLE_COUNT = Math.floor(1200 + neb.strength * 2000);
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const sizes = new Float32Array(PARTICLE_COUNT);
      for (let pi = 0; pi < PARTICLE_COUNT; pi++) {
        let pick = Math.random(), centerIdx = 0;
        for (let ci = 0; ci < densityCenters.length; ci++) {
          pick -= densityCenters[ci].w;
          if (pick <= 0) { centerIdx = ci; break; }
        }
        const dc = densityCenters[centerIdx];

        const u1 = Math.random(), u2 = Math.random(), u3 = Math.random();
        const r = cloudRadius * Math.pow(u1 * u2 * u3, 0.45);
        const theta = Math.random() * Math.PI * 2;
        const phi2 = Math.acos(2 * Math.random() - 1);
        positions[pi * 3]     = dc.x + r * Math.sin(phi2) * Math.cos(theta);
        positions[pi * 3 + 1] = dc.y + r * Math.sin(phi2) * Math.sin(theta);
        positions[pi * 3 + 2] = dc.z + r * Math.cos(phi2);
        sizes[pi] = Math.random() < 0.7
          ? 0.05 + Math.random() * 0.12
          : 0.15 + Math.random() * 0.35;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      const nebColor = parseInt(neb.color.slice(1), 16);
      const mat = new THREE.PointsMaterial({
        color: nebColor,
        size: 0.25,
        sizeAttenuation: true,
        map: nebulaTexture,
        transparent: true,
        opacity: 0.03 + neb.strength * 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);
      nebulaPoints.push(points);
    });

    // Separate planets and moons
    const planetDocs = documents.filter(d => d.parentId === null);
    const moonDocs = documents.filter(d => d.parentId !== null);

    const planetGeometry = new THREE.SphereGeometry(0.08, 10, 10);
    const moonGeometry = new THREE.SphereGeometry(0.04, 6, 6);
    const meshes: THREE.Mesh[] = [];
    const meshById = new Map<string, THREE.Mesh>();
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Create planet meshes
    planetDocs.forEach((doc) => {
      const typeColor = TYPE_COLORS_NUM[doc.type] || TYPE_COLORS_NUM.unknown || 0x666666;
      const baseScl = massScale(doc.contentLength) * (doc.moonCount > 0 ? 1.2 : 1.0);
      const material = new THREE.MeshStandardMaterial({
        color: typeColor,
        metalness: 0.3,
        roughness: 0.2,
        emissive: typeColor,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 1.0,
      });
      const mesh = new THREE.Mesh(planetGeometry, material);
      mesh.position.set(doc.x, doc.y, doc.z);
      mesh.userData = { doc, baseScale: baseScl, isMoon: false };
      scene.add(mesh);
      meshes.push(mesh);
      meshById.set(doc.id, mesh);
    });

    // Create moon meshes
    moonDocs.forEach((doc) => {
      const typeColor = TYPE_COLORS_NUM[doc.type] || TYPE_COLORS_NUM.unknown || 0x666666;
      const baseScl = massScale(doc.contentLength) * 0.5;
      const material = new THREE.MeshStandardMaterial({
        color: typeColor,
        metalness: 0.3,
        roughness: 0.2,
        emissive: typeColor,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 1.0,
      });
      const mesh = new THREE.Mesh(moonGeometry, material);
      mesh.position.set(doc.x, doc.y, doc.z);
      mesh.userData = { doc, baseScale: baseScl, isMoon: true };
      scene.add(mesh);
      meshes.push(mesh);
      meshById.set(doc.id, mesh);
    });
    meshesRef.current = meshes;

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(10, 10);
    const allInteractable = [...clusterMeshes, ...meshes];

    // ---- Mouse handlers ----
    function onMouseDown(e: MouseEvent) {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
    }

    function onMouseUp(e: MouseEvent) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const wasDrag = Math.abs(dx) > 3 || Math.abs(dy) > 3;

      if (!wasDrag) {
        const rect = container!.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(allInteractable);
        if (intersects.length > 0) {
          const obj = intersects[0].object;
          if (obj.userData.isCluster) {
            const cluster = obj.userData.cluster as ClusterMeta;
            if (onClusterClick) {
              onClusterClick(cluster);
            } else {
              zoomToCluster(cluster);
            }
          } else {
            const clickedDoc = obj.userData.doc as MapDocument;
            onDocumentClick?.(clickedDoc);
          }
        }
      }
      isDragging.current = false;
    }

    function onMouseMove(e: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      mouseNDC.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDC.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging.current) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        targetAngleX.current = camAngleX.current.x + dx * 0.005;
        targetAngleY.current = Math.max(-1.2, Math.min(1.2, camAngleY.current.x - dy * 0.005));
        return;
      }

      mouse.x = mouseNDC.current.x;
      mouse.y = mouseNDC.current.y;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(allInteractable);

      if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (obj.userData.isCluster) {
          setHoveredDoc(null);
          container!.style.cursor = 'pointer';
        } else {
          const hDoc = obj.userData.doc as MapDocument;
          setHoveredDoc(hDoc);
          container!.style.cursor = 'pointer';
        }
      } else {
        setHoveredDoc(null);
        container!.style.cursor = isDragging.current ? 'grabbing' : 'grab';
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.08 : 0.92;
      targetDist.current = Math.max(3, Math.min(40, targetDist.current * delta));
    }

    function onMouseLeave() {
      isDragging.current = false;
      setHoveredDoc(null);
      mouseNDC.current.set(10, 10);
    }

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('mouseleave', onMouseLeave);

    function onResize() {
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // Proximity label pool
    const LABEL_POOL_SIZE = 8;
    const labelPool: HTMLDivElement[] = [];
    const labelsContainer = labelsRef.current;
    if (labelsContainer) {
      for (let i = 0; i < LABEL_POOL_SIZE; i++) {
        const el = document.createElement('div');
        el.className = styles.proximityLabel;
        el.style.display = 'none';
        labelsContainer.appendChild(el);
        labelPool.push(el);
      }
    }

    // Cluster label elements
    const clusterLabelEls: HTMLDivElement[] = [];
    if (labelsContainer) {
      clusters.forEach((cluster, i) => {
        const el = document.createElement('div');
        el.className = styles.clusterLabel;
        el.textContent = cluster.label.toUpperCase();
        el.style.color = CLUSTER_PALETTE_CSS[i % CLUSTER_PALETTE_CSS.length];
        labelsContainer.appendChild(el);
        clusterLabelEls.push(el);
      });
    }

    // === Star Birth Effect System ===
    const BIRTH_COLORS = {
      dust:    new THREE.Color(0.4, 0.2, 0.1),
      warm:    new THREE.Color(0.8, 0.4, 0.15),
      hot:     new THREE.Color(1.0, 0.85, 0.6),
      ignite:  new THREE.Color(1.0, 1.0, 0.95),
      star:    new THREE.Color(0.7, 0.8, 1.0),
    };

    function createStarBirth(origin: THREE.Vector3, _color: number) {
      const PARTICLE_COUNT = 400;
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const particleOrigins = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const dist = 2 + Math.random() * 5;
        const noiseSeed = i * 11 + 7;
        const cloudNoise = 1 + 0.5 * noise1D(theta * 2 + phi, noiseSeed);
        const r = dist * cloudNoise;

        const sx = origin.x + r * Math.sin(phi) * Math.cos(theta);
        const sy = origin.y + r * Math.sin(phi) * Math.sin(theta);
        const sz = origin.z + r * Math.cos(phi);

        positions[i * 3] = sx;
        positions[i * 3 + 1] = sy;
        positions[i * 3 + 2] = sz;
        particleOrigins[i * 3] = sx;
        particleOrigins[i * 3 + 1] = sy;
        particleOrigins[i * 3 + 2] = sz;

        colors[i * 3] = BIRTH_COLORS.dust.r;
        colors[i * 3 + 1] = BIRTH_COLORS.dust.g;
        colors[i * 3 + 2] = BIRTH_COLORS.dust.b;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const birthTexture = createSupernovaTexture();
      const mat = new THREE.PointsMaterial({
        size: 0.15,
        map: birthTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const particles = new THREE.Points(geo, mat);
      scene.add(particles);

      const flash = new THREE.PointLight(0x886644, 0.5, 10);
      flash.position.copy(origin);
      scene.add(flash);

      activeStarBirthsRef.current.push({
        particles,
        flash,
        startTime: performance.now() / 1000,
        origin,
        particleOrigins,
        duration: 4.0,
        phase: 'collapse',
      });
    }

    // === Physics-Based Supernova Effect System ===
    const SN_COLORS = {
      uv:     new THREE.Color(0.4, 0.6, 1.0),
      hot:    new THREE.Color(0.9, 0.95, 1.0),
      warm:   new THREE.Color(1.0, 0.95, 0.7),
      cool:   new THREE.Color(1.0, 0.75, 0.3),
      cold:   new THREE.Color(1.0, 0.4, 0.2),
      remnant: new THREE.Color(0.8, 0.2, 0.15),
    };

    function createSupernova(origin: THREE.Vector3, color: number) {
      const PARTICLE_COUNT = 500;
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const layers = new Float32Array(PARTICLE_COUNT);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 3] = origin.x;
        positions[i * 3 + 1] = origin.y;
        positions[i * 3 + 2] = origin.z;

        const layerRoll = Math.random();
        const layer = layerRoll < 0.25 ? 0 : layerRoll < 0.6 ? 1 : 2;
        layers[i] = layer;

        const baseSpeed = layer === 2 ? 3 + Math.random() * 4
                        : layer === 1 ? 1.5 + Math.random() * 2
                        :               0.3 + Math.random() * 1;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const noiseSeed = i * 7 + 13;
        const rtNoise = 1 + 0.4 * noise1D(theta * 3 + phi * 2, noiseSeed);
        const speed = baseSpeed * rtNoise;

        velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
        velocities[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
        velocities[i * 3 + 2] = speed * Math.cos(phi);

        colors[i * 3] = SN_COLORS.uv.r;
        colors[i * 3 + 1] = SN_COLORS.uv.g;
        colors[i * 3 + 2] = SN_COLORS.uv.b;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const snTexture = createSupernovaTexture();
      const mat = new THREE.PointsMaterial({
        size: 0.15,
        map: snTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const particles = new THREE.Points(geo, mat);
      scene.add(particles);

      const flash = new THREE.PointLight(0xaaccff, 0, 20);
      flash.position.copy(origin);
      scene.add(flash);

      // GW rings
      const rings: THREE.Mesh[] = [];
      const ringColors = [0xffffff, 0xccddff, color, color, 0xaaaacc];
      for (let ri = 0; ri < 5; ri++) {
        const thickness = ri < 2 ? 0.15 : 0.08;
        const ringGeo = new THREE.RingGeometry(1 - thickness, 1, 64);
        const ringMat = new THREE.MeshBasicMaterial({
          color: ringColors[ri],
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(origin);
        ring.userData = { delay: [0, 0.1, 0.3, 0.5, 0.8][ri] };
        scene.add(ring);
        rings.push(ring);
      }

      activeSupernovaeRef.current.push({
        particles,
        flash,
        rings,
        startTime: performance.now() / 1000,
        origin,
        velocities,
        layers,
        baseColor: color,
        duration: 5.0,
        waveRadius: 0,
        waveSpeed: 5,
        phase: 'collapse',
      });
    }

    // === Animation loop ===
    let time = 0;
    const dt = 1 / 60;
    const tempVec = new THREE.Vector3();
    const lookAtVec = new THREE.Vector3();

    function animate() {
      time += 0.016;

      if (!isDragging.current && !prefersReduced && !handModeRef.current) {
        targetAngleX.current += 0.00008;
      }

      camAngleX.current = cdsTween(camAngleX.current, targetAngleX.current, 3, dt);
      camAngleY.current = cdsTween(camAngleY.current, targetAngleY.current, 3, dt);
      camDist.current = cdsTween(camDist.current, targetDist.current, 4, dt);

      lookAtX.current = cdsTween(lookAtX.current, targetLookAtX.current, 3, dt);
      lookAtY.current = cdsTween(lookAtY.current, targetLookAtY.current, 3, dt);
      lookAtZ.current = cdsTween(lookAtZ.current, targetLookAtZ.current, 3, dt);

      const dist = camDist.current.x;
      const laX = lookAtX.current.x;
      const laY = lookAtY.current.x;
      const laZ = lookAtZ.current.x;

      camera.position.x = laX + Math.sin(camAngleX.current.x) * Math.cos(camAngleY.current.x) * dist;
      camera.position.y = laY + Math.sin(camAngleY.current.x) * dist;
      camera.position.z = laZ + Math.cos(camAngleX.current.x) * Math.cos(camAngleY.current.x) * dist;
      lookAtVec.set(laX, laY, laZ);
      camera.lookAt(lookAtVec);

      const matches = matchIdsRef.current;
      const hasSearch = matches.size > 0;
      const hovered = hoveredDocRef.current;
      const mx = mouseNDC.current.x;
      const my = mouseNDC.current.y;

      // Which clusters have matched documents
      const matchedClusters = new Set<string>();
      if (hasSearch) {
        for (const doc of documents) {
          if (matches.has(doc.id) || (doc.chunkIds?.some(cid => matches.has(cid)) ?? false)) {
            matchedClusters.add(doc.clusterId);
          }
        }
      }

      const w = container!.clientWidth;
      const h = container!.clientHeight;
      const aspectRatio = w / h;

      // Pulse cluster stars
      clusterMeshes.forEach((mesh, i) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const pulse = 1 + Math.sin(time * 1.5 + i * 0.7) * 0.08;
        mesh.scale.setScalar(pulse);

        if (hasSearch) {
          const cluster = mesh.userData.cluster as ClusterMeta;
          const isMatchedCluster = matchedClusters.has(cluster.id);
          mat.emissiveIntensity = isMatchedCluster ? 1.8 : 0.2;
          mat.opacity = isMatchedCluster ? 1.0 : 0.15;
        } else {
          mat.emissiveIntensity = 1.2;
          mat.opacity = 0.95;
        }
      });

      // Update cluster label positions
      clusterLabelEls.forEach((el, i) => {
        if (i >= clusters.length) return;
        const cluster = clusters[i];
        tempVec.set(cluster.cx, cluster.cy + cluster.radius * 0.5 + 0.5, cluster.cz);
        tempVec.project(camera);

        if (tempVec.z > 1) {
          el.style.display = 'none';
          return;
        }

        const camDistToCluster = Math.sqrt(
          Math.pow(camera.position.x - cluster.cx, 2) +
          Math.pow(camera.position.y - cluster.cy, 2) +
          Math.pow(camera.position.z - cluster.cz, 2)
        );
        if (camDistToCluster > 35) {
          el.style.display = 'none';
          return;
        }

        const px = (tempVec.x + 1) * 0.5 * w;
        const py = (1 - (tempVec.y + 1) * 0.5) * h;
        el.style.left = `${px}px`;
        el.style.top = `${py}px`;
        el.style.display = '';

        if (hasSearch) {
          el.style.opacity = matchedClusters.has(cluster.id) ? '1' : '0.15';
        } else {
          el.style.opacity = '0.85';
        }
      });

      // === Orbital animation: planets ===
      const nearby: { screenDist: number; ndcX: number; ndcY: number; doc: MapDocument; color: string }[] = [];

      for (const doc of planetDocs) {
        const mesh = meshById.get(doc.id);
        if (!mesh) continue;
        const baseScl = mesh.userData.baseScale as number;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const isMatched = hasSearch && (matches.has(doc.id) || (doc.chunkIds?.some(cid => matches.has(cid)) ?? false));
        const isFaded = hasSearch && !isMatched;

        const base = clusterBases.get(doc.clusterId);
        if (base && !prefersReduced) {
          const a = doc.orbitRadius;
          const ecc = 0.02 + ((doc.orbitPhase * 7.3 + doc.orbitRadius * 3.1) % 1.0) * 0.23;
          const b = a * Math.sqrt(1 - ecc * ecc);

          const M = (doc.orbitPhase + time * doc.orbitSpeed * 0.25) % (Math.PI * 2);

          let E = M + ecc * Math.sin(M);
          E = E - (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E));
          E = E - (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E));

          const ox = a * (Math.cos(E) - ecc);
          const oy = b * Math.sin(E);

          const incl = (doc.orbitPhase * 2.7) % 1.0 * 0.6 - 0.3;
          const cosI = Math.cos(incl), sinI = Math.sin(incl);
          const tux = base.ux * cosI + base.nx * sinI;
          const tuy = base.uy * cosI + base.ny * sinI;
          const tuz = base.uz * cosI + base.nz * sinI;

          const omega = (doc.orbitPhase * 4.1) % (Math.PI * 2);
          const cosW = Math.cos(omega), sinW = Math.sin(omega);
          const rx = ox * cosW - oy * sinW;
          const ry = ox * sinW + oy * cosW;

          const px = base.cx + rx * tux + ry * base.vx;
          const py = base.cy + rx * tuy + ry * base.vy;
          const pz = base.cz + rx * tuz + ry * base.vz;
          mesh.position.set(px, py, pz);
        }

        // Dock magnification
        tempVec.copy(mesh.position).project(camera);
        const screenDist = Math.sqrt(
          Math.pow((tempVec.x - mx) * aspectRatio, 2) +
          Math.pow(tempVec.y - my, 2)
        );
        const magnifyRadius = 0.5;
        const magnifyFactor = screenDist < magnifyRadius
          ? 1 + 0.6 * Math.pow(1 - screenDist / magnifyRadius, 2)
          : 1;

        let scale = baseScl * magnifyFactor;
        if (isMatched) scale *= 1.4;
        mesh.scale.setScalar(scale);

        const baseGlow = isFaded ? 0.1 : 0.5;
        mat.emissiveIntensity = baseGlow + (magnifyFactor - 1) * 0.6;
        if (isMatched) mat.emissiveIntensity = 1.0;
        if (hovered?.id === doc.id) mat.emissiveIntensity = 1.2;
        mat.opacity = isFaded ? 0.04 : 1.0;

        if (!isFaded && screenDist < 0.5 && tempVec.z < 1) {
          nearby.push({ screenDist, ndcX: tempVec.x, ndcY: tempVec.y, doc, color: TYPE_COLORS[doc.type] || TYPE_COLORS.unknown || '#666' });
        }
      }

      // === Orbital animation: moons ===
      for (const doc of moonDocs) {
        const mesh = meshById.get(doc.id);
        const parentMesh = doc.parentId ? meshById.get(doc.parentId) : null;
        if (!mesh) continue;
        const baseScl = mesh.userData.baseScale as number;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const isMatched = hasSearch && (matches.has(doc.id) || (doc.chunkIds?.some(cid => matches.has(cid)) ?? false));
        const isFaded = hasSearch && !isMatched;

        if (parentMesh && !prefersReduced) {
          const pp = parentMesh.position;
          const angle = doc.orbitPhase + time * doc.orbitSpeed * 0.25;
          const r = doc.orbitRadius;
          const tiltCos = Math.cos(doc.orbitTilt), tiltSin = Math.sin(doc.orbitTilt);
          mesh.position.set(
            pp.x + r * Math.cos(angle),
            pp.y + r * Math.sin(angle) * tiltSin,
            pp.z + r * Math.sin(angle) * tiltCos
          );
        }

        tempVec.copy(mesh.position).project(camera);
        const screenDist = Math.sqrt(
          Math.pow((tempVec.x - mx) * aspectRatio, 2) +
          Math.pow(tempVec.y - my, 2)
        );
        const magnifyRadius = 0.5;
        const magnifyFactor = screenDist < magnifyRadius
          ? 1 + 0.4 * Math.pow(1 - screenDist / magnifyRadius, 2)
          : 1;

        let scale = baseScl * magnifyFactor;
        if (isMatched) scale *= 1.3;
        mesh.scale.setScalar(scale);

        const baseGlow = isFaded ? 0.1 : 0.4;
        mat.emissiveIntensity = baseGlow + (magnifyFactor - 1) * 0.5;
        if (isMatched) mat.emissiveIntensity = 0.9;
        if (hovered?.id === doc.id) mat.emissiveIntensity = 1.2;
        mat.opacity = isFaded ? 0.03 : 0.9;

        if (!isFaded && screenDist < 0.4 && tempVec.z < 1) {
          nearby.push({ screenDist, ndcX: tempVec.x, ndcY: tempVec.y, doc, color: TYPE_COLORS[doc.type] || TYPE_COLORS.unknown || '#666' });
        }
      }

      // Position proximity labels
      nearby.sort((a, b) => a.screenDist - b.screenDist);
      for (let li = 0; li < labelPool.length; li++) {
        const el = labelPool[li];
        if (li < nearby.length) {
          const n = nearby[li];
          const px = (n.ndcX + 1) * 0.5 * w;
          const py = (1 - (n.ndcY + 1) * 0.5) * h;
          const opacity = Math.max(0.3, 1 - n.screenDist / 0.5);
          el.textContent = extractTitle(n.doc.sourceFile);
          el.style.left = `${px + 10}px`;
          el.style.top = `${py - 8}px`;
          el.style.opacity = String(opacity);
          el.style.color = n.color;
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      }

      // === Star Birth processing ===
      const birthQueue = starBirthQueueRef.current;
      while (birthQueue.length > 0) {
        const sb = birthQueue.shift()!;
        createStarBirth(new THREE.Vector3(sb.x, sb.y, sb.z), sb.color);
      }

      // Animate active star births
      const birthNow = performance.now() / 1000;
      const births = activeStarBirthsRef.current;
      for (let bi = births.length - 1; bi >= 0; bi--) {
        const sb = births[bi];
        const elapsed = birthNow - sb.startTime;
        const progress = elapsed / sb.duration;

        if (progress >= 1) {
          scene.remove(sb.particles);
          scene.remove(sb.flash);
          const sbMat = sb.particles.material as THREE.PointsMaterial;
          if (sbMat.map) sbMat.map.dispose();
          sbMat.dispose();
          sb.particles.geometry.dispose();
          births.splice(bi, 1);
          continue;
        }

        const posAttr = sb.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
        const colAttr = sb.particles.geometry.getAttribute('color') as THREE.BufferAttribute;
        const positionsArr = posAttr.array as Float32Array;
        const pColors = colAttr.array as Float32Array;
        const origins = sb.particleOrigins;
        const pMat = sb.particles.material as THREE.PointsMaterial;
        const particleCount = positionsArr.length / 3;
        const ox2 = sb.origin.x, oy2 = sb.origin.y, oz2 = sb.origin.z;

        if (elapsed < 1.5) {
          const collapseProgress = elapsed / 1.5;
          const t = collapseProgress * collapseProgress * collapseProgress;

          for (let pi = 0; pi < particleCount; pi++) {
            positionsArr[pi * 3] = origins[pi * 3] + (ox2 - origins[pi * 3]) * t;
            positionsArr[pi * 3 + 1] = origins[pi * 3 + 1] + (oy2 - origins[pi * 3 + 1]) * t;
            positionsArr[pi * 3 + 2] = origins[pi * 3 + 2] + (oz2 - origins[pi * 3 + 2]) * t;
            const cT = collapseProgress;
            pColors[pi * 3] = BIRTH_COLORS.dust.r + (BIRTH_COLORS.warm.r - BIRTH_COLORS.dust.r) * cT;
            pColors[pi * 3 + 1] = BIRTH_COLORS.dust.g + (BIRTH_COLORS.warm.g - BIRTH_COLORS.dust.g) * cT;
            pColors[pi * 3 + 2] = BIRTH_COLORS.dust.b + (BIRTH_COLORS.warm.b - BIRTH_COLORS.dust.b) * cT;
          }
          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;

          pMat.opacity = 0.4 + collapseProgress * 0.4;
          pMat.size = 0.18 - collapseProgress * 0.08;
          sb.flash.intensity = 0.5 + collapseProgress * 3;
          sb.flash.color.setHex(0xaa6633);
          sb.phase = 'collapse';

        } else if (elapsed < 2.0) {
          const igniteProgress = (elapsed - 1.5) / 0.5;

          for (let pi = 0; pi < particleCount; pi++) {
            const jitter = 0.1 * (1 - igniteProgress);
            positionsArr[pi * 3] = ox2 + (Math.random() - 0.5) * jitter;
            positionsArr[pi * 3 + 1] = oy2 + (Math.random() - 0.5) * jitter;
            positionsArr[pi * 3 + 2] = oz2 + (Math.random() - 0.5) * jitter;
            pColors[pi * 3] = BIRTH_COLORS.warm.r + (BIRTH_COLORS.ignite.r - BIRTH_COLORS.warm.r) * igniteProgress;
            pColors[pi * 3 + 1] = BIRTH_COLORS.warm.g + (BIRTH_COLORS.ignite.g - BIRTH_COLORS.warm.g) * igniteProgress;
            pColors[pi * 3 + 2] = BIRTH_COLORS.warm.b + (BIRTH_COLORS.ignite.b - BIRTH_COLORS.warm.b) * igniteProgress;
          }
          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;

          pMat.opacity = 1.0;
          pMat.size = 0.08 + igniteProgress * 0.25;
          sb.flash.intensity = 5 + igniteProgress * 35;
          sb.flash.color.setHex(0xffeedd);
          sb.flash.distance = 40;
          sb.phase = 'ignition';

        } else if (elapsed < 3.0) {
          const shineProgress = (elapsed - 2.0) / 1.0;

          for (let pi = 0; pi < particleCount; pi++) {
            const angle = pi * 0.1 + elapsed * 2;
            const r = 0.1 + Math.random() * 0.15 * (1 - shineProgress * 0.5);
            positionsArr[pi * 3] = ox2 + Math.cos(angle) * r * Math.sin(pi * 0.3);
            positionsArr[pi * 3 + 1] = oy2 + Math.sin(angle) * r;
            positionsArr[pi * 3 + 2] = oz2 + Math.cos(angle + pi) * r * Math.cos(pi * 0.3);
            pColors[pi * 3] = BIRTH_COLORS.ignite.r + (BIRTH_COLORS.star.r - BIRTH_COLORS.ignite.r) * shineProgress;
            pColors[pi * 3 + 1] = BIRTH_COLORS.ignite.g + (BIRTH_COLORS.star.g - BIRTH_COLORS.ignite.g) * shineProgress;
            pColors[pi * 3 + 2] = BIRTH_COLORS.ignite.b + (BIRTH_COLORS.star.b - BIRTH_COLORS.ignite.b) * shineProgress;
          }
          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;

          pMat.opacity = 1.0 - shineProgress * 0.3;
          pMat.size = 0.25 - shineProgress * 0.1;
          sb.flash.intensity = 40 * (1 - shineProgress * 0.7);
          sb.flash.color.setHex(0xaabbff);
          sb.phase = 'shine';

        } else {
          const settleProgress = (elapsed - 3.0) / 1.0;

          pMat.opacity = Math.max(0, 0.7 * (1 - settleProgress));
          pMat.size = 0.15 * (1 - settleProgress * 0.5);
          sb.flash.intensity = Math.max(0, 12 * (1 - settleProgress));
          sb.phase = 'settle';
        }
      }

      // === Supernova processing ===
      const queue = supernovaQueueRef.current;
      while (queue.length > 0) {
        const sn = queue.shift()!;
        createSupernova(new THREE.Vector3(sn.x, sn.y, sn.z), sn.color);
      }

      const now = performance.now() / 1000;
      const supernovae = activeSupernovaeRef.current;
      for (let si = supernovae.length - 1; si >= 0; si--) {
        const sn = supernovae[si];
        const elapsed = now - sn.startTime;
        const progress = elapsed / sn.duration;

        if (progress >= 1) {
          scene.remove(sn.particles);
          scene.remove(sn.flash);
          sn.rings.forEach(r => { scene.remove(r); (r.geometry as THREE.BufferGeometry).dispose(); (r.material as THREE.Material).dispose(); });
          sn.particles.geometry.dispose();
          (sn.particles.material as THREE.Material).dispose();
          supernovae.splice(si, 1);
          continue;
        }

        const phase = elapsed < 0.10 ? 'collapse'
                    : elapsed < 0.40 ? 'bounce'
                    : elapsed < 0.60 ? 'breakout'
                    : elapsed < 3.50 ? 'expand'
                    : 'fade';
        sn.phase = phase;

        const posAttr = sn.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
        const colAttr = sn.particles.geometry.getAttribute('color') as THREE.BufferAttribute;
        const positionsArr = posAttr.array as Float32Array;
        const pColors = colAttr.array as Float32Array;
        const vels = sn.velocities;
        const pMat = sn.particles.material as THREE.PointsMaterial;
        const dtFrame = 0.016;
        const particleCount = positionsArr.length / 3;

        if (phase === 'collapse') {
          const collapseProgress = elapsed / 0.10;
          pMat.opacity = collapseProgress * 0.5;
          pMat.size = 0.15 * (1 - collapseProgress * 0.5);
          sn.flash.intensity = collapseProgress * 5;
          sn.flash.color.setHex(0x4466aa);
        } else if (phase === 'bounce') {
          const bounceElapsed = elapsed - 0.10;
          const bounceProgress = bounceElapsed / 0.30;
          const flashIntensity = bounceProgress < 0.15
            ? 30 * (bounceProgress / 0.15)
            : 30 * Math.max(0, 1 - (bounceProgress - 0.15) / 0.85);
          sn.flash.intensity = flashIntensity;
          sn.flash.color.setHex(0xaaccff);

          pMat.opacity = 0.7 + bounceProgress * 0.3;
          pMat.size = 0.12 + bounceProgress * 0.12;
          const expansionFactor = bounceProgress * 0.3;
          for (let pi = 0; pi < particleCount; pi++) {
            const layer = sn.layers[pi];
            const layerFactor = layer === 0 ? 1.0 : layer === 1 ? 0.3 : 0.05;
            positionsArr[pi * 3] += vels[pi * 3] * dtFrame * expansionFactor * layerFactor;
            positionsArr[pi * 3 + 1] += vels[pi * 3 + 1] * dtFrame * expansionFactor * layerFactor;
            positionsArr[pi * 3 + 2] += vels[pi * 3 + 2] * dtFrame * expansionFactor * layerFactor;
          }
          posAttr.needsUpdate = true;
          for (let pi = 0; pi < particleCount; pi++) {
            pColors[pi * 3] = SN_COLORS.uv.r;
            pColors[pi * 3 + 1] = SN_COLORS.uv.g;
            pColors[pi * 3 + 2] = SN_COLORS.uv.b;
          }
          colAttr.needsUpdate = true;
        } else if (phase === 'breakout') {
          const breakoutElapsed = elapsed - 0.40;
          const breakoutProgress = breakoutElapsed / 0.20;
          sn.flash.intensity = 40 * Math.max(0, 1 - breakoutProgress * 0.5);
          sn.flash.color.setHex(0xeeeeff);
          sn.flash.distance = 50;

          pMat.opacity = 1.0;
          pMat.size = 0.20 + breakoutProgress * 0.08;
          for (let pi = 0; pi < particleCount; pi++) {
            positionsArr[pi * 3] += vels[pi * 3] * dtFrame;
            positionsArr[pi * 3 + 1] += vels[pi * 3 + 1] * dtFrame;
            positionsArr[pi * 3 + 2] += vels[pi * 3 + 2] * dtFrame;
          }
          posAttr.needsUpdate = true;
          for (let pi = 0; pi < particleCount; pi++) {
            const t2 = breakoutProgress;
            pColors[pi * 3] = SN_COLORS.uv.r + (SN_COLORS.hot.r - SN_COLORS.uv.r) * t2;
            pColors[pi * 3 + 1] = SN_COLORS.uv.g + (SN_COLORS.hot.g - SN_COLORS.uv.g) * t2;
            pColors[pi * 3 + 2] = SN_COLORS.uv.b + (SN_COLORS.hot.b - SN_COLORS.uv.b) * t2;
          }
          colAttr.needsUpdate = true;
        } else if (phase === 'expand') {
          const expandElapsed = elapsed - 0.60;
          const expandDuration = 2.90;
          const expandProgress = expandElapsed / expandDuration;

          const sedovFactor = Math.pow(Math.max(0.01, expandElapsed), -0.6);
          const speedScale = Math.min(1.0, sedovFactor * 0.3);

          const plateauEnd = 0.6;
          if (expandProgress < plateauEnd) {
            sn.flash.intensity = 10 * (1 - expandProgress / plateauEnd * 0.3);
          } else {
            const dropProgress = (expandProgress - plateauEnd) / (1 - plateauEnd);
            sn.flash.intensity = 10 * 0.7 * Math.max(0, 1 - dropProgress * dropProgress);
          }

          pMat.opacity = Math.max(0.15, 1 - expandProgress * 0.6);
          pMat.size = 0.22 + expandProgress * 0.15;

          for (let pi = 0; pi < particleCount; pi++) {
            positionsArr[pi * 3] += vels[pi * 3] * dtFrame * speedScale;
            positionsArr[pi * 3 + 1] += vels[pi * 3 + 1] * dtFrame * speedScale;
            positionsArr[pi * 3 + 2] += vels[pi * 3 + 2] * dtFrame * speedScale;
          }
          posAttr.needsUpdate = true;

          const colorStages = [SN_COLORS.hot, SN_COLORS.warm, SN_COLORS.cool, SN_COLORS.cold];
          const colorT = expandProgress * (colorStages.length - 1);
          const colorIdx = Math.min(Math.floor(colorT), colorStages.length - 2);
          const colorFrac = colorT - colorIdx;
          const cA = colorStages[colorIdx];
          const cB = colorStages[colorIdx + 1];
          for (let pi = 0; pi < particleCount; pi++) {
            const layer = sn.layers[pi];
            const layerOffset = layer === 0 ? 0.15 : layer === 2 ? -0.1 : 0;
            const t2 = Math.max(0, Math.min(1, colorFrac + layerOffset));
            pColors[pi * 3] = cA.r + (cB.r - cA.r) * t2;
            pColors[pi * 3 + 1] = cA.g + (cB.g - cA.g) * t2;
            pColors[pi * 3 + 2] = cA.b + (cB.b - cA.b) * t2;
          }
          colAttr.needsUpdate = true;
        } else {
          const fadeElapsed = elapsed - 3.50;
          const fadeProgress = fadeElapsed / 1.50;

          sn.flash.intensity = Math.max(0, 1.5 * (1 - fadeProgress));
          pMat.opacity = Math.max(0, 0.4 * (1 - fadeProgress));
          pMat.size = 0.35 + fadeProgress * 0.05;

          for (let pi = 0; pi < particleCount; pi++) {
            const drift = 0.05 * (1 - fadeProgress);
            positionsArr[pi * 3] += vels[pi * 3] * dtFrame * drift;
            positionsArr[pi * 3 + 1] += vels[pi * 3 + 1] * dtFrame * drift;
            positionsArr[pi * 3 + 2] += vels[pi * 3 + 2] * dtFrame * drift;
          }
          posAttr.needsUpdate = true;

          for (let pi = 0; pi < particleCount; pi++) {
            const t2 = fadeProgress;
            pColors[pi * 3] = SN_COLORS.cold.r + (SN_COLORS.remnant.r - SN_COLORS.cold.r) * t2;
            pColors[pi * 3 + 1] = SN_COLORS.cold.g + (SN_COLORS.remnant.g - SN_COLORS.cold.g) * t2;
            pColors[pi * 3 + 2] = SN_COLORS.cold.b + (SN_COLORS.remnant.b - SN_COLORS.cold.b) * t2;
          }
          colAttr.needsUpdate = true;
        }

        // GW wave
        const gwElapsed = Math.max(0, elapsed - 0.10);
        sn.waveRadius = gwElapsed * sn.waveSpeed;

        // GW Rings
        sn.rings.forEach(ring => {
          const delay = (ring.userData as { delay: number }).delay;
          const ringElapsed = elapsed - 0.10 - delay;
          if (ringElapsed < 0) {
            (ring.material as THREE.MeshBasicMaterial).opacity = 0;
            return;
          }
          const ringDuration = sn.duration - 0.10 - delay;
          const ringProgress = ringElapsed / ringDuration;
          const ringScale = 0.3 + Math.pow(ringElapsed, 0.7) * sn.waveSpeed * 0.6;
          ring.scale.setScalar(ringScale);
          const fadeInR = Math.min(1, ringElapsed / 0.15);
          const invRDecay = 1 / (1 + ringScale * 0.12);
          const fadeOutR = Math.max(0, 1 - ringProgress);
          (ring.material as THREE.MeshBasicMaterial).opacity = fadeInR * fadeOutR * invRDecay * 0.45;
          ring.lookAt(camera.position);
        });

        // Gravitational force
        const waveR = sn.waveRadius;
        const waveBand = 2.0;
        const forceStrength = 0.025;
        const gwBaseFreq = 18;

        for (const mesh of meshes) {
          const dx = mesh.position.x - sn.origin.x;
          const dy = mesh.position.y - sn.origin.y;
          const dz = mesh.position.z - sn.origin.z;
          const distM = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (distM < 0.01) continue;

          const distFromWave = Math.abs(distM - waveR);
          if (distFromWave < waveBand) {
            const influence = 1 - distFromWave / waveBand;
            const amplitudeDecay = 1 / (1 + distM * 0.5);
            const force = forceStrength * influence * influence * amplitudeDecay * (1 - progress);
            mesh.position.x += (dx / distM) * force;
            mesh.position.y += (dy / distM) * force;
            mesh.position.z += (dz / distM) * force;
            const freq = gwBaseFreq / (1 + distM * 0.3);
            const noiseVal = noise1D(elapsed * 5 + distM, Math.floor(distM * 100));
            const wobbleAmp = 0.3 * amplitudeDecay * influence;
            const wobble = 1 + wobbleAmp * (Math.sin(elapsed * freq) * 0.7 + noiseVal * 0.3) * (1 - progress);
            const baseScl = mesh.userData.baseScale as number;
            mesh.scale.setScalar(baseScl * wobble);
          }
        }

        for (const cmesh of clusterMeshes) {
          const dx = cmesh.position.x - sn.origin.x;
          const dy = cmesh.position.y - sn.origin.y;
          const dz = cmesh.position.z - sn.origin.z;
          const distM = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (distM < 0.01) continue;

          const distFromWave = Math.abs(distM - waveR);
          if (distFromWave < waveBand * 1.5) {
            const influence = 1 - distFromWave / (waveBand * 1.5);
            const amplitudeDecay = 1 / (1 + distM * 0.4);
            const freq = gwBaseFreq * 0.7 / (1 + distM * 0.25);
            const noiseVal = noise1D(elapsed * 4 + distM * 2, Math.floor(distM * 77));
            const wobble = 1 + 0.15 * amplitudeDecay * influence * (Math.sin(elapsed * freq) * 0.6 + noiseVal * 0.4) * (1 - progress);
            cmesh.scale.setScalar(wobble * (1 + Math.sin(time * 1.5) * 0.08));
            const cmat = cmesh.material as THREE.MeshStandardMaterial;
            cmat.emissiveIntensity = 1.2 + 1.5 * influence * amplitudeDecay * (1 - progress);
          }
        }
      }

      composer.render();
      animRef.current = requestAnimationFrame(animate);
    }

    animate();

    // === Cleanup ===
    return () => {
      cancelAnimationFrame(animRef.current);
      labelPool.forEach(el => el.remove());
      clusterLabelEls.forEach(el => el.remove());
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', onResize);

      meshes.forEach((mesh) => {
        (mesh.material as THREE.Material).dispose();
        scene.remove(mesh);
      });
      clusterMeshes.forEach((mesh) => {
        (mesh.material as THREE.Material).dispose();
        scene.remove(mesh);
      });
      nebulaPoints.forEach(p => { p.geometry.dispose(); (p.material as THREE.Material).dispose(); scene.remove(p); });
      activeStarBirthsRef.current.forEach(sb => {
        scene.remove(sb.particles); scene.remove(sb.flash);
        const sbMat = sb.particles.material as THREE.PointsMaterial;
        if (sbMat.map) sbMat.map.dispose(); sbMat.dispose();
        sb.particles.geometry.dispose();
      });
      activeStarBirthsRef.current = [];
      activeSupernovaeRef.current.forEach(sn => {
        scene.remove(sn.particles); scene.remove(sn.flash);
        sn.rings.forEach(r => { scene.remove(r); (r.geometry as THREE.BufferGeometry).dispose(); (r.material as THREE.Material).dispose(); });
        sn.particles.geometry.dispose(); const snMat = sn.particles.material as THREE.PointsMaterial; if (snMat.map) snMat.map.dispose(); snMat.dispose();
      });
      activeSupernovaeRef.current = [];
      nebulaTexture.dispose();
      planetGeometry.dispose();
      moonGeometry.dispose();
      starGeometry.dispose();
      starGeo.dispose();
      starMat.dispose();
      composer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, clusters, nebulae, zoomToCluster]);

  // Type counts
  const typeCounts = documents.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Layout class
  const containerClass = embedded
    ? styles.containerEmbed
    : heightMode === 'auto'
    ? styles.containerFullHeight
    : styles.container;

  if (documents.length === 0) {
    return (
      <div className={`${containerClass} ${styles.fadeIn} ${className ?? ''}`}>
        <div className={styles.mapArea}>
          <div className={styles.emptyOverlay}>
            <div className={styles.emptyTitle}>No Documents Yet</div>
            <div className={styles.emptyHint}>
              Pass documents, clusters, and nebulae through props to populate<br />
              the 3-D knowledge universe.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${containerClass} ${styles.fadeIn} ${className ?? ''}`}>
      <div className={styles.mapArea}>
        {!embedded && (
          <div className={styles.searchOverlay}>
            {/* Search is driven by highlightIds prop externally.
                This area can be extended with an <input> and onSearch callback. */}
          </div>
        )}

        <div ref={containerRef} className={styles.threeCanvas} />
        <div ref={labelsRef} className={styles.labelsOverlay} />

        {hoveredDoc && (
          <div className={styles.tooltip}>
            <div className={styles.tooltipType} style={{ color: TYPE_COLORS[hoveredDoc.type] }}>
              {hoveredDoc.type}
            </div>
            <div className={styles.tooltipTitle}>{extractTitle(hoveredDoc.sourceFile)}</div>
            {hoveredDoc.concepts.length > 0 && (
              <div className={styles.tooltipConcepts}>
                {hoveredDoc.concepts.slice(0, 4).join(', ')}
              </div>
            )}
          </div>
        )}

        {!embedded && (
          <div className={styles.legend}>
            {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'unknown').map(([type, color]) => (
              <span key={type} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: color }} />
                {type}
              </span>
            ))}
          </div>
        )}

        {!embedded && (
          <div className={styles.zoomControls}>
            <button
              onClick={() => { targetDist.current = Math.max(3, targetDist.current * 0.75); }}
              className={styles.zoomBtn}
            >+</button>
            <button
              onClick={() => { targetDist.current = Math.min(40, targetDist.current * 1.35); }}
              className={styles.zoomBtn}
            >-</button>
            <button
              onClick={zoomOut}
              className={styles.zoomBtn}
              title="Reset view"
            >R</button>
            <button
              onClick={toggleHandMode}
              className={styles.zoomBtn}
              style={handTracking ? { background: 'rgba(74, 222, 128, 0.3)', borderColor: '#4ade80', color: '#4ade80' } : undefined}
              title="Hand tracking"
            >{handTracking ? 'H' : 'H'}</button>
            {ambientAudioSrc && (
              <button
                onClick={toggleMute}
                className={styles.zoomBtn}
                style={!muted ? { background: 'rgba(96, 165, 250, 0.3)', borderColor: '#60a5fa', color: '#60a5fa' } : undefined}
                title={muted ? 'Play music' : 'Mute music'}
              >{muted ? 'M' : 'S'}</button>
            )}
          </div>
        )}

        {handMode && (
          <div className={styles.handPanel}>
            <div style={{ color: '#4ade80', fontSize: 12, marginBottom: 4 }}>Hand Tracking</div>
            <div style={{ color: '#888', fontSize: 10 }}>{handDebug}</div>
            {handError ? (
              <div style={{ color: '#f87171', fontSize: 11 }}>{handError}</div>
            ) : handTracking && handPosition ? (
              <>
                <div style={{ color: '#e0e0e0', fontSize: 11 }}>
                  X: {(handPosition.x * 100).toFixed(0)}% | Y: {(handPosition.y * 100).toFixed(0)}%
                </div>
                {gesture && (
                  <div style={{ color: '#fbbf24', fontSize: 10, marginTop: 4 }}>
                    {gesture === 'fist' ? 'Zoom In' : gesture === 'point' ? 'Hold' : gesture === 'open' ? 'Zoom Out' : gesture === 'peace' ? 'Peace' : ''}
                  </div>
                )}
              </>
            ) : !handTracking ? (
              <div style={{ color: '#888', fontSize: 11 }}>Starting...</div>
            ) : null}
          </div>
        )}

        {handMode && handTracking && handPosition && (
          <div
            className={styles.handCursor}
            style={{
              left: `${handPosition.x * 100}%`,
              top: `${handPosition.y * 100}%`,
            }}
          />
        )}
      </div>

      {!embedded && (
        <div className={styles.sidebar}>
          <h2 className={styles.sidebarTitle}>{sidebarTitle}</h2>

          {/* Type filter */}
          {typeFilters.length > 0 && (
            <div className={styles.filterRow}>
              {typeFilters.map(f => (
                <button
                  key={f}
                  className={`${styles.filterBtn} ${typeFilter === f ? styles.filterBtnActive : ''}`}
                  style={f ? { borderColor: TYPE_COLORS[f], color: typeFilter === f ? '#fff' : TYPE_COLORS[f] } : undefined}
                  onClick={() => {
                    setTypeFilter(f);
                    onTypeFilterChange?.(f);
                  }}
                >
                  {f || 'All'}
                </button>
              ))}
            </div>
          )}

          <div className={styles.statsList}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{documents.length.toLocaleString()}</span>
              <span className={styles.statLabel}>Documents</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{clusters.length}</span>
              <span className={styles.statLabel}>Domains</span>
            </div>
            {nebulae.length > 0 && (
              <div className={styles.statItem}>
                <span className={styles.statValue}>{nebulae.length}</span>
                <span className={styles.statLabel}>Nebulae</span>
              </div>
            )}
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type} className={styles.statItem}>
                <span className={styles.statValue} style={{ color: TYPE_COLORS[type] }}>{count.toLocaleString()}</span>
                <span className={styles.statLabel}>{type}s</span>
              </div>
            ))}
            {stats?.vector && (
              <>
                <div className={styles.divider} />
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{stats.vector.count.toLocaleString()}</span>
                  <span className={styles.statLabel}>Embeddings</span>
                </div>
              </>
            )}
            {effectiveMatchIds.size > 0 && (
              <>
                <div className={styles.divider} />
                <div className={styles.statItem}>
                  <span className={styles.statValue} style={{ color: '#4ade80' }}>{effectiveMatchIds.size}</span>
                  <span className={styles.statLabel}>Search Matches</span>
                </div>
              </>
            )}

            {clusters.length > 0 && (
              <>
                <div className={styles.divider} />
                <div className={styles.statLabel} style={{ marginBottom: 4 }}>Clusters</div>
                {clusters.map((cluster, i) => (
                  <button
                    key={cluster.id}
                    className={`${styles.clusterListItem} ${focusedCluster === cluster.id ? styles.clusterListItemActive : ''}`}
                    onClick={() => {
                      if (focusedCluster === cluster.id) {
                        zoomOut();
                      } else {
                        zoomToCluster(cluster);
                      }
                    }}
                  >
                    <span
                      className={styles.legendDot}
                      style={{ background: CLUSTER_PALETTE_CSS[i % CLUSTER_PALETTE_CSS.length] }}
                    />
                    <span className={styles.clusterListName}>{cluster.label}</span>
                    <span className={styles.clusterListCount}>{cluster.docCount}</span>
                  </button>
                ))}
              </>
            )}
          </div>
          <div className={styles.sidebarHint}>
            Drag to orbit. Scroll to zoom. Click star to focus. Esc to zoom out. Hand: orbit + gesture zoom.
          </div>
        </div>
      )}
    </div>
  );
}
