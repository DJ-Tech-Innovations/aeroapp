import { Head, Link, useForm } from '@inertiajs/react';
import { Button, Field, Icon, Input } from '@/components/ui';
import AuthLayout from '@/layouts/auth-layout';

export default function ResetPassword({ token, email }: { token: string; email: string }) {
    const form = useForm({ token, email, password: '', password_confirmation: '' });
    return (
        <AuthLayout headline="Choose a new password." message="Use at least 8 characters. A short sentence is easy to remember and hard to guess.">
            <Head title="Choose a new password" />
            <div className="animate-fade-in">
                <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-xl text-primary-soft-fg"><Icon name="lock" /></span>
                <h2 className="text-2xl font-bold tracking-tight text-text">Set a new password</h2>
                <form onSubmit={(e) => { e.preventDefault(); form.post('/reset-password', { onFinish: () => form.reset('password', 'password_confirmation') }); }} className="mt-6 space-y-4">
                    <Field label="Email address" error={form.errors.email}><Input type="email" icon="envelope" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} /></Field>
                    <Field label="New password" error={form.errors.password} hint="At least 8 characters."><Input type="password" icon="lock" autoComplete="new-password" autoFocus value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} /></Field>
                    <Field label="Confirm new password"><Input type="password" icon="lock" autoComplete="new-password" value={form.data.password_confirmation} onChange={(e) => form.setData('password_confirmation', e.target.value)} /></Field>
                    <Button type="submit" size="lg" block loading={form.processing}>Save password</Button>
                </form>
                <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-text"><Icon name="arrow-left" />Back to sign in</Link>
            </div>
        </AuthLayout>
    );
}
