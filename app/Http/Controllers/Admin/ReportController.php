<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Attempt;
use App\Models\SchoolClass;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function results(Request $request): Response
    {
        $f = [
            'q' => trim((string) $request->query('q', '')), 'quiz' => (string) $request->query('quiz', ''),
            'class' => (string) $request->query('class', ''), 'result' => (string) $request->query('result', ''),
        ];
        $base = Attempt::query()->whereNotNull('submitted_at')
            ->when($f['q'], fn ($w) => $w->whereHas('user', fn ($u) => $u->where('full_name', 'like', "%{$f['q']}%")->orWhere('email', 'like', "%{$f['q']}%")))
            ->when($f['quiz'], fn ($w) => $w->where('quiz_id', $f['quiz']))
            ->when($f['class'], fn ($w) => $w->whereHas('user.classes', fn ($c) => $c->where('classes.id', $f['class'])))
            ->when($f['result'] === 'passed', fn ($w) => $w->where('passed', true))
            ->when($f['result'] === 'failed', fn ($w) => $w->where('passed', false));

        $summary = (clone $base)->selectRaw('COUNT(*) as n, AVG(passed) as p, AVG(score / NULLIF(max_score,0)) as a, COUNT(DISTINCT user_id) as u')->first();

        return Inertia::render('admin/results', [
            'attempts' => (clone $base)->with('user:id,full_name,email,id_number')->latest('submitted_at')->paginate(20)->withQueryString()
                ->through(fn (Attempt $a) => [
                    ...$a->toSummary(), 'student' => $a->user?->full_name ?: $a->user?->email, 'idNumber' => $a->user?->id_number,
                ]),
            'summary' => ['attempts' => (int) $summary->n, 'passRate' => (int) round(($summary->p ?? 0) * 100), 'average' => (int) round(($summary->a ?? 0) * 100), 'students' => (int) $summary->u],
            'filters' => $f,
            'quizzes' => Attempt::select('quiz_id', 'quiz_title')->distinct()->orderBy('quiz_title')->get()->map(fn ($r) => ['id' => $r->quiz_id, 'label' => $r->quiz_title]),
            'classes' => SchoolClass::orderBy('name')->get(['id', 'name'])->map(fn ($c) => ['id' => $c->id, 'label' => $c->name]),
        ]);
    }

    public function audit(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $type = (string) $request->query('type', '');

        return Inertia::render('admin/audit', [
            'entries' => Activity::with('user:id,full_name,email')
                ->when($q, fn ($w) => $w->where(fn ($w) => $w->where('subject', 'like', "%{$q}%")->orWhereHas('user', fn ($u) => $u->where('full_name', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%"))))
                ->when($type, fn ($w) => $w->where('action', 'like', "{$type}.%"))
                ->latest('id')->paginate(25)->withQueryString()
                ->through(fn (Activity $a) => [
                    'id' => $a->id, 'action' => $a->action, 'subject' => $a->subject, 'meta' => $a->meta, 'at' => $a->created_at?->toIso8601String(),
                    'user' => $a->user?->full_name ?: $a->user?->email ?: 'System',
                ]),
            'filters' => ['q' => $q, 'type' => $type],
            'types' => Activity::selectRaw("SUBSTRING_INDEX(action, '.', 1) as t")->distinct()->orderBy('t')->pluck('t'),
        ]);
    }
}
