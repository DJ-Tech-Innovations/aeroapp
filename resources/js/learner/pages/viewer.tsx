import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Chip, IconButton } from '@/components/ui';
import { ToolViewer } from '@/viewer';
import { useTool } from '../lib/hooks';
import { useSettings } from '../lib/settings';
import { say, useVoice } from '../lib/speech';

/** Immersive full-screen 3D viewer. */
export default function Viewer() {
    const nav = useNavigate();
    const { id } = useParams();
    const tool = useTool(id);
    const reduce3D = useSettings((s) => s.reduce3D);
    const [chosen, setAnimation] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [reset, setReset] = useState(0);
    useEffect(() => () => useVoice.getState().stop(), []);
    if (!tool) return <div className="min-h-dvh bg-slate-950" />;
    const animation = chosen ?? tool.model3d.animations[0] ?? null;
    const hs = tool.model3d.hotspots.find((h) => h.id === selected);
    const pick = (hid: string) => { const h = tool.model3d.hotspots.find((x) => x.id === hid); if (!h) return; setSelected(hid); say(`hotspot:${hid}`, `${h.label}. ${h.description}`); };
    return (
        <div className="dark fixed inset-0 bg-[radial-gradient(ellipse_at_center,#1e293b_0%,#020617_75%)] text-text">
            <ToolViewer tool={tool} animation={animation} playing={playing} showHotspots selectedHotspotId={selected} resetKey={reset} onHotspotPress={pick} autoRotate reduce3D={reduce3D} />
            <div className="safe-top pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 px-4 py-3">
                <IconButton icon="cross" label="Close viewer" className="pointer-events-auto bg-white/10 text-white backdrop-blur hover:bg-white/20" onClick={() => nav(`/tools/${tool.id}`)} />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold text-white">{tool.name}</p><p className="truncate text-xs text-slate-400">{tool.brand} · {tool.model}</p></div>
                <IconButton icon="refresh" label="Reset view" className="pointer-events-auto bg-white/10 text-white backdrop-blur hover:bg-white/20" onClick={() => setReset((n) => n + 1)} />
            </div>
            <div className="safe-bottom pointer-events-none absolute inset-x-0 bottom-0 space-y-3 px-4 pb-4">
                {hs ? <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-white/10 bg-slate-900/90 p-4 backdrop-blur"><p className="font-semibold text-white">{hs.label}</p><p className="mt-1 text-sm text-slate-300">{hs.description}</p></div>
                    : <p className="text-center text-xs text-slate-400">Drag to rotate · pinch to zoom · two-finger twist to roll · tap the orange dots</p>}
                <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:justify-center">
                    {tool.model3d.animations.length ? <Chip label={playing ? 'Pause' : 'Play'} icon={playing ? 'pause' : 'play'} selected={playing} onClick={() => setPlaying((p) => !p)} /> : null}
                    {tool.model3d.animations.map((a) => <Chip key={a} label={a} selected={animation === a && playing} onClick={() => { setAnimation(a); setPlaying(true); }} />)}
                    {tool.model3d.hotspots.map((h) => <Chip key={h.id} icon="target" label={h.label} selected={selected === h.id} onClick={() => pick(h.id)} />)}
                </div>
            </div>
        </div>
    );
}
