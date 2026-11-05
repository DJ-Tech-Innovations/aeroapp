import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Table, Td } from '@/components/admin/kit';
import { Avatar, Badge, Button, Checkbox, cn, EmptyState, IconButton, Input, Modal, StatCard, useConfirm } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';
import { can, type SharedProps } from '@/types';
import { ClassForm } from './index';

interface Student { id: string; full_name: string; email: string; id_number: string; initials: string; avatar: string | null; is_active: boolean; attempts: number; average: number | null }
interface Props {
    klass: { id: string; name: string; instructor_id: string; instructor: string | null; students: Student[] };
    instructors: { id: string; label: string }[];
    candidates: { id: string; label: string }[];
}

function AddStudents({ klassId, candidates, onDone }: { klassId: string; candidates: Props['candidates']; onDone: () => void }) {
    const [q, setQ] = useState('');
    const form = useForm<{ students: string[] }>({ students: [] });
    const list = useMemo(() => candidates.filter((c) => c.label.toLowerCase().includes(q.trim().toLowerCase())), [candidates, q]);
    const toggle = (id: string) => form.setData('students', form.data.students.includes(id) ? form.data.students.filter((x) => x !== id) : [...form.data.students, id]);
    return (
        <div className="space-y-3">
            <Input icon="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students…" />
            <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {list.length ? list.map((c) => (
                    <div key={c.id} className={cn('px-3 py-2.5', form.data.students.includes(c.id) && 'bg-primary-soft/60')}>
                        <Checkbox checked={form.data.students.includes(c.id)} onChange={() => toggle(c.id)} label={c.label} />
                    </div>
                )) : <p className="p-6 text-center text-sm text-muted">{candidates.length ? 'No students match.' : 'Every student is already in this class.'}</p>}
            </div>
            <div className="flex items-center justify-between gap-2 pt-2">
                <span className="text-sm text-muted">{form.data.students.length} selected</span>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={onDone}>Cancel</Button>
                    <Button disabled={!form.data.students.length} loading={form.processing} onClick={() => form.post(`/admin/classes/${klassId}/members`, { preserveScroll: true, onSuccess: onDone })}>Add to class</Button>
                </div>
            </div>
        </div>
    );
}

export default function ClassShow({ klass, instructors, candidates }: Props) {
    const { props } = usePage<SharedProps>();
    const manage = can(props.auth.user, 'classes.manage');
    const confirm = useConfirm();
    const [modal, setModal] = useState<'edit' | 'add' | null>(null);
    const withScores = klass.students.filter((s) => s.average != null);
    const avg = withScores.length ? Math.round(withScores.reduce((a, s) => a + (s.average ?? 0), 0) / withScores.length) : null;

    const removeClass = async () => {
        if (await confirm({ title: `Delete ${klass.name}?`, message: "Students' accounts and their attempts are kept; only the class and its memberships are removed.", confirmLabel: 'Delete class' })) router.delete(`/admin/classes/${klass.id}`);
    };
    const removeStudent = async (s: Student) => {
        if (await confirm({ title: `Remove ${s.full_name} from ${klass.name}?`, message: 'Their account and attempts are kept.', confirmLabel: 'Remove', tone: 'primary' })) router.delete(`/admin/classes/${klass.id}/members/${s.id}`, { preserveScroll: true });
    };

    return (
        <>
            <Head title={klass.name} />
            <PageHeader back="/admin/classes" title={klass.name} description={`Instructor: ${klass.instructor ?? '—'}`}
                actions={manage ? <>
                    <Button variant="ghost" icon="trash" className="text-danger" onClick={removeClass}>Delete</Button>
                    <Button variant="secondary" icon="pencil" onClick={() => setModal('edit')}>Edit</Button>
                    <Button icon="user-add" onClick={() => setModal('add')}>Add students</Button>
                </> : null} />
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
                <StatCard label="Students" value={klass.students.length} icon="users" />
                <StatCard label="Class average" value={avg != null ? `${avg}%` : '—'} icon="chart-histogram" tone="success" />
                <StatCard label="Attempts" value={klass.students.reduce((a, s) => a + s.attempts, 0)} icon="list-check" tone="info" className="col-span-2 lg:col-span-1" />
            </div>
            <Table head={['Student', 'ID number', 'Attempts', 'Average', '']}
                empty={!klass.students.length ? <EmptyState icon="users" title="No students yet" description="Add students to this class so the instructor can follow their progress." action={manage ? <Button icon="user-add" onClick={() => setModal('add')}>Add students</Button> : null} /> : null}>
                {klass.students.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-2/50">
                        <Td><div className="flex items-center gap-3"><Avatar src={s.avatar} name={s.full_name} initials={s.initials} size={34} /><div className="min-w-0"><p className="truncate font-semibold text-text">{s.full_name}{!s.is_active ? <Badge tone="danger" className="ml-2">Inactive</Badge> : null}</p><p className="truncate text-xs text-muted">{s.email}</p></div></div></Td>
                        <Td className="font-mono text-xs">{s.id_number || '—'}</Td>
                        <Td className="tabular-nums">{s.attempts}</Td>
                        <Td>{s.average != null ? <Badge tone={s.average >= 75 ? 'success' : s.average >= 60 ? 'warning' : 'danger'}>{s.average}%</Badge> : <span className="text-xs text-muted">No attempts</span>}</Td>
                        <Td className="text-right">{manage ? <IconButton icon="user-minus" label={`Remove ${s.full_name}`} size="sm" onClick={() => removeStudent(s)} /> : null}</Td>
                    </tr>
                ))}
            </Table>
            <Modal open={modal === 'edit'} onOpenChange={(o) => !o && setModal(null)} title="Edit class" icon="school"><ClassForm klass={klass} instructors={instructors} onDone={() => setModal(null)} /></Modal>
            <Modal open={modal === 'add'} onOpenChange={(o) => !o && setModal(null)} title={`Add students to ${klass.name}`} icon="user-add"><AddStudents klassId={klass.id} candidates={candidates} onDone={() => setModal(null)} /></Modal>
        </>
    );
}
