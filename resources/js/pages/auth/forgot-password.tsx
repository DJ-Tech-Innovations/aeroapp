import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Alert, Button, Field, Icon, Input } from '@/components/ui';
import AuthLayout from '@/layouts/auth-layout';

export default function ForgotPassword({ status }: { status?: string | null }) {
    const form = useForm({ email: '' });
    usePage();
    return (
        <AuthLayout headline="Locked out? It happens." message="Enter the email address on your account and we'll send you a secure link to choose a new password.">
            <Head title="Reset password" />
            <div className="animate-fade-in">
                <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-xl text-primary-soft-fg"><Icon name="key" /></span>
                <h2 className="text-2xl font-bold tracking-tight text-text">Forgot your password?</h2>
                <p className="mt-1.5 text-sm text-muted">We'll email you a reset link. It expires in 60 minutes.</p>
                {status ? <Alert tone="success" className="mt-6">{status}</Alert> : null}
                <form onSubmit={(e) => { e.preventDefault(); form.post('/forgot-password'); }} className="mt-6 space-y-4">
                    <Field label="Email address" error={form.errors.email}>
                        <Input type="email" icon="envelope" autoFocus value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} placeholder="you@school.edu" />
                    </Field>
                    <Button type="submit" size="lg" block loading={form.processing}>Email me a reset link</Button>
                </form>
                <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-text"><Icon name="arrow-left" />Back to sign in</Link>
            </div>
        </AuthLayout>
    );
}
