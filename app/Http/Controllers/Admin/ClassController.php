<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Attempt;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ClassController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $classes = SchoolClass::with('instructor:id,full_name,email')->withCount('students')
            ->when($q, fn ($w) => $w->where('name', 'like', "%{$q}%"))
            ->orderBy('name')->paginate(12)->withQueryString()
            ->through(fn (SchoolClass $c) => [
                'id' => $c->id, 'name' => $c->name, 'students' => $c->students_count,
                'instructor' => $c->instructor ? ['id' => $c->instructor->id, 'name' => $c->instructor->full_name ?: $c->instructor->email] : null,
                'created_at' => $c->created_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/classes/index', [
            'classes' => $classes,
            'filters' => ['q' => $q],
            'instructors' => $this->instructors(),
        ]);
    }

    public function show(SchoolClass $class): Response
    {
        $class->load(['instructor:id,full_name,email', 'students' => fn ($q) => $q->orderBy('full_name')]);
        $memberIds = $class->students->pluck('id');
        $stats = Attempt::whereIn('user_id', $memberIds)->whereNotNull('submitted_at')
            ->selectRaw('user_id, COUNT(*) as n, AVG(score / NULLIF(max_score,0)) as a')->groupBy('user_id')->get()->keyBy('user_id');

        return Inertia::render('admin/classes/show', [
            'klass' => [
                'id' => $class->id, 'name' => $class->name, 'instructor_id' => $class->instructor_id,
                'instructor' => $class->instructor?->full_name ?: $class->instructor?->email,
                'students' => $class->students->map(fn (User $s) => [
                    'id' => $s->id, 'full_name' => $s->full_name, 'email' => $s->email, 'id_number' => $s->id_number, 'initials' => $s->initials(),
                    'avatar' => $s->avatarUrl(), 'is_active' => $s->is_active,
                    'attempts' => (int) ($stats[$s->id]->n ?? 0),
                    'average' => isset($stats[$s->id]) ? (int) round($stats[$s->id]->a * 100) : null,
                ]),
            ],
            'instructors' => $this->instructors(),
            'candidates' => User::role('student')->whereNotIn('id', $memberIds)->orderBy('full_name')->limit(500)
                ->get(['id', 'full_name', 'email', 'id_number'])->map(fn ($u) => ['id' => $u->id, 'label' => ($u->full_name ?: $u->email).($u->id_number ? " · {$u->id_number}" : '')]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $class = SchoolClass::create($data);
        Activity::record('class.created', $class->name);

        return redirect()->route('admin.classes.show', $class)->with('success', "Class {$class->name} created. Add its students.");
    }

    public function update(Request $request, SchoolClass $class): RedirectResponse
    {
        $class->update($this->validated($request, $class));
        Activity::record('class.updated', $class->name);

        return back()->with('success', 'Class saved.');
    }

    public function destroy(SchoolClass $class): RedirectResponse
    {
        $name = $class->name;
        $class->delete();
        Activity::record('class.deleted', $name);

        return redirect()->route('admin.classes.index')->with('success', "Class {$name} deleted. Students' accounts were kept.");
    }

    public function addMembers(Request $request, SchoolClass $class): RedirectResponse
    {
        $data = $request->validate(['students' => ['required', 'array', 'min:1'], 'students.*' => ['uuid', Rule::exists('users', 'id')]]);
        $class->students()->syncWithoutDetaching($data['students']);
        Activity::record('class.members_added', $class->name, ['count' => count($data['students'])]);

        return back()->with('success', count($data['students']).' student(s) added.');
    }

    public function removeMember(SchoolClass $class, User $user): RedirectResponse
    {
        $class->students()->detach($user->id);

        return back()->with('success', "{$user->full_name} removed from {$class->name}.");
    }

    private function validated(Request $request, ?SchoolClass $class = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('classes', 'name')->ignore($class?->id)],
            'instructor_id' => ['required', 'uuid', Rule::exists('users', 'id')],
        ]);
    }

    private function instructors(): array
    {
        return User::permission('app.instruct')->orderBy('full_name')->get(['id', 'full_name', 'email'])
            ->map(fn ($u) => ['id' => $u->id, 'label' => $u->full_name ?: $u->email])->all();
    }
}
