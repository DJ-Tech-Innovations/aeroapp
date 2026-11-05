import { Head, Link, usePage } from '@inertiajs/react';
import { LogoMark } from '@/components/brand';
import { buttonClass, Icon } from '@/components/ui';
import type { SharedProps } from '@/types';

const COPY: Record<number, { title: string; message: string; icon: string; code: string }> = {
    404: { code: '404', title: 'This page went off the radar', message: "We couldn't find the page you were looking for. It may have been moved, renamed, or never existed.", icon: 'plane-departure' },
    403: { code: '403', title: 'Restricted airspace', message: "Your account doesn't have clearance for this page. If you think it should, ask an administrator to update your role.", icon: 'shield' },
    419: { code: '419', title: 'Your session timed out', message: 'For your security the page expired. Reload and try again.', icon: 'hourglass-end' },
    429: { code: '429', title: 'Holding pattern', message: "You've made a lot of requests in a short time. Wait a moment, then try again.", icon: 'time-forward' },
    500: { code: '500', title: 'Engine trouble on our side', message: 'Something went wrong on the server. Our crew has been notified — please try again in a moment.', icon: 'engine-warning' },
    503: { code: '503', title: 'Down for scheduled maintenance', message: "We're performing maintenance and will be back shortly. Thanks for your patience.", icon: 'tools' },
};

export default function ErrorPage({ status }: { status: number }) {
    const { props } = usePage<SharedProps>();
    const c = COPY[status] ?? COPY[500];
    const home = props.auth?.user?.homePath ?? '/';
    return (
        <div className="relative flex min-h-dvh flex-col overflow-hidden bg-bg">
            <Head title={c.title} />
            {/* runway lights + horizon */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-primary/[0.07] to-transparent" />
            <div className="pointer-events-none absolute bottom-24 left-1/2 hidden w-[120%] -translate-x-1/2 justify-between sm:flex">
                {Array.from({ length: 24 }).map((_, i) => <span key={i} className="size-1.5 rounded-full bg-amber-400/40" />)}
            </div>
            <header className="relative flex items-center justify-between px-5 py-5 sm:px-10">
                <Link href="/" className="flex items-center gap-2.5"><LogoMark size={34} /><span className="font-bold text-text">{props.app?.org?.name ?? 'AeroApp'}</span></Link>
            </header>
            <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
                <div className="relative mb-8">
                    <p aria-hidden className="select-none text-[120px] font-black leading-none tracking-tighter text-text/[0.06] sm:text-[180px]">{c.code}</p>
                    <span className="absolute left-1/2 top-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-900 to-blue-600 text-3xl text-white shadow-xl shadow-blue-900/30 ring-8 ring-bg">
                        <Icon name={c.icon} />
                    </span>
                </div>
                <p className="label-caps mb-2 text-primary">Error {c.code}</p>
                <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">{c.title}</h1>
                <p className="mt-3 max-w-md text-base text-muted">{c.message}</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <a href={home} className={buttonClass('primary', 'lg')}><Icon name="home" />Take me home</a>
                    <button type="button" onClick={() => (history.length > 1 ? history.back() : (location.href = home))} className={buttonClass('secondary', 'lg')}><Icon name="arrow-left" />Go back</button>
                </div>
            </main>
        </div>
    );
}
