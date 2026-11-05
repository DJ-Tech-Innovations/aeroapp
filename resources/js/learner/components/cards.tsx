import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ToolThumb } from '@/components/tool-thumb';
import { Badge, Button, Card, cn, Icon, IconButton } from '@/components/ui';
import type { Quiz, Spotlight } from '@/shared';
import { useQuizStatus, useTool } from '../lib/hooks';
import { useNetwork } from '../lib/network';
import { installStore, isIOS } from '../lib/pwa';
import { useSession } from '../lib/session';
import { clearSpotlight, getSpotlight } from '../lib/spotlight';

const Meta = ({ icon, t }: { icon: string; t: string }) => <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Icon name={icon} />{t}</span>;

export function QuizCard({ quiz }: { quiz: Quiz }) {
    const userId = useSession((s) => s.profile?.id);
    const instructor = useSession((s) => s.profile?.role === 'instructor');
    const st = useQuizStatus(quiz, userId);
    const n = quiz.drawCount ? Math.min(quiz.drawCount, quiz.questions.length) : quiz.questions.length;
    const exam = quiz.mode === 'exam';
    return (
        <Link to={instructor ? `/results/${quiz.id}` : `/quizzes/${quiz.id}`} className="group block">
            <Card interactive className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                    <span className={cn('flex size-11 items-center justify-center rounded-xl text-lg', exam ? 'bg-danger-soft text-danger' : 'bg-info-soft text-info')}><Icon name={exam ? 'stopwatch' : 'interrogation'} /></span>
                    <div className="flex flex-wrap justify-end gap-1">
                        <Badge tone={exam ? 'danger' : 'info'}>{exam ? 'Exam' : 'Quiz'}</Badge>
                        {!instructor && st?.open ? <Badge tone="warning" dot>In progress</Badge> : null}
                        {!instructor && st?.best != null ? <Badge tone={st.best >= quiz.passingPercent ? 'success' : 'neutral'} icon="trophy">{Math.round(st.best)}%</Badge> : null}
                    </div>
                </div>
                <div>
                    <h3 className="font-semibold text-text group-hover:text-primary">{quiz.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{quiz.description}</p>
                </div>
                <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3">
                    <Meta icon="list" t={`${n} questions`} />
                    <Meta icon={quiz.timeLimitSec ? 'clock-three' : 'infinity'} t={quiz.timeLimitSec ? `${Math.round(quiz.timeLimitSec / 60)} min` : 'Untimed'} />
                    {instructor ? <Meta icon="flag" t={`Pass ${quiz.passingPercent}%`} /> : <Meta icon="refresh" t={st?.left == null ? 'Unlimited' : `${st.left} of ${quiz.maxAttempts} left`} />}
                </div>
            </Card>
        </Link>
    );
}

/** "Today's tool from your instructor" (students) / current spotlight with a remove button (instructors). */
export function SpotlightCard({ manage }: { manage?: boolean }) {
    const online = useNetwork((s) => s.online);
    const [sp, setSp] = useState<Spotlight | null>(null);
    const [tick, setTick] = useState(0);
    useEffect(() => { getSpotlight().then((r) => setSp(r.data)).catch(() => {}); }, [online, tick]);
    const tool = useTool(sp?.toolId);

    if (!sp || !tool) {
        return manage ? (
            <Card className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-lg text-amber-600"><Icon name="megaphone" /></span>
                <div className="flex-1">
                    <h3 className="font-semibold text-text">No tool spotlighted</h3>
                    <p className="mt-1 text-sm text-muted">Open any tool and tap “Spotlight for my class” — your students see it pinned on their home screen.</p>
                    <Link to="/tools" className="mt-3 inline-flex text-sm font-semibold text-primary">Browse tools →</Link>
                </div>
            </Card>
        ) : null;
    }
    const remove = async () => { try { await clearSpotlight(); setSp(null); setTick((n) => n + 1); toast.success('Spotlight removed'); } catch (e) { toast.error((e as Error).message); } };
    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-[1px] shadow-card">
            <Link to={`/tools/${tool.id}`} className="flex items-center gap-4 rounded-[15px] bg-surface p-4">
                <ToolThumb category={tool.category} brand={tool.brand} size={56} />
                <div className="min-w-0 flex-1">
                    <p className="label-caps flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Icon name="megaphone" />{manage ? 'Currently spotlighted' : 'Tool of the day'}</p>
                    <h3 className="mt-0.5 truncate text-lg font-bold text-text">{tool.name}</h3>
                    <p className="truncate text-sm text-muted">{sp.instructorName}{sp.note ? ` — “${sp.note}”` : ''}</p>
                </div>
                {manage ? <IconButton icon="cross-small" label="Remove spotlight" onClick={(e) => { e.preventDefault(); void remove(); }} /> : <Icon name="angle-right" className="text-muted" />}
            </Link>
        </div>
    );
}

const DISMISS_KEY = 'aeroapp.installCard.dismissed';
const readDismissed = () => { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } };

/** One tap install on Android/desktop Chrome; step-by-step on iPhone (Safari has no prompt). */
export function InstallCard() {
    const { prompt, installed } = useSyncExternalStore(installStore.subscribe, installStore.get, installStore.getServer);
    const [dismissed, setDismissed] = useState(readDismissed);
    const ios = isIOS();
    if (installed || dismissed || (!prompt && !ios)) return null;
    const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ } setDismissed(true); };
    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 p-5 text-white shadow-card">
            <div className="bg-grid absolute inset-0 opacity-40" />
            <button type="button" onClick={dismiss} className="absolute right-3 top-3 rounded-lg p-1.5 text-blue-200 hover:bg-white/10 hover:text-white" aria-label="Dismiss"><Icon name="cross-small" /></button>
            <div className="relative flex items-center gap-4 pr-6">
                <img src="/icons/icon-192.png" alt="" className="size-14 rounded-2xl shadow-lg ring-1 ring-white/20" />
                <div>
                    <h3 className="text-lg font-bold">Install AeroApp</h3>
                    <p className="text-sm text-blue-100/80">Full screen, opens from your home screen and works without internet.</p>
                </div>
            </div>
            {ios ? (
                <ol className="relative mt-4 space-y-1.5 text-sm text-blue-50">
                    <li>1. In Safari tap <Icon name="share" className="mx-1 inline" /> <b>Share</b>.</li>
                    <li>2. Choose <Icon name="square-plus" className="mx-1 inline" /> <b>Add to Home Screen</b>, then <b>Add</b>.</li>
                </ol>
            ) : <Button className="relative mt-4 bg-white text-blue-900 hover:bg-blue-50" icon="download" onClick={() => installStore.install()}>Install app</Button>}
        </div>
    );
}
