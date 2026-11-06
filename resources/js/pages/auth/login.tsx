import { Head, Link, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Checkbox, Field, Icon, Input } from '@/components/ui';
import { InstallAppCard } from '@/components/install-app';
import AuthLayout from '@/layouts/auth-layout';

interface Props { status?: string | null; expired?: boolean; screen: { headline: string; message: string }; demoAccounts: { label: string; email: string }[] }

export default function Login({ status, expired, screen, demoAccounts }: Props) {
    const form = useForm({ email: '', password: '', remember: true });
    const [show, setShow] = useState(false);
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    const submit = (e: FormEvent) => { e.preventDefault(); form.post('/login', { onFinish: () => form.reset('password') }); };
    const demo = (email: string) => { form.setData({ email, password: 'password', remember: true }); };

    return (
        <AuthLayout headline={screen.headline} message={screen.message}>
            <Head title="Sign in" />
            <div className="animate-fade-in">
                <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Welcome back</h2>
                <p className="mt-1.5 text-sm text-muted">Sign in to continue to your account.</p>

                <div className="mt-6 space-y-3">
                    {expired ? <Alert tone="warning" title="Your session expired">Sign in again to keep syncing your progress.</Alert> : null}
                    {status ? <Alert tone="success">{status}</Alert> : null}
                    {offline ? <Alert tone="warning" icon="wifi-slash" title="You're offline">Signing in needs an internet connection. Already signed in on this device? <a href="/app" className="font-semibold text-primary underline">Open the app</a>.</Alert> : null}
                </div>

                <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                    <Field label="Email address" error={form.errors.email}>
                        <Input type="email" icon="envelope" autoComplete="username" autoFocus placeholder="you@school.edu" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                    </Field>
                    <Field label={<span className="flex w-full items-center justify-between">Password<Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">Forgot password?</Link></span>} error={form.errors.password}>
                        <div className="relative">
                            <Input type={show ? 'text' : 'password'} icon="lock" autoComplete="current-password" placeholder="••••••••" className="pr-10" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} />
                            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-text" aria-label={show ? 'Hide password' : 'Show password'}><Icon name={show ? 'eye-crossed' : 'eye'} /></button>
                        </div>
                    </Field>
                    <Checkbox checked={form.data.remember} onChange={(v) => form.setData('remember', v)} label="Keep me signed in" description="Recommended on your own device — the app works offline for 14 days." />
                    <Button type="submit" size="lg" block loading={form.processing} iconRight="arrow-right">Sign in</Button>
                </form>

                <InstallAppCard />

                {demoAccounts.length ? (
                    <div className="mt-8 rounded-2xl border border-dashed border-border-strong p-4">
                        <p className="label-caps mb-3 flex items-center gap-2"><Icon name="flask" />Demo accounts · password “password”</p>
                        <div className="grid grid-cols-3 gap-2">
                            {demoAccounts.map((a) => (
                                <button key={a.email} type="button" onClick={() => demo(a.email)} className="rounded-lg border border-border bg-surface px-2 py-2 text-xs font-semibold text-text-2 transition hover:border-primary hover:text-primary">{a.label}</button>
                            ))}
                        </div>
                    </div>
                ) : null}
                <p className="mt-8 text-center text-xs text-muted">Accounts are created by your administrator.</p>
            </div>
        </AuthLayout>
    );
}
