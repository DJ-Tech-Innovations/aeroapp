import { Head, Link, router, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, cn, Field, Icon, Input, Modal, Select, Textarea, useConfirm } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';

interface Role { id: number; name: string; label: string; description: string; isSystem: boolean; users: number; permissions: string[]; isSuper: boolean }
interface Permission { id: number; name: string; group: string; description: string }
interface Props { roles: Role[]; permissions: Permission[]; selected: string | null }

const GROUP_ICON: Record<string, string> = { Portal: 'apps', Tools: 'tools', Quizzes: 'list-check', 'Content packs': 'box', Media: 'picture', Classes: 'school', Users: 'users', Reports: 'chart-histogram', Settings: 'settings', 'Learner app': 'graduation-cap' };

function Matrix({ role, permissions }: { role: Role; permissions: Permission[] }) {
    const form = useForm({ label: role.label, description: role.description, permissions: role.permissions });
    const [q, setQ] = useState('');
    const confirm = useConfirm();
    const granted = new Set(role.isSuper ? permissions.map((p) => p.name) : form.data.permissions);
    const groups = useMemo(() => {
        const by: Record<string, Permission[]> = {};
        for (const p of permissions) (by[p.group] ??= []).push(p);
        return Object.entries(by);
    }, [permissions]);
    const term = q.trim().toLowerCase();
    const visible = groups.map(([g, ps]) => [g, ps.filter((p) => !term || g.toLowerCase().includes(term) || p.name.includes(term) || p.description.toLowerCase().includes(term))] as const).filter(([, ps]) => ps.length);
    const setMany = (names: string[], on: boolean) => {
        const next = new Set(form.data.permissions);
        names.forEach((n) => (on ? next.add(n) : next.delete(n)));
        form.setData('permissions', [...next]);
    };
    const dirty = form.isDirty;
    const remove = async () => {
        if (!(await confirm({ title: `Delete the “${role.label}” role?`, message: role.users ? 'Move its users to another role first.' : 'This cannot be undone.', confirmLabel: 'Delete role' }))) return;
        router.delete(`/admin/roles/${role.id}`);
    };

    return (
        <Card padded={false} className="overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="grid flex-1 gap-3 sm:max-w-xl">
                    <Field label="Role name" error={form.errors.label}><Input value={form.data.label} onChange={(e) => form.setData('label', e.target.value)} /></Field>
                    <Field label="Description"><Textarea rows={2} value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} /></Field>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {!role.isSystem ? <Button variant="ghost" icon="trash" className="text-danger" onClick={remove}>Delete</Button> : null}
                    <Button icon="disk" disabled={!dirty} loading={form.processing} onClick={() => form.put(`/admin/roles/${role.id}`, { preserveScroll: true, onSuccess: () => form.setDefaults() })}>Save role</Button>
                </div>
            </div>
            {role.isSuper ? <Alert tone="warning" className="m-5" title="Super administrators can do everything">This role bypasses every permission check, so it can't be restricted. Give it only to people who run the system.</Alert> : null}
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
                <div className="w-full sm:w-64"><Input icon="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search permissions…" /></div>
                <span className="text-sm text-muted"><span className="font-semibold text-text">{granted.size}</span> of {permissions.length} granted</span>
                {!role.isSuper ? (
                    <div className="ml-auto flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setMany(permissions.map((p) => p.name), true)}>Grant all</Button>
                        <Button variant="ghost" size="sm" onClick={() => form.setData('permissions', [])} disabled={!form.data.permissions.length}>Clear</Button>
                    </div>
                ) : null}
            </div>
            <div className="divide-y divide-border">
                {visible.map(([group, perms]) => {
                    const names = perms.map((p) => p.name);
                    const on = names.filter((n) => granted.has(n)).length;
                    return (
                        <div key={group} className="px-5 py-4">
                            <div className="mb-3 flex items-center gap-3">
                                <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-muted"><Icon name={GROUP_ICON[group] ?? 'key'} /></span>
                                <h3 className="text-sm font-semibold text-text">{group}</h3>
                                <span className={cn('rounded-full px-2 py-0.5 text-xs tabular-nums', on === names.length ? 'bg-success-soft text-success' : on ? 'bg-primary-soft text-primary-soft-fg' : 'bg-surface-2 text-muted')}>{on}/{names.length}</span>
                                {!role.isSuper ? <button type="button" onClick={() => setMany(names, on !== names.length)} className="ml-auto text-xs font-semibold text-primary hover:underline">{on === names.length ? 'Clear group' : 'Grant group'}</button> : null}
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {perms.map((p) => {
                                    const checked = granted.has(p.name);
                                    return (
                                        <div key={p.id} className={cn('rounded-xl border p-3 transition', checked ? 'border-primary/30 bg-primary-soft/60' : 'border-border bg-surface', !role.isSuper && 'hover:border-primary/40')}>
                                            <Checkbox checked={checked} disabled={role.isSuper} onChange={(v) => setMany([p.name], v)} label={p.description} description={<span className="font-mono">{p.name}</span>} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
            {dirty ? (
                <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur">
                    <span className="text-sm text-muted">You have unsaved changes.</span>
                    <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => form.reset()}>Discard</Button><Button size="sm" loading={form.processing} onClick={() => form.put(`/admin/roles/${role.id}`, { preserveScroll: true, onSuccess: () => form.setDefaults() })}>Save role</Button></div>
                </div>
            ) : null}
        </Card>
    );
}

export default function Roles({ roles, permissions, selected }: Props) {
    const [creating, setCreating] = useState(false);
    const role = roles.find((r) => r.name === selected) ?? roles[0];
    const form = useForm({ label: '', description: '', copyFrom: '' });
    return (
        <>
            <Head title="Roles & permissions" />
            <PageHeader title="Roles & permissions" icon="shield-check" description="A role is a named set of permissions. Give each person one or more roles on the Users page."
                actions={<Button icon="add" onClick={() => setCreating(true)}>New role</Button>} />
            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
                <div className="space-y-2">
                    {roles.map((r) => (
                        <Link key={r.id} href={`/admin/roles?role=${r.name}`} preserveScroll preserveState={false}
                            className={cn('block rounded-xl border p-4 transition', r.name === role?.name ? 'border-primary bg-primary-soft shadow-sm' : 'border-border bg-surface hover:border-border-strong')}>
                            <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-semibold text-text">{r.label}</span>
                                {r.isSystem ? <Badge tone="neutral" icon="lock">Built-in</Badge> : <Badge tone="primary">Custom</Badge>}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted">{r.description || 'No description'}</p>
                            <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                                <span className="flex items-center gap-1"><Icon name="users" />{r.users} user{r.users === 1 ? '' : 's'}</span>
                                <span className="flex items-center gap-1"><Icon name="key" />{r.isSuper ? 'All permissions' : `${r.permissions.length} permission${r.permissions.length === 1 ? '' : 's'}`}</span>
                            </div>
                        </Link>
                    ))}
                </div>
                {role ? <Matrix key={role.id} role={role} permissions={permissions} /> : null}
            </div>

            <Modal open={creating} onOpenChange={setCreating} title="New role" description="Start empty or copy the permissions of an existing role." icon="shield-check"
                footer={<><Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button form="role-form" type="submit" loading={form.processing}>Create role</Button></>}>
                <form id="role-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); form.post('/admin/roles', { onSuccess: () => { setCreating(false); form.reset(); } }); }}>
                    <Field label="Role name" required error={form.errors.label}><Input autoFocus value={form.data.label} onChange={(e) => form.setData('label', e.target.value)} placeholder="e.g. Content reviewer" /></Field>
                    <Field label="Description"><Textarea rows={2} value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} /></Field>
                    <Field label="Copy permissions from">
                        <Select value={form.data.copyFrom} onChange={(e) => form.setData('copyFrom', e.target.value)}>
                            <option value="">Start with no permissions</option>
                            {roles.filter((r) => !r.isSuper).map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
                        </Select>
                    </Field>
                </form>
            </Modal>
        </>
    );
}
