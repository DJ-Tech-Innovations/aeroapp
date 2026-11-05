import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { FilterSelect, MiniStats, Pagination, SearchInput, Table, Td, Toolbar, useFilters } from '@/components/admin/kit';
import { Avatar, Badge, Button, cn, DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger, EmptyState, Field, Icon, IconButton, Input, Modal, Switch, timeAgo, useConfirm } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';
import { can, type Paginated, type SharedProps } from '@/types';

interface Row {
    id: string; email: string; full_name: string; id_number: string; school: string; section: string; phone: string;
    is_active: boolean; avatar: string | null; initials: string; roles: { name: string; label: string }[]; last_login_at: string | null; created_at: string;
}
interface RoleOpt { name: string; label: string; description: string }
interface Props { users: Paginated<Row>; filters: { q: string; role: string; status: string }; roles: RoleOpt[]; counts: { total: number; active: number; inactive: number; recent: number } }

const ROLE_TONE: Record<string, 'primary' | 'info' | 'success' | 'signal' | 'neutral'> = { 'super-admin': 'signal', admin: 'primary', instructor: 'info', student: 'success' };

function UserForm({ user, roles, onDone }: { user: Row | null; roles: RoleOpt[]; onDone: () => void }) {
    const { props } = usePage<SharedProps>();
    const isSuper = props.auth.user?.roles.includes('super-admin');
    const form = useForm({
        full_name: user?.full_name ?? '', email: user?.email ?? '', id_number: user?.id_number ?? '', school: user?.school ?? '', section: user?.section ?? '',
        phone: user?.phone ?? '', password: '', roles: user?.roles.map((r) => r.name) ?? ['student'], is_active: user?.is_active ?? true,
    });
    const toggleRole = (name: string) => form.setData('roles', form.data.roles.includes(name) ? form.data.roles.filter((r) => r !== name) : [...form.data.roles, name]);
    const submit = () => {
        const opts = { preserveScroll: true, onSuccess: onDone };
        if (user) form.put(`/admin/users/${user.id}`, opts); else form.post('/admin/users', opts);
    };
    return (
        <form id="user-form" onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required error={form.errors.full_name}><Input value={form.data.full_name} onChange={(e) => form.setData('full_name', e.target.value)} autoFocus /></Field>
                <Field label="Email" required error={form.errors.email}><Input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} /></Field>
                <Field label="ID number" error={form.errors.id_number}><Input value={form.data.id_number} onChange={(e) => form.setData('id_number', e.target.value)} placeholder="AMT-2026-001" /></Field>
                <Field label="Phone" error={form.errors.phone}><Input value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} /></Field>
                <Field label="School" error={form.errors.school}><Input value={form.data.school} onChange={(e) => form.setData('school', e.target.value)} /></Field>
                <Field label="Section" error={form.errors.section}><Input value={form.data.section} onChange={(e) => form.setData('section', e.target.value)} placeholder="AMT-2A" /></Field>
                <Field label={user ? 'New password' : 'Password'} required={!user} hint={user ? 'Leave blank to keep the current password.' : 'At least 8 characters. Share it with the user securely.'} error={form.errors.password} className="sm:col-span-2">
                    <Input type="password" autoComplete="new-password" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} />
                </Field>
            </div>
            <div>
                <p className="mb-2 text-sm font-medium text-text-2">Roles <span className="text-danger">*</span></p>
                <div className="grid gap-2 sm:grid-cols-2">
                    {roles.filter((r) => isSuper || r.name !== 'super-admin').map((r) => {
                        const on = form.data.roles.includes(r.name);
                        return (
                            <button key={r.name} type="button" onClick={() => toggleRole(r.name)} aria-pressed={on}
                                className={cn('flex items-start gap-3 rounded-xl border p-3 text-left transition', on ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-border-strong')}>
                                <span className={cn('mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border', on ? 'border-primary bg-primary text-white' : 'border-border-strong')}>{on ? <Icon name="check" solid className="text-[10px]" /> : null}</span>
                                <span className="min-w-0"><span className="block text-sm font-semibold text-text">{r.label}</span><span className="block text-xs text-muted">{r.description}</span></span>
                            </button>
                        );
                    })}
                </div>
                {form.errors.roles ? <p className="mt-1.5 text-xs font-medium text-danger">{form.errors.roles}</p> : null}
            </div>
            <div className="rounded-xl bg-surface-2 px-4"><Switch checked={form.data.is_active} onChange={(v) => form.setData('is_active', v)} label="Account active" description="Inactive accounts can't sign in and are signed out immediately." /></div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="secondary" onClick={onDone}>Cancel</Button>
                <Button type="submit" loading={form.processing} icon="disk">{user ? 'Save changes' : 'Create account'}</Button>
            </div>
        </form>
    );
}

export default function Users({ users, filters, roles, counts }: Props) {
    const { props } = usePage<SharedProps>();
    const me = props.auth.user;
    const manage = can(me, 'users.manage');
    const f = useFilters(filters);
    const confirm = useConfirm();
    const [editing, setEditing] = useState<Row | null | 'new'>(null);

    const toggle = async (u: Row) => {
        if (u.is_active && !(await confirm({ title: `Deactivate ${u.full_name || u.email}?`, message: "They'll be signed out and won't be able to sign in until you reactivate the account. Their data is kept.", confirmLabel: 'Deactivate' }))) return;
        router.post(`/admin/users/${u.id}/toggle`, {}, { preserveScroll: true });
    };
    const remove = async (u: Row) => {
        if (!(await confirm({ title: `Delete ${u.full_name || u.email}?`, message: 'This permanently deletes the account and its quiz attempts. This cannot be undone.', confirmLabel: 'Delete account' }))) return;
        router.delete(`/admin/users/${u.id}`, { preserveScroll: true });
    };

    return (
        <>
            <Head title="Users" />
            <PageHeader title="Users" icon="users" description="Everyone who can sign in: students, instructors and staff. Roles decide what each person can do."
                actions={manage ? <Button icon="user-add" onClick={() => setEditing('new')}>Add user</Button> : null} />

            <MiniStats items={[
                { label: 'Total accounts', value: counts.total, icon: 'users' },
                { label: 'Active', value: counts.active, icon: 'badge-check', tone: 'bg-success-soft text-success' },
                { label: 'Deactivated', value: counts.inactive, icon: 'user-lock', tone: 'bg-danger-soft text-danger' },
                { label: 'Signed in this week', value: counts.recent, icon: 'time-past', tone: 'bg-info-soft text-info' },
            ]} />

            <Toolbar>
                <SearchInput value={f.values.q} onChange={(v) => f.set('q', v)} placeholder="Search name, email or ID" />
                <FilterSelect value={f.values.role} onChange={(v) => f.set('role', v)} placeholder="All roles" options={roles.map((r) => ({ value: r.name, label: r.label }))} />
                <FilterSelect value={f.values.status} onChange={(v) => f.set('status', v)} placeholder="Any status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Deactivated' }]} />
                {f.active ? <Button variant="ghost" size="sm" icon="cross-small" onClick={f.clear}>Clear</Button> : null}
            </Toolbar>

            <Table head={['User', { label: 'Roles', className: 'hidden sm:table-cell' }, { label: 'Section', className: 'hidden md:table-cell' }, { label: 'Status', className: 'hidden sm:table-cell' }, { label: 'Last sign-in', className: 'hidden lg:table-cell' }, '']}
                empty={!users.data.length ? <EmptyState icon="users" title="No users match" description="Try a different search or clear the filters." /> : null}>
                {users.data.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-surface-2/50">
                        <Td>
                            <div className="flex items-center gap-3">
                                <Avatar src={u.avatar} name={u.full_name} initials={u.initials} size={38} />
                                <div className="min-w-0">
                                    <button type="button" disabled={!manage} onClick={() => setEditing(u)} className="block truncate text-left font-semibold text-text hover:text-primary disabled:hover:text-text">{u.full_name || '—'}</button>
                                    <p className="truncate text-xs text-muted">{u.email}<span className="hidden sm:inline">{u.id_number ? ` · ${u.id_number}` : ''}</span></p>
                                    <div className="mt-1 flex flex-wrap gap-1 sm:hidden">{u.roles.map((r) => <Badge key={r.name} tone={ROLE_TONE[r.name] ?? 'neutral'}>{r.label}</Badge>)}{u.is_active ? null : <Badge tone="danger" dot>Deactivated</Badge>}</div>
                                </div>
                            </div>
                        </Td>
                        <Td className="hidden sm:table-cell"><div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r.name} tone={ROLE_TONE[r.name] ?? 'neutral'}>{r.label}</Badge>)}</div></Td>
                        <Td className="hidden md:table-cell">{u.section || '—'}</Td>
                        <Td className="hidden sm:table-cell">{u.is_active ? <Badge tone="success" dot>Active</Badge> : <Badge tone="danger" dot>Deactivated</Badge>}</Td>
                        <Td className="hidden whitespace-nowrap text-xs lg:table-cell">{timeAgo(u.last_login_at)}</Td>
                        <Td className="text-right">
                            {manage ? (
                                <DropdownMenu>
                                    <DropdownTrigger asChild><IconButton icon="menu-dots-vertical" label={`Actions for ${u.email}`} size="sm" /></DropdownTrigger>
                                    <DropdownContent>
                                        <DropdownItem icon="pencil" onSelect={() => setEditing(u)}>Edit</DropdownItem>
                                        {u.id !== me?.id ? <DropdownItem icon={u.is_active ? 'user-lock' : 'badge-check'} onSelect={() => toggle(u)}>{u.is_active ? 'Deactivate' : 'Reactivate'}</DropdownItem> : null}
                                        {u.id !== me?.id ? <><DropdownSeparator /><DropdownItem icon="trash" danger onSelect={() => remove(u)}>Delete</DropdownItem></> : null}
                                    </DropdownContent>
                                </DropdownMenu>
                            ) : null}
                        </Td>
                    </tr>
                ))}
            </Table>
            <Pagination page={users} noun="users" />

            <Modal open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} size="lg" icon={editing === 'new' ? 'user-add' : 'user-gear'}
                title={editing === 'new' ? 'Add user' : 'Edit user'} description={editing === 'new' ? 'Create an account and choose what this person can do.' : typeof editing === 'object' && editing ? editing.email : undefined}>
                {editing !== null ? <UserForm key={editing === 'new' ? 'new' : editing.id} user={editing === 'new' ? null : editing} roles={roles} onDone={() => setEditing(null)} /> : null}
            </Modal>
        </>
    );
}
