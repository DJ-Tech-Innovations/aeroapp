import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { cn, Icon, IconButton } from '@/components/ui';
import { useNetwork } from '../lib/network';

/** Standard learner page container: comfortable width on desktop, safe padding on phones. */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
    return <div className={cn('mx-auto flex w-full animate-fade-in flex-col gap-5 px-4 pb-8 pt-4 sm:px-6 md:pt-8', wide ? 'max-w-6xl' : 'max-w-3xl', className)}>{children}</div>;
}

export function PageTitle({ title, subtitle, back, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; back?: string | true; actions?: ReactNode; eyebrow?: ReactNode }) {
    const nav = useNavigate();
    return (
        <div className="flex items-start gap-3">
            {back ? <IconButton icon="arrow-left" label="Back" className="-ml-2 mt-0.5 shrink-0" onClick={() => (back === true ? nav(-1) : nav(back))} /> : null}
            <div className="min-w-0 flex-1">
                {eyebrow ? <p className="label-caps mb-1">{eyebrow}</p> : null}
                <h1 className="text-2xl font-bold tracking-tight text-text sm:text-[28px]">{title}</h1>
                {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        </div>
    );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
    return <div className="mt-2 flex items-center justify-between"><h2 className="text-base font-semibold text-text">{title}</h2>{action}</div>;
}

export function OfflineBanner() {
    const online = useNetwork((s) => s.online);
    if (online) return null;
    return (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
            <Icon name="wifi-slash" className="text-warning" />
            <p className="flex-1 text-text-2"><b className="text-text">You're offline.</b> Tools, 3D models, videos and quizzes still work — your progress syncs when you reconnect.</p>
        </div>
    );
}
