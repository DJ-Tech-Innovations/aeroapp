import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Card, Chip, cn, Icon, IconButton } from '@/components/ui';
import { fmtDuration, type Tool } from '@/shared';
import { resolveMedia } from '../lib/media';
import { speechSupported, useVoice, type SpeechItem } from '../lib/speech';

const SPEEDS = [0.5, 1, 1.5, 2];

export function ToolVideo({ tool }: { tool: Tool }) {
    const ref = useRef<HTMLVideoElement>(null);
    const [rate, setRate] = useState(1);
    useEffect(() => { if (ref.current) ref.current.playbackRate = rate; }, [rate]);
    if (!tool.video) return <Card className="text-sm text-muted">No video tutorial for this tool in the installed pack.</Card>;
    return (
        <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-2xl bg-black shadow-card">
                <video ref={ref} src={resolveMedia(tool.video.file)} controls playsInline preload="metadata" className="aspect-video w-full" aria-label={`Video tutorial for ${tool.name}`} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm text-muted">Tutorial · {fmtDuration(tool.video.durationSec)}{tool.video.file === 'videos/placeholder.mp4' ? ' · placeholder clip' : ''}</span>
                <span className="flex-1" />
                {SPEEDS.map((s) => <Chip key={s} label={`${s}×`} selected={rate === s} onClick={() => setRate(s)} />)}
            </div>
        </div>
    );
}

/** One narrated section: play/stop button and the transcript. */
export function VoiceSection({ title, item, icon, children }: { title: string; item: SpeechItem; icon?: string; children?: ReactNode }) {
    const active = useVoice((s) => s.activeId === item.id);
    const { speak, stop } = useVoice.getState();
    const canSpeak = speechSupported() || !!item.audioUrl;
    return (
        <Card className={cn('transition', active && 'ring-2 ring-primary/40')}>
            <div className="mb-3 flex items-center gap-3">
                {icon ? <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg"><Icon name={icon} /></span> : null}
                <h3 className="flex-1 font-semibold text-text">{title}</h3>
                {canSpeak ? <IconButton icon={active ? 'stop' : 'volume'} label={active ? `Stop narration of ${title}` : `Listen to ${title}`} active={active} onClick={() => (active ? stop() : speak(item))} /> : null}
            </div>
            <div className="text-[15px] leading-relaxed text-text-2">{children}</div>
            {active ? (
                <div className="mt-4 rounded-xl bg-surface-2 p-3" aria-live="polite">
                    <p className="label-caps mb-1 flex items-center gap-1.5"><span className="flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="h-3 w-0.5 animate-pulse rounded bg-primary" style={{ animationDelay: `${i * 150}ms` }} />)}</span>Now narrating</p>
                    <p className="text-sm text-muted">{item.text}</p>
                </div>
            ) : null}
        </Card>
    );
}

export function PlayAllButton({ items }: { items: SpeechItem[] }) {
    const playing = useVoice((s) => s.playingAll);
    const { playAll, stop } = useVoice.getState();
    if (!speechSupported()) return <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">Voice narration isn't available in this browser — the text is shown below.</p>;
    return <Button size="lg" icon={playing ? 'stop' : 'play'} variant={playing ? 'secondary' : 'primary'} onClick={() => (playing ? stop() : playAll(items))}>{playing ? 'Stop narration' : 'Listen to everything'}</Button>;
}
