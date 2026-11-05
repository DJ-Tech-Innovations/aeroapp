import * as Dialog from '@radix-ui/react-dialog';
import * as Menu from '@radix-ui/react-dropdown-menu';
import * as Tip from '@radix-ui/react-tooltip';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { createContext, forwardRef, useCallback, useContext, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/** Class names with Tailwind conflict resolution (a caller's `hidden` beats a component's `inline-flex`). */
export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

/* ───────────── Icons (Flaticon UIcons, regular + solid rounded) ───────────── */

export function Icon({ name, solid, className, size }: { name: string; solid?: boolean; className?: string; size?: number }) {
    return <i aria-hidden className={cn(`fi fi-${solid ? 'sr' : 'rr'}-${name}`, 'shrink-0', className)} style={size ? { fontSize: size } : undefined} />;
}

export function Spinner({ className }: { className?: string }) {
    return <span aria-hidden className={cn('inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />;
}

/* ───────────── Buttons ───────────── */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'soft' | 'success';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-primary-fg shadow-sm shadow-primary/25 hover:bg-primary-hover',
    secondary: 'bg-surface text-text border border-border shadow-xs hover:bg-surface-2 hover:border-border-strong',
    outline: 'border border-primary/40 text-primary hover:bg-primary-soft',
    ghost: 'text-text-2 hover:bg-surface-2 hover:text-text',
    danger: 'bg-danger text-white shadow-sm hover:brightness-110',
    soft: 'bg-primary-soft text-primary-soft-fg hover:brightness-95 dark:hover:brightness-125',
    success: 'bg-success text-white shadow-sm hover:brightness-110',
};
const SIZE: Record<ButtonSize, string> = {
    xs: 'h-7 gap-1.5 rounded-md px-2 text-xs',
    sm: 'h-9 gap-2 rounded-lg px-3 text-sm',
    md: 'h-10 gap-2 rounded-lg px-4 text-sm',
    lg: 'h-12 gap-2.5 rounded-xl px-5 text-base',
};
export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) =>
    cn('inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50', VARIANT[variant], SIZE[size], extra);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: string;
    iconRight?: string;
    loading?: boolean;
    block?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', icon, iconRight, loading, block, className, children, disabled, type = 'button', ...rest }, ref) {
    return (
        <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass(variant, size, cn(block && 'w-full', className))} {...rest}>
            {loading ? <Spinner /> : icon ? <Icon name={icon} className={size === 'lg' ? 'text-lg' : 'text-[15px]'} /> : null}
            {children}
            {iconRight && !loading ? <Icon name={iconRight} className="text-[15px]" /> : null}
        </button>
    );
});

export function IconButton({ icon, label, active, className, size = 'md', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; active?: boolean; size?: 'sm' | 'md' | 'lg' }) {
    const s = { sm: 'size-8 text-[15px]', md: 'size-10 text-[17px]', lg: 'size-12 text-xl' }[size];
    return (
        <button type="button" aria-label={label} title={label} className={cn('inline-flex shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40', s, active ? 'bg-primary-soft text-primary-soft-fg' : 'text-muted hover:bg-surface-2 hover:text-text', className)} {...rest}>
            <Icon name={icon} solid={active} />
        </button>
    );
}

/* ───────────── Surfaces ───────────── */

export function Card({ className, children, padded = true, interactive, ...rest }: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean; interactive?: boolean }) {
    return (
        <div className={cn('rounded-2xl bg-surface shadow-card', padded && 'p-5', interactive && 'transition-shadow hover:shadow-card-hover', className)} {...rest}>
            {children}
        </div>
    );
}

export function CardHeader({ title, description, icon, actions, className }: { title: ReactNode; description?: ReactNode; icon?: string; actions?: ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4', className)}>
            <div className="flex min-w-0 items-center gap-3">
                {icon ? <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg"><Icon name={icon} /></span> : null}
                <div className="min-w-0">
                    <h3 className="font-semibold text-text">{title}</h3>
                    {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
                </div>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
    );
}

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'signal';
const TONE: Record<Tone, string> = {
    neutral: 'bg-surface-2 text-text-2 ring-border',
    primary: 'bg-primary-soft text-primary-soft-fg ring-primary/20',
    success: 'bg-success-soft text-success ring-success/20',
    warning: 'bg-warning-soft text-warning ring-warning/25',
    danger: 'bg-danger-soft text-danger ring-danger/20',
    info: 'bg-info-soft text-info ring-info/20',
    signal: 'bg-amber-500/12 text-amber-600 ring-amber-500/25 dark:text-amber-400',
};
export function Badge({ tone = 'neutral', icon, children, className, dot }: { tone?: Tone; icon?: string; children: ReactNode; className?: string; dot?: boolean }) {
    return (
        <span className={cn('inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', TONE[tone], className)}>
            {dot ? <span className="size-1.5 rounded-full bg-current" /> : icon ? <Icon name={icon} className="text-[11px]" /> : null}
            {children}
        </span>
    );
}

export function Alert({ tone = 'info', title, children, icon, className, action }: { tone?: Exclude<Tone, 'neutral' | 'signal'>; title?: ReactNode; children?: ReactNode; icon?: string; className?: string; action?: ReactNode }) {
    const ic = icon ?? { info: 'info', success: 'badge-check', warning: 'triangle-warning', danger: 'cross-circle', primary: 'info' }[tone];
    return (
        <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', {
            info: 'border-info/25 bg-info-soft', success: 'border-success/25 bg-success-soft', warning: 'border-warning/30 bg-warning-soft', danger: 'border-danger/25 bg-danger-soft', primary: 'border-primary/25 bg-primary-soft',
        }[tone], className)}>
            <Icon name={ic} className={cn('mt-0.5 text-base', { info: 'text-info', success: 'text-success', warning: 'text-warning', danger: 'text-danger', primary: 'text-primary' }[tone])} />
            <div className="min-w-0 flex-1 text-text-2">
                {title ? <p className="font-semibold text-text">{title}</p> : null}
                {children ? <div className={cn(title && 'mt-0.5')}>{children}</div> : null}
            </div>
            {action}
        </div>
    );
}

export function Skeleton({ className }: { className?: string }) {
    return <div aria-hidden className={cn('skeleton', className)} />;
}

export function EmptyState({ icon = 'box', title, description, action, className }: { icon?: string; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
            <div className="relative mb-4">
                <div className="absolute inset-0 -m-2 rounded-2xl bg-primary/5" />
                <div className="relative flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-2xl text-muted ring-1 ring-border"><Icon name={icon} /></div>
            </div>
            <h3 className="text-base font-semibold text-text">{title}</h3>
            {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
            {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
        </div>
    );
}

export function StatCard({ label, value, hint, icon, tone = 'primary', className, trend }: { label: string; value: ReactNode; hint?: ReactNode; icon?: string; tone?: Tone; className?: string; trend?: ReactNode }) {
    return (
        <Card interactive className={cn('flex flex-col gap-3', className)}>
            <div className="flex items-center justify-between gap-2">
                <p className="label-caps">{label}</p>
                {icon ? <span className={cn('flex size-9 items-center justify-center rounded-xl text-base ring-1 ring-inset', TONE[tone])}><Icon name={icon} /></span> : null}
            </div>
            <div className="flex items-end justify-between gap-2">
                <p className="text-2xl font-bold tracking-tight text-text tabular-nums sm:text-[28px]">{value}</p>
                {trend}
            </div>
            {hint ? <p className="-mt-1 text-xs text-muted">{hint}</p> : null}
        </Card>
    );
}

export function ProgressBar({ value, tone = 'primary', className, label }: { value: number; tone?: 'primary' | 'success' | 'danger' | 'warning'; className?: string; label?: string }) {
    const pct = Math.max(0, Math.min(1, value)) * 100;
    return (
        <div className={cn('h-2 overflow-hidden rounded-full bg-surface-3', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
            <div className={cn('h-full rounded-full transition-[width] duration-500', { primary: 'bg-primary', success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning' }[tone])} style={{ width: `${pct}%` }} />
        </div>
    );
}

export function Avatar({ src, name, initials, size = 36, className }: { src?: string | null; name?: string; initials?: string; size?: number; className?: string }) {
    const ini = initials ?? (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') ?? '?';
    const palette = ['bg-blue-600', 'bg-indigo-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600', 'bg-violet-600'];
    const color = palette[[...(name ?? ini)].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];
    return src ? (
        <img src={src} alt="" className={cn('shrink-0 rounded-full object-cover ring-2 ring-surface', className)} style={{ width: size, height: size }} />
    ) : (
        <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface', color, className)} style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}>{ini || '?'}</span>
    );
}

export function KV({ k, v, className }: { k: ReactNode; v: ReactNode; className?: string }) {
    return (
        <div className={cn('flex items-start justify-between gap-4 border-b border-border/70 py-2.5 last:border-0', className)}>
            <span className="text-sm text-muted">{k}</span>
            <span className="text-right text-sm font-medium text-text">{v}</span>
        </div>
    );
}

/* ───────────── Forms ───────────── */

const fieldBase = 'w-full rounded-lg border border-border bg-surface text-sm text-text shadow-xs transition placeholder:text-muted/70 hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15';

const FieldCtx = createContext<{ id?: string; invalid?: boolean }>({});

export function Field({ label, hint, error, required, children, className, htmlFor }: { label?: ReactNode; hint?: ReactNode; error?: string | null; required?: boolean; children: ReactNode; className?: string; htmlFor?: string }) {
    const auto = useId();
    const id = htmlFor ?? auto;
    return (
        <FieldCtx.Provider value={{ id, invalid: !!error }}>
            <div className={cn('flex flex-col gap-1.5', className)}>
                {label ? <label htmlFor={id} className="text-sm font-medium text-text-2">{label}{required ? <span className="ml-0.5 text-danger">*</span> : null}</label> : null}
                {children}
                {error ? <p className="flex items-center gap-1 text-xs font-medium text-danger"><Icon name="exclamation" className="text-[11px]" />{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
            </div>
        </FieldCtx.Provider>
    );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: string }>(function Input({ className, icon, id, ...rest }, ref) {
    const f = useContext(FieldCtx);
    const input = <input ref={ref} id={id ?? f.id} aria-invalid={f.invalid || undefined} className={cn(fieldBase, 'h-10 px-3', icon && 'pl-9', className)} {...rest} />;
    if (!icon) return input;
    return (
        <div className="relative">
            <Icon name={icon} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted" />
            {input}
        </div>
    );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, id, rows = 3, ...rest }, ref) {
    const f = useContext(FieldCtx);
    return <textarea ref={ref} id={id ?? f.id} rows={rows} aria-invalid={f.invalid || undefined} className={cn(fieldBase, 'px-3 py-2 leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, id, children, ...rest }, ref) {
    const f = useContext(FieldCtx);
    return (
        <div className="relative">
            <select ref={ref} id={id ?? f.id} aria-invalid={f.invalid || undefined} className={cn(fieldBase, 'h-10 appearance-none pl-3 pr-9', className)} {...rest}>{children}</select>
            <Icon name="angle-small-down" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
        </div>
    );
});

export function Checkbox({ checked, onChange, label, description, disabled, className }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean; className?: string }) {
    const id = useId();
    return (
        <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60', className)}>
            <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
            <span className={cn('mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition peer-focus-visible:ring-4 peer-focus-visible:ring-primary/20', checked ? 'border-primary bg-primary text-white' : 'border-border-strong bg-surface')}>
                {checked ? <Icon name="check" solid className="text-[10px]" /> : null}
            </span>
            {label || description ? (
                <span className="min-w-0">
                    {label ? <span className="block text-sm font-medium text-text">{label}</span> : null}
                    {description ? <span className="block text-xs text-muted">{description}</span> : null}
                </span>
            ) : null}
        </label>
    );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean }) {
    return (
        <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="flex w-full items-center gap-4 py-3 text-left disabled:opacity-50">
            <span className="min-w-0 flex-1">
                {label ? <span className="block text-sm font-medium text-text">{label}</span> : null}
                {description ? <span className="block text-xs text-muted">{description}</span> : null}
            </span>
            <span className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-surface-3 ring-1 ring-inset ring-border-strong')}>
                <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
            </span>
        </button>
    );
}

export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: string }[]; className?: string; size?: 'sm' | 'md' }) {
    return (
        <div role="tablist" className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1 no-scrollbar', className)}>
            {options.map((o) => (
                <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
                    className={cn('inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium transition', size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm', value === o.value ? 'bg-surface text-text shadow-sm ring-1 ring-border' : 'text-muted hover:text-text')}>
                    {o.icon ? <Icon name={o.icon} className="text-[13px]" solid={value === o.value} /> : null}
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function Chip({ label, selected, onClick, icon, count }: { label: ReactNode; selected?: boolean; onClick?: () => void; icon?: string; count?: number }) {
    return (
        <button type="button" onClick={onClick} aria-pressed={selected}
            className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition', selected ? 'border-primary bg-primary text-primary-fg shadow-sm shadow-primary/25' : 'border-border bg-surface text-text-2 hover:border-border-strong hover:text-text')}>
            {icon ? <Icon name={icon} className="text-[13px]" solid={selected} /> : null}
            {label}
            {count != null ? <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', selected ? 'bg-white/20' : 'bg-surface-2 text-muted')}>{count}</span> : null}
        </button>
    );
}

/* ───────────── Overlays ───────────── */

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md', icon }: { open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; icon?: string }) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
                <Dialog.Content className={cn('fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl bg-surface shadow-pop focus:outline-none data-[state=open]:animate-pop-in sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl', { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size])}>
                    <div className="flex items-start gap-3 border-b border-border px-5 py-4">
                        {icon ? <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-lg text-primary-soft-fg"><Icon name={icon} /></span> : null}
                        <div className="min-w-0 flex-1">
                            <Dialog.Title className="text-base font-semibold text-text">{title}</Dialog.Title>
                            {description ? <Dialog.Description className="mt-0.5 text-sm text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</Dialog.Description>}
                        </div>
                        <Dialog.Close asChild><IconButton icon="cross-small" label="Close" size="sm" /></Dialog.Close>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
                    {footer ? <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-border bg-surface-2/50 px-5 py-3 sm:rounded-b-2xl">{footer}</div> : null}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

interface ConfirmOptions { title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: 'danger' | 'primary'; icon?: string }
const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

/** `const confirm = useConfirm(); if (await confirm({...}))` — styled replacement for window.confirm. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
    const ask = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
    const close = (v: boolean) => { state?.resolve(v); setState(null); };
    const danger = (state?.tone ?? 'danger') === 'danger';
    return (
        <ConfirmCtx.Provider value={ask}>
            {children}
            <Dialog.Root open={!!state} onOpenChange={(o) => !o && close(false)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-6 shadow-pop focus:outline-none data-[state=open]:animate-pop-in">
                        <div className="flex gap-4">
                            <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-full text-lg', danger ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary')}><Icon name={state?.icon ?? (danger ? 'triangle-warning' : 'interrogation')} /></span>
                            <div className="min-w-0 flex-1">
                                <Dialog.Title className="text-base font-semibold text-text">{state?.title}</Dialog.Title>
                                <Dialog.Description asChild><div className="mt-1.5 text-sm text-muted">{state?.message}</div></Dialog.Description>
                            </div>
                        </div>
                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button variant="secondary" onClick={() => close(false)}>{state?.cancelLabel ?? 'Cancel'}</Button>
                            <Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>{state?.confirmLabel ?? 'Confirm'}</Button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </ConfirmCtx.Provider>
    );
}
export const useConfirm = () => useContext(ConfirmCtx);

export const DropdownMenu = Menu.Root;
export const DropdownTrigger = Menu.Trigger;
export function DropdownContent({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
    return (
        <Menu.Portal>
            <Menu.Content align={align} sideOffset={6} className={cn('z-50 min-w-48 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-pop data-[state=open]:animate-pop-in', className)}>
                {children}
            </Menu.Content>
        </Menu.Portal>
    );
}
export function DropdownItem({ icon, children, onSelect, danger, disabled }: { icon?: string; children: ReactNode; onSelect?: () => void; danger?: boolean; disabled?: boolean }) {
    return (
        <Menu.Item disabled={disabled} onSelect={onSelect} className={cn('flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition data-[disabled]:pointer-events-none data-[disabled]:opacity-50', danger ? 'text-danger data-[highlighted]:bg-danger-soft' : 'text-text-2 data-[highlighted]:bg-surface-2 data-[highlighted]:text-text')}>
            {icon ? <Icon name={icon} className="text-[14px] opacity-80" /> : null}
            {children}
        </Menu.Item>
    );
}
export const DropdownSeparator = () => <Menu.Separator className="my-1 h-px bg-border" />;
export const DropdownLabel = ({ children }: { children: ReactNode }) => <Menu.Label className="px-2.5 py-1.5 text-xs text-muted">{children}</Menu.Label>;

export const TooltipProvider = Tip.Provider;
export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
    return (
        <Tip.Root>
            <Tip.Trigger asChild>{children}</Tip.Trigger>
            <Tip.Portal>
                <Tip.Content side={side} sideOffset={8} className="z-50 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg data-[state=delayed-open]:animate-fade-in dark:bg-slate-700">
                    {content}
                </Tip.Content>
            </Tip.Portal>
        </Tip.Root>
    );
}

/* ───────────── Format helpers ───────────── */

export const fmtNumber = (n: number) => new Intl.NumberFormat().format(n);
export const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
export function timeAgo(iso?: string | null): string {
    if (!iso) return 'never';
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
    return fmtDay(iso);
}
