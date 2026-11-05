<?php

namespace App\Http\Controllers\Admin;

use App\Domain\QuizBuilder;
use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Attempt;
use App\Models\Quiz;
use App\Models\Tool;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class QuizController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $mode = (string) $request->query('mode', '');
        $stats = Attempt::whereNotNull('submitted_at')->selectRaw('quiz_id, COUNT(*) as n, AVG(passed) as p')->groupBy('quiz_id')->get()->keyBy('quiz_id');

        $quizzes = Quiz::query()
            ->when($q, fn ($w) => $w->where('title', 'like', "%{$q}%"))
            ->when($mode, fn ($w) => $w->where('mode', $mode))
            ->orderBy('sort_order')->orderBy('title')
            ->paginate(20)->withQueryString()
            ->through(fn (Quiz $x) => [
                'id' => $x->id, 'title' => $x->title, 'mode' => $x->mode, 'is_published' => $x->is_published,
                'questions' => count($x->data['questions'] ?? []), 'drawCount' => $x->data['drawCount'] ?? null,
                'timeLimitSec' => $x->data['timeLimitSec'] ?? null, 'passingPercent' => $x->data['passingPercent'] ?? null,
                'maxAttempts' => $x->data['maxAttempts'] ?? null,
                'attempts' => (int) ($stats[$x->id]->n ?? 0), 'passRate' => isset($stats[$x->id]) ? (int) round($stats[$x->id]->p * 100) : null,
                'updated_at' => $x->updated_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/quizzes/index', ['quizzes' => $quizzes, 'filters' => ['q' => $q, 'mode' => $mode]]);
    }

    public function create(): Response
    {
        return $this->editor(null);
    }

    public function edit(Quiz $quiz): Response
    {
        return $this->editor($quiz);
    }

    public function store(Request $request): RedirectResponse
    {
        $quiz = QuizBuilder::persist(QuizBuilder::validate([...$request->all(), 'id' => null]));
        Activity::record('quiz.created', $quiz->title);

        return redirect()->route('admin.quizzes.edit', $quiz)->with('success', 'Quiz created. Publish a new content pack to deliver it to learners.');
    }

    public function update(Request $request, Quiz $quiz): RedirectResponse
    {
        QuizBuilder::persist(QuizBuilder::validate([...$request->all(), 'id' => $quiz->id]));
        Activity::record('quiz.updated', $quiz->title);

        return back()->with('success', 'Saved. Publish a new content pack to deliver this change to learners.');
    }

    public function destroy(Quiz $quiz): RedirectResponse
    {
        $title = $quiz->title;
        $quiz->delete();
        Activity::record('quiz.deleted', $title);

        return redirect()->route('admin.quizzes.index')->with('success', "“{$title}” deleted. Learners keep their attempt history.");
    }

    private function editor(?Quiz $quiz): Response
    {
        return Inertia::render('admin/quizzes/edit', [
            'quiz' => $quiz?->data,
            'published' => $quiz?->is_published ?? true,
            'tools' => Tool::orderBy('name')->get(['id', 'name', 'data'])->map(fn (Tool $t) => [
                'id' => $t->id, 'name' => $t->name,
                'hotspots' => collect($t->data['model3d']['hotspots'] ?? [])->map(fn ($h) => ['id' => $h['id'], 'label' => $h['label']])->values(),
            ]),
        ]);
    }
}
