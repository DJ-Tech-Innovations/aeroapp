import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Pagination, SearchInput, Toolbar, useFilters } from '@/components/admin/kit';
import { Avatar, Button, Card, EmptyState, Field, Icon, Input, Modal, Select, fmtDay } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';
import { can, type Paginated, type SharedProps } from '@/types';

interface Row { id: string; name: string; students: number; instructor: { id: string; name: string } | null; created_at: string }
interface Props { classes: Paginated<Row>; filters: { q: string }; instructors: { id: string; label: string }[] }

export function ClassForm({ klass, instructors, onDone }: { klass?: { id: string; name: string; instructor_id: string } | null; instructors: { id: string; label: string }[]; onDone: () => void }) {
    const form = useForm({ name: klass?.name ?? '', instructor_id: klass?.instructor_id ?? instructors[0]?.id ?? '' });
    const submit = () => (klass ? form.put(`/admin/classes/${klass.id}`, { preserveScroll: true, onSuccess: onDone }) : form.post('/admin/classes', { onSuccess: onDone }));
    return (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
            <Field label="Class name" required error={form.errors.name} hint="For example AMT-1A or Section B — Morning."><Input autoFocus value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} /></Field>
            <Field label="Instructor" required error={form.errors.instructor_id} hint={instructors.length ? 'Only users whose role can use the instructor app are listed.' : 'Create a user with the Instructor role first.'}>
                <Select value={form.data.instructor_id} onChange={(e) => form.setData('instructor_id', e.target.value)}>
                    {instructors.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                </Select>
            </Field>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="secondary" onClick={onDone}>Cancel</Button>
                <Button type="submit" loading={form.processing} disabled={!instructors.length}>{klass ? 'Save class' : 'Create class'}</Button>
            </div>
        </form>
    );
}

export default function Classes({ classes, filters, instructors }: Props) {
    const { props } = usePage<SharedProps>();
    const manage = can(props.auth.user, 'classes.manage');
    const f = useFilters(filters);
    const [open, setOpen] = useState(false);
    return (
        <>
            <Head title="Classes" />
            <PageHeader title="Classes" icon="school" description="Each class has one instructor. Instructors see results only for students in their classes."
                actions={manage ? <Button icon="add" onClick={() => setOpen(true)}>New class</Button> : null} />
            <Toolbar><SearchInput value={f.values.q} onChange={(v) => f.set('q', v)} placeholder="Search classes" /></Toolbar>
            {classes.data.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {classes.data.map((c) => (
                        <Link key={c.id} href={`/admin/classes/${c.id}`} className="group">
                            <Card interactive className="h-full">
                                <div className="flex items-start justify-between gap-3">
                                    <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 to-blue-600 text-xl text-white shadow-md shadow-blue-900/20"><Icon name="school" /></span>
                                    <Icon name="arrow-right" className="text-muted transition group-hover:translate-x-1 group-hover:text-primary" />
                                </div>
                                <h3 className="mt-4 text-lg font-bold text-text">{c.name}</h3>
                                <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                                    {c.instructor ? <><Avatar name={c.instructor.name} size={20} />{c.instructor.name}</> : 'No instructor'}
                                </div>
                                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                                    <span className="flex items-center gap-1.5 font-semibold text-text"><Icon name="users" className="text-muted" />{c.students} student{c.students === 1 ? '' : 's'}</span>
                                    <span className="text-xs text-muted">Since {fmtDay(c.created_at)}</span>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : <Card><EmptyState icon="school" title="No classes yet" description="Create a class, assign an instructor, then add students." action={manage ? <Button icon="add" onClick={() => setOpen(true)}>New class</Button> : null} /></Card>}
            <Pagination page={classes} noun="classes" />
            <Modal open={open} onOpenChange={setOpen} title="New class" icon="school"><ClassForm instructors={instructors} onDone={() => setOpen(false)} /></Modal>
        </>
    );
}
