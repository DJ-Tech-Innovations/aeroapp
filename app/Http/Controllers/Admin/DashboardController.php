<?php

namespace App\Http\Controllers\Admin;

use App\Domain\PackService;
use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Attempt;
use App\Models\ContentPack;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Models\Tool;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        $latest = PackService::latestPublished();
        $payload = PackService::buildPayload();
        $draft = PackService::namedChangelog($latest['payload'] ?? null, $payload);

        $days = collect(range(13, 0))->map(fn ($d) => now()->subDays($d)->toDateString());
        $perDay = Attempt::whereNotNull('submitted_at')->where('submitted_at', '>=', now()->subDays(13)->startOfDay())
            ->selectRaw('DATE(submitted_at) as d, COUNT(*) as n, SUM(passed) as p')->groupBy('d')->get()->keyBy('d');

        return Inertia::render('admin/dashboard', [
            'stats' => [
                'tools' => Tool::count(),
                'toolsDraft' => Tool::where('is_published', false)->count(),
                'quizzes' => Quiz::count(),
                'packs' => ContentPack::count(),
                'users' => User::count(),
                'activeUsers' => User::where('last_login_at', '>=', now()->subDays(30))->count(),
                'classes' => SchoolClass::count(),
                'attempts' => Attempt::whereNotNull('submitted_at')->count(),
                'passRate' => (int) round((Attempt::whereNotNull('submitted_at')->avg('passed') ?? 0) * 100),
            ],
            'roles' => Role::withCount('users')->orderBy('id')->get(['id', 'name', 'label'])
                ->map(fn ($r) => ['name' => $r->name, 'label' => $r->label ?: $r->name, 'count' => $r->users_count]),
            'latestPack' => $latest ? [
                'version' => $latest['row']->version, 'releasedAt' => $latest['row']->released_at->toIso8601String(),
                'tools' => $latest['row']->tool_count, 'quizzes' => $latest['row']->quiz_count,
            ] : null,
            'draft' => $draft,
            'changes' => PackService::changeCount($draft),
            'problems' => array_slice(PackService::validate($payload), 0, 6),
            'activityChart' => $days->map(fn ($d) => ['day' => $d, 'attempts' => (int) ($perDay[$d]->n ?? 0), 'passed' => (int) ($perDay[$d]->p ?? 0)])->values(),
            'recent' => Activity::with('user:id,full_name,email')->latest('id')->limit(8)->get()->map(fn (Activity $a) => [
                'id' => $a->id, 'action' => $a->action, 'subject' => $a->subject, 'at' => $a->created_at?->toIso8601String(),
                'user' => $a->user?->full_name ?: $a->user?->email ?: 'System',
            ]),
            'topMissed' => DB::table('attempts')->whereNotNull('submitted_at')->selectRaw('quiz_title, COUNT(*) as n, AVG(score / NULLIF(max_score,0)) * 100 as avg')
                ->groupBy('quiz_title')->orderBy('avg')->limit(5)->get()->map(fn ($r) => ['quiz' => $r->quiz_title, 'attempts' => (int) $r->n, 'average' => (int) round($r->avg ?? 0)]),
        ]);
    }
}
