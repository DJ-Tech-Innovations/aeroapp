import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { LogoMark } from '@/components/brand';
import { Button, buttonClass, cn, Icon } from '@/components/ui';
import { useSettings } from '../lib/settings';

const SLIDES = [
    { icon: 'cube', title: 'Meet every tool in 3D', body: 'Rotate any tool a full 360°, zoom in, and tap the orange dots to learn each part.', color: 'from-blue-600 to-blue-800' },
    { icon: 'volume', title: 'Hear it, watch it, learn it', body: 'Narrated procedures and video tutorials — and it all keeps working without internet.', color: 'from-emerald-600 to-teal-800' },
    { icon: 'trophy', title: 'Test yourself', body: 'Practice quizzes give instant feedback; timed exams count. Your results sync when you are back online.', color: 'from-amber-500 to-orange-700' },
];

export function Welcome() {
    const nav = useNavigate();
    const [i, setI] = useState(0);
    const last = i === SLIDES.length - 1;
    const finish = () => { useSettings.getState().set({ onboarded: true }); nav('/', { replace: true }); };
    const S = SLIDES[i];
    return (
        <main className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-md flex-col bg-bg px-6 py-4">
            <div className="flex items-center justify-between"><LogoMark size={32} /><Button variant="ghost" size="sm" onClick={finish}>Skip</Button></div>
            <div key={i} className="flex flex-1 animate-fade-in flex-col items-center justify-center gap-6 text-center">
                <div className={cn('flex size-44 items-center justify-center rounded-[40%] bg-gradient-to-br text-7xl text-white shadow-2xl', S.color)}><Icon name={S.icon} /></div>
                <h1 className="text-3xl font-bold tracking-tight text-text">{S.title}</h1>
                <p className="text-muted">{S.body}</p>
            </div>
            <div className="mb-6 flex justify-center gap-2" aria-hidden>{SLIDES.map((_, n) => <span key={n} className={cn('h-2 rounded-full transition-all', n === i ? 'w-7 bg-primary' : 'w-2 bg-border-strong')} />)}</div>
            <Button size="lg" iconRight={last ? 'rocket-lunch' : 'arrow-right'} onClick={() => (last ? finish() : setI(i + 1))}>{last ? "Let's go" : 'Next'}</Button>
        </main>
    );
}

export function NotFound() {
    return (
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
            <div className="relative mb-6">
                <p aria-hidden className="select-none text-[110px] font-black leading-none tracking-tighter text-text/[0.06]">404</p>
                <span className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 to-blue-600 text-2xl text-white shadow-xl ring-8 ring-bg"><Icon name="plane-departure" /></span>
            </div>
            <h1 className="text-2xl font-bold text-text">This screen went off the radar</h1>
            <p className="mt-2 text-sm text-muted">The page you opened doesn't exist in this app. It may have moved in an update.</p>
            <div className="mt-6 flex gap-2"><Link to="/" className={buttonClass('primary')}><Icon name="home" />Home</Link><Link to="/tools" className={buttonClass('secondary')}><Icon name="tools" />Tools</Link></div>
        </div>
    );
}
