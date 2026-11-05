import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Box3, BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARCHETYPES, archetypeOf, brandColor, isGlbModel, type ArchPart, type ArchStep, type ColorKey, type Hotspot } from '@/shared';

const palette = (brand: string): Record<ColorKey, { color: string; metalness: number; roughness: number; opacity?: number }> => ({
  body: { color: brandColor(brand), metalness: 0.15, roughness: 0.55 },
  metal: { color: '#C3CCD9', metalness: 0.85, roughness: 0.3 },
  dark: { color: '#232B3A', metalness: 0.2, roughness: 0.7 },
  accent: { color: '#FF6A1A', metalness: 0.2, roughness: 0.45 },
  rubber: { color: '#2A2F3A', metalness: 0, roughness: 0.9 },
  glass: { color: '#8CC3FF', metalness: 0.1, roughness: 0.1, opacity: 0.55 },
});

function makeGeometry(p: ArchPart, low: boolean): BufferGeometry {
  const seg = low ? 12 : 28;
  switch (p.shape) {
    case 'box': return new BoxGeometry(p.size[0], p.size[1], p.size[2]);
    case 'sphere': return new SphereGeometry(p.size[0], seg, Math.round(seg * 0.7));
    case 'torus': return new TorusGeometry(p.size[0], p.size[1], low ? 8 : 16, seg * 2, p.arc ?? Math.PI * 2);
    default: return new CylinderGeometry(p.size[0], p.size[1], p.size[2], seg);
  }
}

export interface ToolModelProps {
  file: string; brand: string; animation: string | null; playing: boolean; lowQuality?: boolean;
  /** Archetype drawn while a GLB loads or if it fails (offline before it was cached). */
  fallback?: string;
  hotspots?: Hotspot[]; showHotspots?: boolean; selectedHotspotId?: string | null; onHotspot?: (id: string) => void;
}

/** Pulsing marker + a larger invisible sphere that takes the clicks. */
function HotspotMarker({ h, selected, onPick }: { h: Hotspot; selected: boolean; onPick?: (id: string) => void }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => { ref.current?.scale.setScalar((selected ? 1.5 : 1) * (1 + 0.18 * Math.sin(clock.elapsedTime * 4))); });
  return (
    <group position={[h.position[0], h.position[1], h.position[2]]}>
      <mesh ref={ref} renderOrder={10}>
        <sphereGeometry args={[0.06, 14, 10]} />
        <meshBasicMaterial color={selected ? '#FFFFFF' : '#FF6A1A'} depthTest={false} transparent opacity={0.95} />
      </mesh>
      <mesh onClick={(e) => { if (e.delta > 6) return; e.stopPropagation(); onPick?.(h.id); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

class GlbBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** A real mesh (AI-generated or uploaded), fitted to a unit sphere. GLB hotspots are stored in that normalised space. */
function GlbModel({ url, hotspots = [], showHotspots = false, selectedHotspotId = null, onHotspot }: Pick<ToolModelProps, 'hotspots' | 'showHotspots' | 'selectedHotspotId' | 'onHotspot'> & { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  const { scene, center, scale } = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const box = new Box3().setFromObject(scene);
    const r = box.getSize(new Vector3()).length() / 2 || 1;
    return { scene, center: box.getCenter(new Vector3()), scale: 1 / r };
  }, [gltf]);
  return (
    <group>
      <group scale={scale} position={[-center.x * scale, -center.y * scale, -center.z * scale]}><primitive object={scene} /></group>
      {showHotspots ? hotspots.map((h) => <HotspotMarker key={h.id} h={h} selected={h.id === selectedHotspotId} onPick={onHotspot} />) : null}
    </group>
  );
}

/** `procedural://<archetype>` models are built from primitives; a .glb path/URL loads the real mesh, with the archetype as fallback. */
export function ToolModel(p: ToolModelProps) {
  if (!isGlbModel(p.file)) return <ProceduralModel {...p} />;
  const placeholder = p.fallback ? <ProceduralModel {...p} file={`procedural://${p.fallback}`} playing={false} /> : null;
  return (
    <GlbBoundary key={p.file} fallback={placeholder}>
      <Suspense fallback={placeholder}><GlbModel url={p.file} hotspots={p.hotspots} showHotspots={p.showHotspots} selectedHotspotId={p.selectedHotspotId} onHotspot={p.onHotspot} /></Suspense>
    </GlbBoundary>
  );
}

function ProceduralModel({ file, brand, animation, playing, lowQuality, hotspots = [], showHotspots = false, selectedHotspotId = null, onHotspot }: ToolModelProps) {
  const key = archetypeOf(file);
  const arch = key ? ARCHETYPES[key] : null;
  const partRefs = useRef<Record<string, Group | null>>({});
  const t0 = useRef(0);

  const built = useMemo(() => {
    if (!arch) return null;
    const mats = palette(brand);
    const parts = arch.parts.map((p) => ({ p, geo: makeGeometry(p, !!lowQuality), mat: mats[p.color] }));
    const g = new Group();
    for (const { p, geo } of parts) {
      const m = new Mesh(geo);
      m.position.set(p.pos[0], p.pos[1], p.pos[2]);
      if (p.rot) m.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      g.add(m);
    }
    const box = new Box3().setFromObject(g);
    const center = box.getCenter(new Vector3());
    const r = box.getSize(new Vector3()).length() / 2 || 1;
    return { parts, center, scale: 1 / r };
  }, [arch, brand, lowQuality]);

  useEffect(() => () => built?.parts.forEach((x) => x.geo.dispose()), [built]); // free GPU memory on unmount

  const steps: ArchStep[] = useMemo(() => arch?.animations.find((a) => a.name === animation)?.steps ?? [], [arch, animation]);
  useEffect(() => { t0.current = 0; }, [animation, playing]);

  useFrame((_, dt) => {
    if (!built) return;
    for (const { p } of built.parts) {
      const g = partRefs.current[p.name];
      if (!g) continue;
      const base = p.pivot ?? p.pos;
      g.position.set(base[0], base[1], base[2]);
      g.rotation.set(0, 0, 0);
    }
    if (!playing || steps.length === 0) return;
    t0.current += dt;
    const t = t0.current;
    for (const s of steps) {
      const g = partRefs.current[s.part];
      if (!g) continue;
      const v = s.loop === 'spin' ? s.amount * t * s.speed : s.amount * (0.5 - 0.5 * Math.cos(t * 2.2 * s.speed));
      if (s.kind === 'rotate') g.rotation[s.axis] += v; else g.position[s.axis] += v;
    }
  });

  if (!built) return null;
  const { center, scale } = built;
  return (
    <group scale={scale} position={[-center.x * scale, -center.y * scale, -center.z * scale]}>
      {built.parts.map(({ p, geo, mat }) => {
        const base = p.pivot ?? p.pos;
        const off = p.pivot ? [p.pos[0] - p.pivot[0], p.pos[1] - p.pivot[1], p.pos[2] - p.pivot[2]] : [0, 0, 0];
        return (
          <group key={p.name} ref={(g) => { partRefs.current[p.name] = g; }} position={[base[0], base[1], base[2]]}>
            <mesh geometry={geo} position={[off[0], off[1], off[2]]} rotation={(p.rot ?? [0, 0, 0]) as [number, number, number]}>
              <meshStandardMaterial color={mat.color} metalness={mat.metalness} roughness={mat.roughness} transparent={mat.opacity != null} opacity={mat.opacity ?? 1} />
            </mesh>
          </group>
        );
      })}
      {showHotspots ? hotspots.map((h) => <HotspotMarker key={h.id} h={h} selected={h.id === selectedHotspotId} onPick={onHotspot} />) : null}
    </group>
  );
}
