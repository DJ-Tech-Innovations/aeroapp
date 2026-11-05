import { Link, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { IconCredit, LogoMark } from '@/components/brand';
import { Icon } from '@/components/ui';
import type { SharedProps } from '@/types';

const FEATURES = [
    { icon: 'cube', title: 'Interactive 3D tools', text: 'Rotate, zoom and tap every part.' },
    { icon: 'volume', title: 'Narrated procedures', text: 'Hear how each tool is used and maintained.' },
    { icon: 'wifi-slash', title: 'Works offline', text: 'Install content packs, learn anywhere.' },
];

/** Split screen: navy brand panel (desktop) + form. On phones only the form, with the logo on top. */
export default function AuthLayout({ children, headline, message }: { children: ReactNode; headline?: string; message?: string }) {
    const { props } = usePage<SharedProps>();
    const org = props.app.org;
    return (
        <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
            <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-slate-950 p-12 text-white lg:flex lg:flex-col">
                <div className="bg-grid absolute inset-0 opacity-60" />
                <div className="absolute -right-32 -top-32 size-[28rem] rounded-full bg-blue-500/20 blur-3xl" />
                <div className="absolute -bottom-40 -left-20 size-[26rem] rounded-full bg-amber-500/10 blur-3xl" />
                <div className="relative flex items-center gap-3">
                    <LogoMark size={44} className="rounded-xl ring-1 ring-white/20" />
                    <div className="leading-tight">
                        <p className="text-lg font-bold">{org.name}</p>
                        <p className="text-xs text-blue-200/70">{org.tagline}</p>
                    </div>
                </div>
                <div className="relative mt-auto max-w-lg">
                    <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-100 ring-1 ring-white/15">
                        <span className="size-1.5 rounded-full bg-amber-400" /> Aircraft maintenance training
                    </p>
                    <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-[44px]">{headline}</h1>
                    <p className="mt-4 text-base leading-relaxed text-blue-100/80">{message}</p>
                    <ul className="mt-10 grid gap-4">
                        {FEATURES.map((f) => (
                            <li key={f.title} className="flex items-center gap-4">
                                <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-lg ring-1 ring-white/15"><Icon name={f.icon} /></span>
                                <span><span className="block font-semibold">{f.title}</span><span className="text-sm text-blue-200/70">{f.text}</span></span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="relative mt-12 flex items-center justify-between text-xs text-blue-200/50">
                    <span>© {new Date().getFullYear()} {org.name}</span>
                    <IconCredit />
                </div>
            </aside>

            <main className="flex flex-col bg-bg px-5 py-8 sm:px-10">
                <div className="flex items-center justify-between lg:justify-end">
                    <Link href="/" className="flex items-center gap-2.5 lg:hidden">
                        <LogoMark size={36} />
                        <span className="text-base font-bold text-text">{org.name}</span>
                    </Link>
                </div>
                <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
                <p className="text-center text-xs text-muted lg:hidden"><IconCredit /></p>
            </main>
        </div>
    );
}
