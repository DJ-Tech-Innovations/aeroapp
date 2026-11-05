import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import type { Tool } from '@/shared';
import { createViewState, panBy, resetView, rollBy, rotateBy, spinY, zoomBy, type ViewState } from './controls';
import { ToolModel } from './ToolModel';

export interface ToolViewerProps {
  tool: Tool;
  animation?: string | null;
  playing?: boolean;
  autoRotate?: boolean;
  showHotspots?: boolean;
  selectedHotspotId?: string | null;
  /** Only these hotspots are drawn (identify-the-part questions show just the target). */
  hotspotFilter?: string[];
  onHotspotPress?: (id: string) => void;
  /** Increment to reset orientation / zoom / pan. */
  resetKey?: number;
  className?: string;
  /** Lower detail for older phones (learner setting). */
  reduce3D?: boolean;
}

const CAM_Z = 2.35;

function Rig({ view, children }: { view: ViewState; children: React.ReactNode }) {
  const group = useRef<Group>(null);
  const { camera } = useThree();
  useFrame((_, dt) => {
    if (view.autoRotate && Date.now() - view.lastTouch > 2500) spinY(view, Math.min(dt, 0.05));
    const g = group.current;
    if (!g) return;
    g.quaternion.copy(view.q);
    g.position.copy(view.pan);
    camera.position.z = CAM_Z / view.zoom;
  });
  return <group ref={group}>{children}</group>;
}

/**
 * GL view + pointer gestures. One finger/mouse drag rotates freely on every axis; two fingers pinch-zoom, twist to roll
 * and drag to pan; mouse wheel zooms; double-click/tap resets; a tap on an orange dot opens that hotspot.
 */
export default function ToolViewer({ tool, animation = null, playing = false, autoRotate = false, showHotspots = false, selectedHotspotId = null, hotspotFilter, onHotspotPress, resetKey = 0, className, reduce3D = false }: ToolViewerProps) {

  const view = useRef<ViewState>(createViewState(autoRotate)).current;
  const el = useRef<HTMLDivElement>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const two = useRef({ dist: 0, angle: 0, cx: 0, cy: 0 });
  const moved = useRef(false);

  useEffect(() => { view.autoRotate = autoRotate; }, [autoRotate, view]);
  useEffect(() => { if (resetKey > 0) resetView(view); }, [resetKey, view]);

  // wheel zoom needs a non-passive listener to stop the page from scrolling
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); view.lastTouch = Date.now(); zoomBy(view, Math.exp(-e.deltaY * 0.0015)); };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [view]);

  const measure = () => {
    const [a, b] = [...ptrs.current.values()];
    return { dist: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (ptrs.current.size === 2) two.current = measure();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = ptrs.current.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    view.lastTouch = Date.now();
    if (ptrs.current.size === 1) {
      if (!moved.current && Math.hypot(dx, dy) < 3) return; // let taps through to the hotspot raycaster
      if (!moved.current) { moved.current = true; el.current?.setPointerCapture(e.pointerId); }
      rotateBy(view, dx, dy);
      p.x = e.clientX; p.y = e.clientY;
    } else if (ptrs.current.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const m = measure(), prev = two.current;
      if (prev.dist > 0) zoomBy(view, m.dist / prev.dist);
      let da = m.angle - prev.angle;
      if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
      rollBy(view, da);
      panBy(view, m.cx - prev.cx, m.cy - prev.cy);
      two.current = m;
      moved.current = true;
    }
  };
  const end = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) two.current.dist = 0; };

  const hotspots = useMemo(() => (hotspotFilter ? tool.model3d.hotspots.filter((h) => hotspotFilter.includes(h.id)) : tool.model3d.hotspots), [tool, hotspotFilter]);

  return (
    <div
      ref={el}
      className={className ?? 'h-full w-full'}
      style={{ touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={end} onPointerCancel={end} onPointerLeave={end}
      onDoubleClick={() => { view.lastTouch = Date.now(); resetView(view); }}
      role="img"
      aria-label={`3D model of ${tool.name}. Drag to rotate, pinch or scroll to zoom, double-tap to reset.`}
    >
      <Canvas camera={{ position: [0, 0, CAM_Z], fov: 42 }} dpr={reduce3D ? 1 : [1, 2]} gl={{ antialias: !reduce3D, powerPreference: 'high-performance' }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, -2, -3]} intensity={0.8} color="#7FA8FF" />
        <Suspense fallback={null}>
          <Rig view={view}>
            <ToolModel file={tool.model3d.file} fallback={tool.model3d.fallback} brand={tool.brand} animation={animation} playing={playing} lowQuality={reduce3D}
              hotspots={hotspots} showHotspots={showHotspots} selectedHotspotId={selectedHotspotId} onHotspot={onHotspotPress} />
          </Rig>
        </Suspense>
      </Canvas>
    </div>
  );
}
