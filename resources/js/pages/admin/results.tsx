import { Head } from '@inertiajs/react';
import { FilterSelect, MiniStats, Pagination, SearchInput, Table, Td, Toolbar, useFilters } from '@/components/admin/kit';
import { Badge, Button, cn, EmptyState, fmtDateTime } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';
import type { Paginated } from '@/types';

interface Row { id: string; student: string; idNumber: string; quizTitle: string; quizMode: string; percent: number; passed: boolean; score: number; maxScore: number; submittedAt: string; packVersion: string }
interface Props {
    attempts: Paginated<Row>; summary: { attempts: number; passRate: number; average: number; students: number };
    filters: { q: string; quiz: string; class: string; result: string }; quizzes: { id: string; label: string }[]; classes: { id: string; label: string }[];
}

export default function Results({ attempts, summary, filters, quizzes, classes }: Props) {
    const f = useFilters(filters);
    return (
        <>
            <Head title="Results" />
            <PageHeader title="Results" icon="chart-histogram" description="Every quiz and exam attempt that learners have synced, re-scored on the server against the pack they used." />
            <MiniStats items={[
                { label: 'Attempts', value: summary.attempts, icon: 'list-check' },
                { label: 'Pass rate', value: `${summary.passRate}%`, icon: 'trophy', tone: 'bg-success-soft text-success' },
                { label: 'Average score', value: `${summary.average}%`, icon: 'chart-histogram', tone: 'bg-info-soft text-info' },
                { label: 'Students', value: summary.students, icon: 'users', tone: 'bg-surface-2 text-muted' },
            ]} />
            <Toolbar>
                <SearchInput value={f.values.q} onChange={(v) => f.set('q', v)} placeholder="Search student" />
                <FilterSelect value={f.values.quiz} onChange={(v) => f.set('quiz', v)} placeholder="All quizzes" options={quizzes.map((q) => ({ value: q.id, label: q.label }))} />
                <FilterSelect value={f.values.class} onChange={(v) => f.set('class', v)} placeholder="All classes" options={classes.map((c) => ({ value: c.id, label: c.label }))} />
                <FilterSelect value={f.values.result} onChange={(v) => f.set('result', v)} placeholder="Any result" options={[{ value: 'passed', label: 'Passed' }, { value: 'failed', label: 'Not passed' }]} />
                {f.active ? <Button variant="ghost" size="sm" icon="cross-small" onClick={f.clear}>Clear</Button> : null}
            </Toolbar>
            <Table head={['Student', 'Quiz', 'Score', 'Result', { label: 'Pack', className: 'hidden md:table-cell' }, { label: 'Submitted', className: 'hidden lg:table-cell' }]}
                empty={!attempts.data.length ? <EmptyState icon="chart-histogram" title="No attempts found" description="Results appear once learners take quizzes and their devices sync." /> : null}>
                {attempts.data.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-2/50">
                        <Td><p className="font-semibold text-text">{a.student}</p><p className="text-xs text-muted">{a.idNumber}</p></Td>
                        <Td><p className="text-text">{a.quizTitle}</p>{a.quizMode === 'exam' ? <Badge tone="danger" className="mt-1">Exam</Badge> : null}</Td>
                        <Td>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3"><div className={cn('h-full rounded-full', a.passed ? 'bg-success' : 'bg-danger')} style={{ width: `${a.percent}%` }} /></div>
                                <span className="font-semibold tabular-nums text-text">{Math.round(a.percent)}%</span>
                            </div>
                            <p className="text-xs text-muted">{a.score}/{a.maxScore} pts</p>
                        </Td>
                        <Td>{a.passed ? <Badge tone="success" icon="check">Passed</Badge> : <Badge tone="danger" icon="cross-small">Not passed</Badge>}</Td>
                        <Td className="hidden font-mono text-xs md:table-cell">v{a.packVersion}</Td>
                        <Td className="hidden whitespace-nowrap text-xs lg:table-cell">{fmtDateTime(a.submittedAt)}</Td>
                    </tr>
                ))}
            </Table>
            <Pagination page={attempts} noun="attempts" />
        </>
    );
}
