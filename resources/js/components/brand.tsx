import { useId } from 'react';
import { cn } from './ui';

/** AeroApp mark: aircraft on a navy tile with an amber signal light. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
    // Unique gradient id per instance: a shared id breaks when the first copy sits in a hidden (display:none) element.
    const gid = `aeroapp-g-${useId().replace(/:/g, '')}`;
    return (
        <svg viewBox="0 0 512 512" width={size} height={size} className={cn('shrink-0', className)} aria-hidden>
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#1e3a8a" />
                    <stop offset="1" stopColor="#2563eb" />
                </linearGradient>
            </defs>
            <rect width="512" height="512" rx="120" fill={`url(#${gid})`} />
            <circle cx="256" cy="256" r="168" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="18" />
            <path fill="#fff" d="M256 92c13 0 22 14 22 34v84l132 74v34l-132-38v74l38 30v28l-60-18-60 18v-28l38-30v-74l-132 38v-34l132-74v-84c0-20 9-34 22-34z" />
            <circle cx="256" cy="404" r="16" fill="#f59e0b" />
        </svg>
    );
}

export function Wordmark({ name = 'AeroApp', tagline, light, className }: { name?: string; tagline?: string; light?: boolean; className?: string }) {
    return (
        <span className={cn('flex min-w-0 items-center gap-3', className)}>
            <LogoMark size={36} />
            <span className="min-w-0 leading-tight">
                <span className={cn('block truncate text-[15px] font-bold tracking-tight', light ? 'text-white' : 'text-text')}>{name}</span>
                {tagline ? <span className={cn('block truncate text-[11px]', light ? 'text-blue-200/70' : 'text-muted')}>{tagline}</span> : null}
            </span>
        </span>
    );
}

/** Flaticon's free licence requires visible attribution. */
export function IconCredit({ className }: { className?: string }) {
    return (
        <a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer" className={cn('text-[11px] underline-offset-2 hover:underline', className)}>
            Icons: UIcons by Flaticon
        </a>
    );
}
