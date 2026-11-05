import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { Box3, CanvasTexture, SRGBColorSpace, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type Vec3 = [number, number, number];
export interface PreviewHotspot { label: string; position: Vec3 | null }
export interface ModelPreviewProps {
  url: string;
  hotspots?: PreviewHotspot[];
  /** Index of the hotspot being placed; the next click on the model sets its position. */
  placing?: number | null;
  onPlace?: (index: number, position: Vec3) => void;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function Controls() {
  const { camera, gl } = useThree();
  const controls = useMemo(() => Object.assign(new OrbitControls(camera, gl.domElement), { enableDamping: true, minDistance: 0.6, maxDistance: 8 }), [camera, gl]);
  useEffect(() => () => controls.dispose(), [controls]);
  useFrame(() => controls.update());
  return null;
}

/**
 * The GLB centred and scaled to fit a unit sphere — the same normalisation the web and mobile viewers apply,
 * so a click here (world space = normalised space) gives hotspot coordinates that match on every platform.
 */
function Model({ url, placing, onPlace }: Pick<ModelPreviewProps, 'url' | 'placing' | 'onPlace'>) {
  const gltf = useLoader(GLTFLoader, url);
  const { scene, center, scale } = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const box = new Box3().setFromObject(scene);
    const r = box.getSize(new Vector3()).length() / 2 || 1;
    return { scene, center: box.getCenter(new Vector3()), scale: 1 / r };
  }, [gltf]);
  return (
    <group scale={scale} position={[-center.x * scale, -center.y * scale, -center.z * scale]}>
      <primitive
        object={scene}
        onClick={(e: { delta: number; point: Vector3; stopPropagation: () => void }) => {
          if (placing == null || e.delta > 4) return; // a drag is an orbit, not a placement
          e.stopPropagation();
          onPlace?.(placing, [round(e.point.x), round(e.point.y), round(e.point.z)]);
        }}
      />
    </group>
  );
}

/** Numbered badge matching the parts list; drawn on top so it stays visible behind the mesh. */
function Marker({ position, n, active }: { position: Vec3; n: number; active: boolean }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = active ? '#FFFFFF' : '#FF6A1A';
    g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = active ? '#FF6A1A' : '#1A0B00';
    g.font = `bold ${n > 9 ? 30 : 36}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 32, 34);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [n, active]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={active ? 0.11 : 0.09} renderOrder={10}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  );
}

class LoadError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="grid h-full place-items-center p-6 text-center text-sm text-danger">Could not load this model.</div> : this.props.children; }
}

export default function ModelPreview({ url, hotspots = [], placing = null, onPlace }: ModelPreviewProps) {
  return (
    <LoadError key={url}>
      <Canvas camera={{ position: [0, 0.4, 2.4], fov: 42 }} dpr={[1, 2]} style={{ cursor: placing != null ? 'crosshair' : 'grab', touchAction: 'none' }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, -2, -3]} intensity={0.8} color="#7FA8FF" />
        <Suspense fallback={null}>
          <Model url={url} placing={placing} onPlace={onPlace} />
        </Suspense>
        {hotspots.map((h, i) => (h.position ? <Marker key={i} position={h.position} n={i + 1} active={placing === i} /> : null))}
        <Controls />
      </Canvas>
    </LoadError>
  );
}
