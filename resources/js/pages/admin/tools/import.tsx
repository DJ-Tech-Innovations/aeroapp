import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Table, Td } from '@/components/admin/kit';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, cn, Icon, useConfirm } from '@/components/ui';
import { http, HttpError } from '@/lib/http';
import { PageHeader } from '@/layouts/admin-layout';

interface Row { row: number; name: string; slug: string; action: 'create' | 'update'; errors: string[]; notes: string[] }
interface Report { rows: Row[]; problems: string[] }

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <Card padded={false}>
            <div className="flex items-start gap-4 p-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{n}</span>
                <div className="min-w-0 flex-1"><h3 className="font-semibold text-text">{title}</h3><div className="mt-2 text-sm text-muted">{children}</div></div>
            </div>
        </Card>
    );
}

export default function ToolImport({ total, maxRows, maxMb }: { total: number; maxRows: number; maxMb: number }) {
    const confirm = useConfirm();
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState<'check' | 'run' | null>(null);
    const [report, setReport] = useState<Report | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [onlyProblems, setOnlyProblems] = useState(false);

    const body = () => { const fd = new FormData(); fd.append('file', file!); return fd; };
    const bad = report ? report.problems.length + report.rows.filter((r) => r.errors.length).length : 0;
    const creates = report?.rows.filter((r) => r.action === 'create').length ?? 0;
    const updates = (report?.rows.length ?? 0) - creates;
    const shown = (report?.rows ?? []).filter((r) => !onlyProblems || r.errors.length);

    const check = async () => {
        setBusy('check'); setError(null); setReport(null);
        try { setReport(await http<Report>('/admin/tools/import/check', { method: 'POST', body: body() })); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
    };
    const run = async () => {
        if (!(await confirm({ title: `Import ${report!.rows.length} tool(s)?`, message: `${creates} new and ${updates} updated. Nothing is saved unless every row is valid.`, confirmLabel: 'Import', tone: 'primary', icon: 'file-excel' }))) return;
        setBusy('run'); setError(null);
        try {
            const r = await http<{ created: number; updated: number }>('/admin/tools/import/run', { method: 'POST', body: body() });
            setReport(null); setFile(null);
            toast.success(`Imported: ${r.created} new, ${r.updated} updated`, { description: 'Publish a new content pack to deliver them to learners.' });
            router.reload();
        } catch (e) {
            const b = e instanceof HttpError ? (e.body as Partial<Report> | null) : null;
            if (b?.rows) setReport({ rows: b.rows, problems: b.problems ?? [] });
            setError((e as Error).message);
        } finally { setBusy(null); }
    };

    return (
        <>
            <Head title="Import / Export tools" />
            <PageHeader back="/admin/tools" title="Import / Export" description="Edit many tools at once in Excel. Nothing is saved until every row is valid — the import is all or nothing." />
            <div className="grid gap-4 lg:grid-cols-2">
                <Step n={1} title="Download the template or an export">
                    <p>The workbook has dropdowns, notes on every column, and an Instructions sheet. An export of the current catalogue can be edited and imported back.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <a href="/admin/tools/import/template" className="inline-flex"><Button variant="secondary" icon="file-download">Empty template</Button></a>
                        <a href="/admin/tools/import/export" className="inline-flex"><Button variant="secondary" icon="file-excel">Export all {total} tools</Button></a>
                    </div>
                </Step>
                <Step n={2} title="Fill it in">
                    <ul className="list-disc space-y-1 pl-4">
                        <li>One row per tool on <b>Tools</b>; parts and references on their own sheets, linked by slug.</li>
                        <li>A row with an ID (or existing slug) updates that tool. Tools left out are never deleted.</li>
                        <li>At most {maxRows} tools and {maxMb} MB per file.</li>
                    </ul>
                </Step>
            </div>

            <Card padded={false} className="mt-4">
                <CardHeader icon="upload" title="3. Upload, check and import" description="Check file only reads the workbook. Import saves it." />
                <div className="space-y-4 p-5">
                    <label className={cn('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition', file ? 'border-primary bg-primary-soft/50' : 'border-border-strong hover:border-primary')}>
                        <Icon name="file-excel" className="text-3xl text-success" />
                        <span className="font-semibold text-text">{file ? file.name : 'Choose an .xlsx file'}</span>
                        <span className="text-xs text-muted">{file ? `${(file.size / 1024).toFixed(0)} KB · click to change` : 'Excel Workbook (.xlsx)'}</span>
                        <input type="file" hidden accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); setError(null); }} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" icon="list-check" disabled={!file || !!busy} loading={busy === 'check'} onClick={check}>Check file</Button>
                        {report ? <Button icon="upload" disabled={bad > 0 || !!busy} loading={busy === 'run'} onClick={run}>Import {report.rows.length} tool{report.rows.length === 1 ? '' : 's'}</Button> : null}
                    </div>
                    {error ? <Alert tone="danger">{error}</Alert> : null}
                    {report ? (
                        <>
                            {bad ? <Alert tone="danger" title={`${bad} problem${bad === 1 ? '' : 's'} found`}>Fix {bad === 1 ? 'it' : 'them'} in Excel, save, and check the file again.</Alert>
                                : <Alert tone="success" title="Ready to import">All {report.rows.length} rows are valid: {creates} new, {updates} to update.</Alert>}
                            {report.problems.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-danger">{report.problems.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
                            {report.rows.some((r) => r.errors.length) ? <Checkbox checked={onlyProblems} onChange={setOnlyProblems} label="Show only rows with problems" /> : null}
                        </>
                    ) : null}
                </div>
            </Card>
            {report?.rows.length ? (
                <Table className="mt-4" head={['Row', 'Tool', 'Action', 'Result']}>
                    {shown.map((r) => (
                        <tr key={r.row} className="align-top">
                            <Td className="font-mono text-xs">{r.row}</Td>
                            <Td><p className="font-semibold text-text">{r.name}</p><p className="font-mono text-xs text-muted">{r.slug}</p></Td>
                            <Td>{r.action === 'create' ? <Badge tone="success">New</Badge> : <Badge tone="info">Update</Badge>}</Td>
                            <Td>
                                {r.errors.length ? <ul className="list-disc space-y-0.5 pl-4 text-danger">{r.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : <span className="flex items-center gap-1 font-medium text-success"><Icon name="check" />OK</span>}
                                {r.notes.length ? <p className="mt-1 text-xs text-muted">{r.notes.join(' · ')}</p> : null}
                            </Td>
                        </tr>
                    ))}
                </Table>
            ) : null}
        </>
    );
}
