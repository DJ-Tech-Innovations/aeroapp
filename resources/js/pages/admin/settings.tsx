import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Alert, Badge, Button, Card, CardHeader, cn, Field, Icon, Input, Select, Switch, Textarea, timeAgo } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';

interface Secret { set: boolean; last4: string | null; source: string | null; updatedAt: string | null }
interface Props {
    tab: string; organization: { name: string; tagline?: string }; loginScreen: { headline: string; message: string };
    meshy: { aiModel: string; targetPolycount: number; enablePbr: boolean }; secrets: Record<'meshy' | 'anthropic', Secret>;
}

const TABS = [
    { key: 'organization', label: 'Organization', icon: 'building', desc: 'Name and branding' },
    { key: 'login', label: 'Sign-in screen', icon: 'sign-in-alt', desc: 'Headline and message' },
    { key: 'ai', label: 'AI services', icon: 'sparkles', desc: '3D generation and part suggestions' },
];

function SecretCard({ name, title, description, info, link }: { name: 'meshy' | 'anthropic'; title: string; description: string; info: Secret; link: string }) {
    const form = useForm({ value: '' });
    const save = () => form.put(`/admin/settings/secrets/${name}`, { preserveScroll: true, onSuccess: () => form.reset() });
    return (
        <Card padded={false}>
            <CardHeader icon={name === 'meshy' ? 'cube' : 'sparkles'} title={title} description={description}
                actions={info.set ? <Badge tone="success" icon="check">Connected · ••••{info.last4}</Badge> : <Badge tone="warning">Not set</Badge>} />
            <div className="space-y-4 p-5">
                {info.set ? <p className="text-xs text-muted">{info.source === 'env' ? 'Using the key from the server .env file.' : `Saved ${timeAgo(info.updatedAt)}, encrypted with the app key. Only the last 4 characters are ever shown.`}</p> : null}
                <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <Field className="flex-1" error={(form.errors as Record<string, string>)[name] ?? form.errors.value}>
                        <Input type="password" autoComplete="off" icon="key" value={form.data.value} onChange={(e) => form.setData('value', e.target.value)} placeholder={info.set ? 'Paste a new key to replace it' : 'Paste the API key'} />
                    </Field>
                    <Button type="submit" loading={form.processing} disabled={!form.data.value}>Verify & save</Button>
                    {info.set && info.source === 'settings' ? <Button variant="ghost" className="text-danger" onClick={() => router.put(`/admin/settings/secrets/${name}`, { value: '' }, { preserveScroll: true })}>Remove</Button> : null}
                </form>
                <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Get a key <Icon name="arrow-up-right-from-square" className="text-[10px]" /></a>
            </div>
        </Card>
    );
}

export default function Settings(p: Props) {
    const [tab, setTab] = useState(TABS.some((t) => t.key === p.tab) ? p.tab : 'organization');
    const org = useForm({ name: p.organization.name, tagline: p.organization.tagline ?? '' });
    const login = useForm(p.loginScreen);
    const meshy = useForm(p.meshy);
    return (
        <>
            <Head title="Settings" />
            <PageHeader title="Settings" icon="settings" description="Organization-wide settings. Changes apply to everyone immediately." />
            <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                <nav className="flex gap-2 overflow-x-auto no-scrollbar lg:flex-col">
                    {TABS.map((t) => (
                        <button key={t.key} type="button" onClick={() => { setTab(t.key); history.replaceState(null, '', `?tab=${t.key}`); }}
                            className={cn('flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition lg:w-full', tab === t.key ? 'bg-surface shadow-card' : 'text-muted hover:bg-surface/60 hover:text-text')}>
                            <span className={cn('flex size-9 items-center justify-center rounded-lg', tab === t.key ? 'bg-primary-soft text-primary-soft-fg' : 'bg-surface-2')}><Icon name={t.icon} solid={tab === t.key} /></span>
                            <span><span className="block text-sm font-semibold text-text">{t.label}</span><span className="hidden text-xs text-muted lg:block">{t.desc}</span></span>
                        </button>
                    ))}
                </nav>

                <div className="min-w-0 space-y-6">
                    {tab === 'organization' ? (
                        <Card padded={false}>
                            <CardHeader icon="building" title="Organization" description="Shown in the sidebar, sign-in screen and learner app." />
                            <form onSubmit={(e) => { e.preventDefault(); org.put('/admin/settings/organization', { preserveScroll: true }); }} className="space-y-4 p-5">
                                <Field label="Name" required error={org.errors.name}><Input value={org.data.name} onChange={(e) => org.setData('name', e.target.value)} /></Field>
                                <Field label="Tagline" error={org.errors.tagline}><Input value={org.data.tagline} onChange={(e) => org.setData('tagline', e.target.value)} placeholder="Aircraft Tool Familiarization" /></Field>
                                <div className="flex justify-end"><Button type="submit" icon="disk" loading={org.processing} disabled={!org.isDirty}>Save</Button></div>
                            </form>
                        </Card>
                    ) : null}

                    {tab === 'login' ? (
                        <Card padded={false}>
                            <CardHeader icon="sign-in-alt" title="Sign-in screen" description="The message on the left panel of the sign-in page (desktop)." />
                            <form onSubmit={(e) => { e.preventDefault(); login.put('/admin/settings/login-screen', { preserveScroll: true }); }} className="space-y-4 p-5">
                                <Field label="Headline" required error={login.errors.headline}><Input value={login.data.headline} onChange={(e) => login.setData('headline', e.target.value)} /></Field>
                                <Field label="Message" error={login.errors.message}><Textarea rows={3} value={login.data.message} onChange={(e) => login.setData('message', e.target.value)} /></Field>
                                <div className="rounded-2xl bg-gradient-to-br from-blue-950 via-blue-900 to-slate-950 p-6 text-white">
                                    <p className="label-caps mb-2 text-blue-200/70">Preview</p>
                                    <p className="text-2xl font-bold leading-tight">{login.data.headline || '—'}</p>
                                    <p className="mt-2 text-sm text-blue-100/80">{login.data.message}</p>
                                </div>
                                <div className="flex justify-end"><Button type="submit" icon="disk" loading={login.processing} disabled={!login.isDirty}>Save</Button></div>
                            </form>
                        </Card>
                    ) : null}

                    {tab === 'ai' ? (
                        <>
                            <Alert tone="info" title="Optional">Both services are optional. Without them you can still upload your own GLB models in the Media library and type part names by hand.</Alert>
                            <SecretCard name="meshy" title="Meshy — photo to 3D" description="Turns 1–4 photos of a tool into a textured 3D model." info={p.secrets.meshy} link="https://www.meshy.ai/api" />
                            <SecretCard name="anthropic" title="Claude — part suggestions" description="Looks at the tool photos and suggests the parts students should learn." info={p.secrets.anthropic} link="https://console.anthropic.com/" />
                            <Card padded={false}>
                                <CardHeader icon="settings-sliders" title="3D generation defaults" description="Lower polycounts download faster on phones." />
                                <form onSubmit={(e) => { e.preventDefault(); meshy.put('/admin/settings/meshy', { preserveScroll: true }); }} className="space-y-4 p-5">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field label="Model"><Select value={meshy.data.aiModel} onChange={(e) => meshy.setData('aiModel', e.target.value)}><option value="latest">Latest</option><option value="meshy-6">Meshy 6</option><option value="meshy-6-lite">Meshy 6 Lite</option></Select></Field>
                                        <Field label="Target polycount" error={meshy.errors.targetPolycount}><Input type="number" min={1000} max={300000} step={1000} value={meshy.data.targetPolycount} onChange={(e) => meshy.setData('targetPolycount', Number(e.target.value))} /></Field>
                                    </div>
                                    <div className="rounded-xl bg-surface-2 px-4"><Switch checked={meshy.data.enablePbr} onChange={(v) => meshy.setData('enablePbr', v)} label="Physically based materials (PBR)" description="More realistic metal and plastic, slightly larger files." /></div>
                                    <div className="flex justify-end"><Button type="submit" icon="disk" loading={meshy.processing} disabled={!meshy.isDirty}>Save</Button></div>
                                </form>
                            </Card>
                        </>
                    ) : null}
                </div>
            </div>
        </>
    );
}
