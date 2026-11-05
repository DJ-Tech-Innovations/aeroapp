import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Avatar, Badge, Button, buttonClass, Card, Field, Icon, Input, StatCard, useConfirm } from '@/components/ui';
import { fmtDate } from '@/shared';
import { OfflineBanner, Page, PageTitle, SectionTitle } from '../components/page';
import { cached } from '../lib/db';
import { haptic } from '../lib/haptics';
import { useAsync, usePending } from '../lib/hooks';
import { classOverview } from '../lib/instructor';
import { useNetwork } from '../lib/network';
import { resizeImage, updateProfile, uploadAvatar } from '../lib/profile';
import { useSession } from '../lib/session';
import { studentStats } from '../lib/stats';
import { syncNow } from '../lib/sync';
import { api } from '../lib/api';

export function Profile() {
    const profile = useSession((s) => s.profile)!;
    const online = useNetwork((s) => s.online);
    const pending = usePending(profile.id);
    const confirm = useConfirm();
    const isStudent = profile.role === 'student';
    const stats = useLiveQuery(() => (isStudent ? studentStats(profile.id) : undefined), [profile.id, isStudent]);
    const overview = useAsync(async () => (!isStudent ? (await cached('classOverview', classOverview)).data : null), [isStudent]);
    const [syncing, setSyncing] = useState(false);

    const doSync = async () => {
        setSyncing(true);
        try {
            const r = await syncNow(profile.id);
            if (r.rejected.length) toast.warning(`${r.rejected.length} item(s) were not accepted`, { description: r.rejected.slice(0, 3).join(' · ') });
            else toast.success('Everything is synced');
        } catch (e) { toast.error((e as Error).message); } finally { setSyncing(false); }
    };
    const signOut = async () => {
        if (pending?.total && !(await confirm({ title: 'Sign out with unsynced changes?', message: `${pending.total} item(s) haven't uploaded yet. They stay on this device and upload next time you sign in here.`, confirmLabel: 'Sign out anyway' }))) return;
        await useSession.getState().signOut();
    };

    return (
        <Page>
            <Card className="relative overflow-hidden p-0">
                <div className="h-24 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-600"><div className="bg-grid h-full w-full opacity-40" /></div>
                <div className="-mt-10 flex flex-col items-center px-5 pb-5 text-center sm:flex-row sm:items-end sm:gap-4 sm:text-left">
                    <Avatar src={profile.avatarUrl} name={profile.fullName} size={88} className="ring-4" />
                    <div className="mt-3 min-w-0 flex-1 sm:mt-0 sm:pb-1">
                        <h1 className="truncate text-2xl font-bold text-text">{profile.fullName || 'Your name'}</h1>
                        <p className="truncate text-sm text-muted">{profile.email}</p>
                    </div>
                    <div className="mt-3 flex gap-2 sm:mt-0"><Badge tone="primary" icon={isStudent ? 'graduation-cap' : 'chalkboard-user'}>{isStudent ? 'Student' : 'Instructor'}</Badge></div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center text-sm">
                    {[['ID', profile.idNumber], ['School', profile.school], ['Section', profile.section]].map(([k, v]) => <div key={k} className="px-2 py-3"><p className="label-caps">{k}</p><p className="mt-0.5 truncate font-medium text-text">{v || '—'}</p></div>)}
                </div>
            </Card>
            <OfflineBanner />
            {pending?.total ? (
                <Card className="flex flex-col gap-3 border border-info/30 bg-info-soft sm:flex-row sm:items-center">
                    <Icon name="cloud-upload" className="text-2xl text-info" />
                    <div className="flex-1"><p className="font-semibold text-text">{pending.total} change{pending.total > 1 ? 's' : ''} waiting to sync</p><p className="text-sm text-muted">{pending.attempts} attempt{pending.attempts === 1 ? '' : 's'}{pending.profile ? ' · profile edits' : ''}. They upload automatically when you're online.</p></div>
                    <Button variant="secondary" icon="refresh" onClick={doSync} loading={syncing} disabled={!online}>Sync now</Button>
                </Card>
            ) : null}

            <SectionTitle title={isStudent ? 'My progress' : 'Class overview'} />
            {isStudent ? (
                <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Tools viewed" value={stats?.toolsViewed ?? 0} icon="eye" />
                    <StatCard label="Quizzes taken" value={stats?.quizzesTaken ?? 0} icon="list-check" tone="info" />
                    <StatCard label="Average score" value={stats?.averageScore != null ? `${stats.averageScore}%` : '—'} icon="chart-histogram" tone="success" />
                    <StatCard label="Learning streak" value={`${stats?.streak ?? 0} day${stats?.streak === 1 ? '' : 's'}`} icon="flame" tone="signal" />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Students" value={overview.data?.students ?? '—'} icon="users" />
                    <StatCard label="Class average" value={overview.data ? `${overview.data.averageScore}%` : '—'} icon="chart-histogram" tone="success" />
                </div>
            )}

            {isStudent ? (
                <>
                    <SectionTitle title="Recent attempts" />
                    {stats?.history.length ? (
                        <Card padded={false} className="divide-y divide-border">
                            {stats.history.slice(0, 8).map((a) => {
                                const p = Math.round((a.score / (a.maxScore || 1)) * 100);
                                return (
                                    <Link key={a.id} to={`/quizzes/${a.quizId}/result/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                                        <span className={`flex size-10 items-center justify-center rounded-xl text-xs font-bold tabular-nums ${a.passed ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>{p}%</span>
                                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text">{a.quizTitle}</p><p className="text-xs text-muted">{fmtDate(a.submittedAt!)}{a.quizMode === 'exam' ? ' · Exam' : ''}</p></div>
                                        <Icon name={a.syncStatus === 'synced' ? 'cloud-check' : 'cloud-upload'} className={a.syncStatus === 'synced' ? 'text-success' : 'text-warning'} />
                                    </Link>
                                );
                            })}
                        </Card>
                    ) : <Card className="text-sm text-muted">Your quiz attempts will appear here.</Card>}
                </>
            ) : null}

            <Card padded={false} className="divide-y divide-border">
                {[['/profile/edit', 'pencil', 'Edit profile'], ['/profile/password', 'key', 'Change password'], ['/settings', 'settings', 'Settings']].map(([to, icon, label]) => (
                    <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2/60"><Icon name={icon} className="text-muted" /><span className="flex-1 font-medium text-text">{label}</span><Icon name="angle-right" className="text-muted" /></Link>
                ))}
            </Card>
            <Button variant="ghost" icon="sign-out-alt" className="text-danger" onClick={signOut}>Sign out</Button>
        </Page>
    );
}

export function EditProfile() {
    const nav = useNavigate();
    const profile = useSession((s) => s.profile)!;
    const online = useNetwork((s) => s.online);
    const [f, setF] = useState({ fullName: profile.fullName, idNumber: profile.idNumber, school: profile.school, section: profile.section });
    const [avatar, setAvatar] = useState(profile.avatarUrl);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [err, setErr] = useState('');
    const file = useRef<HTMLInputElement>(null);
    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0];
        if (!picked) return;
        if (!online) return setErr('Photos can only be uploaded while online — your other edits can still be saved.');
        setUploading(true);
        try { const p = await uploadAvatar(profile.id, await resizeImage(picked)); setAvatar(p.avatarUrl); useSession.getState().setProfile({ ...profile, avatarUrl: p.avatarUrl }); toast.success('Photo updated'); } catch (ex) { setErr((ex as Error).message); } finally { setUploading(false); }
    };
    const save = async () => {
        if (f.fullName.trim().length < 2) return setErr('Enter your full name.');
        setSaving(true); setErr('');
        const updated = await updateProfile(profile.id, { ...f, avatarUrl: avatar });
        useSession.getState().setProfile(updated);
        haptic.success();
        toast.success(updated.pendingSync ? 'Saved on this device — will sync when online' : 'Profile saved');
        nav('/profile');
    };
    return (
        <Page>
            <PageTitle back="/profile" title="Edit profile" />
            <Card className="flex flex-col items-center gap-3">
                <Avatar src={avatar} name={f.fullName || profile.fullName} size={96} />
                <input ref={file} type="file" accept="image/*" hidden onChange={onFile} />
                <Button size="sm" variant="secondary" icon="camera" loading={uploading} onClick={() => file.current?.click()}>Change photo</Button>
            </Card>
            {!online ? <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-text-2">You're offline. Edits are saved on this device and marked “pending sync”.</p> : null}
            <Card className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" className="sm:col-span-2"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
                <Field label="Student / employee ID"><Input value={f.idNumber} onChange={(e) => setF({ ...f, idNumber: e.target.value })} /></Field>
                <Field label="Section / class"><Input value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} /></Field>
                <Field label="School" className="sm:col-span-2"><Input value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })} /></Field>
                <Field label="Email" hint="Ask an administrator to change your sign-in email." className="sm:col-span-2"><Input value={profile.email} readOnly disabled /></Field>
            </Card>
            {err ? <p role="alert" className="text-sm font-medium text-danger">{err}</p> : null}
            <Button size="lg" icon="disk" onClick={save} loading={saving}>Save changes</Button>
        </Page>
    );
}

export function ChangePassword() {
    const online = useNetwork((s) => s.online);
    const [f, setF] = useState({ current: '', password: '', password_confirmation: '' });
    const [state, setState] = useState<'idle' | 'busy'>('idle');
    const [err, setErr] = useState('');
    const go = async () => {
        setState('busy'); setErr('');
        try { await api.post('/me/password', f); toast.success('Password updated'); setF({ current: '', password: '', password_confirmation: '' }); } catch (e) { setErr((e as Error).message); } finally { setState('idle'); }
    };
    return (
        <Page>
            <PageTitle back="/profile" title="Change password" />
            {!online ? <p className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-text-2"><Icon name="wifi-slash" className="text-warning" />Changing your password needs an internet connection.</p> : null}
            <Card className="space-y-4">
                <Field label="Current password"><Input type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
                <Field label="New password" hint="At least 8 characters."><Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
                <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={f.password_confirmation} onChange={(e) => setF({ ...f, password_confirmation: e.target.value })} /></Field>
                {err ? <p role="alert" className="text-sm font-medium text-danger">{err}</p> : null}
                <Button block icon="key" loading={state === 'busy'} disabled={!online || f.password.length < 8 || !f.current} onClick={go}>Update password</Button>
            </Card>
            <Link to="/profile" className={buttonClass('ghost')}>Cancel</Link>
        </Page>
    );
}
