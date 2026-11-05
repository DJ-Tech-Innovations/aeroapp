import { Head, useForm, usePage } from '@inertiajs/react';
import { Avatar, Badge, Button, Card, CardHeader, Field, Input } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';
import type { SharedProps } from '@/types';

export default function Account({ profile }: { profile: { full_name: string; email: string; phone: string; avatar: string | null; initials: string } }) {
    const { props } = usePage<SharedProps>();
    const info = useForm({ full_name: profile.full_name, email: profile.email, phone: profile.phone });
    const pw = useForm({ current: '', password: '', password_confirmation: '' });
    return (
        <>
            <Head title="My account" />
            <PageHeader title="My account" icon="user" description="Your own profile and password." />
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <Card className="flex flex-col items-center text-center">
                    <Avatar src={profile.avatar} name={profile.full_name} initials={profile.initials} size={88} />
                    <h2 className="mt-4 text-lg font-bold text-text">{profile.full_name}</h2>
                    <p className="text-sm text-muted">{profile.email}</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-1">{props.auth.user?.roles.map((r) => <Badge key={r} tone="primary" className="capitalize">{r.replace('-', ' ')}</Badge>)}</div>
                </Card>
                <div className="space-y-6">
                    <Card padded={false}>
                        <CardHeader icon="id-badge" title="Profile" />
                        <form onSubmit={(e) => { e.preventDefault(); info.put('/admin/account', { preserveScroll: true }); }} className="grid gap-4 p-5 sm:grid-cols-2">
                            <Field label="Full name" error={info.errors.full_name}><Input value={info.data.full_name} onChange={(e) => info.setData('full_name', e.target.value)} /></Field>
                            <Field label="Phone" error={info.errors.phone}><Input value={info.data.phone} onChange={(e) => info.setData('phone', e.target.value)} /></Field>
                            <Field label="Email" error={info.errors.email} className="sm:col-span-2"><Input type="email" value={info.data.email} onChange={(e) => info.setData('email', e.target.value)} /></Field>
                            <div className="flex justify-end sm:col-span-2"><Button type="submit" icon="disk" loading={info.processing} disabled={!info.isDirty}>Save profile</Button></div>
                        </form>
                    </Card>
                    <Card padded={false}>
                        <CardHeader icon="lock" title="Password" description="Use at least 8 characters." />
                        <form onSubmit={(e) => { e.preventDefault(); pw.put('/admin/account/password', { preserveScroll: true, onSuccess: () => pw.reset() }); }} className="grid gap-4 p-5 sm:grid-cols-2">
                            <Field label="Current password" error={pw.errors.current} className="sm:col-span-2"><Input type="password" autoComplete="current-password" value={pw.data.current} onChange={(e) => pw.setData('current', e.target.value)} /></Field>
                            <Field label="New password" error={pw.errors.password}><Input type="password" autoComplete="new-password" value={pw.data.password} onChange={(e) => pw.setData('password', e.target.value)} /></Field>
                            <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={pw.data.password_confirmation} onChange={(e) => pw.setData('password_confirmation', e.target.value)} /></Field>
                            <div className="flex justify-end sm:col-span-2"><Button type="submit" icon="key" loading={pw.processing}>Change password</Button></div>
                        </form>
                    </Card>
                </div>
            </div>
        </>
    );
}
