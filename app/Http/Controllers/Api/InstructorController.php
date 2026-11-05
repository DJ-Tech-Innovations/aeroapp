<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attempt;
use App\Models\SchoolClass;
use App\Models\Spotlight;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Everything here is scoped to the classes the signed-in instructor teaches. */
class InstructorController extends Controller
{
    public function classes(Request $request): JsonResponse
    {
        $classes = $request->user()->taughtClasses()->withCount('students')->orderBy('name')->get();

        return response()->json(['classes' => $classes->map(fn (SchoolClass $c) => ['id' => $c->id, 'name' => $c->name, 'students' => $c->students_count])]);
    }

    /** Roster of every class the instructor teaches. */
    public function roster(Request $request): JsonResponse
    {
        $rows = [];
        $classes = $request->user()->taughtClasses()->with('students')->orderBy('name')->get();
        foreach ($classes as $c) {
            foreach ($c->students as $s) {
                $rows[] = [
                    'id' => $s->id, 'fullName' => $s->full_name, 'email' => $s->email, 'idNumber' => $s->id_number, 'section' => $s->section,
                    'avatarUrl' => $s->avatarUrl(), 'classId' => $c->id, 'className' => $c->name,
                ];
            }
        }
        usort($rows, fn ($a, $b) => strcasecmp($a['fullName'], $b['fullName']));

        return response()->json(['roster' => $rows]);
    }

    public function attempts(Request $request): JsonResponse
    {
        $request->validate(['quizId' => ['nullable', 'string'], 'userId' => ['nullable', 'uuid']]);
        $studentIds = User::whereHas('classes', fn ($q) => $q->where('instructor_id', $request->user()->id))->pluck('id');

        $q = Attempt::whereIn('user_id', $studentIds)->whereNotNull('submitted_at')->latest('submitted_at')->limit(2000);
        if ($request->filled('quizId')) {
            $q->where('quiz_id', $request->string('quizId'));
        }
        if ($request->filled('userId')) {
            $q->where('user_id', $request->string('userId'));
        }

        return response()->json(['attempts' => $q->get()->map(fn (Attempt $a) => [...$a->toSummary(), 'answers' => (object) $a->answers])]);
    }

    public function spotlight(Request $request): JsonResponse
    {
        $data = $request->validate(['toolId' => ['required', 'string', 'max:64'], 'note' => ['nullable', 'string', 'max:200']]);
        $user = $request->user();
        $classes = $user->taughtClasses()->pluck('id');
        abort_if($classes->isEmpty(), 422, 'You have no classes yet — ask an admin to create one.');
        foreach ($classes as $id) {
            Spotlight::create(['class_id' => $id, 'tool_id' => $data['toolId'], 'note' => $data['note'] ?? '', 'instructor_name' => $user->full_name, 'created_by' => $user->id]);
        }

        return response()->json(['ok' => true, 'classes' => $classes->count()]);
    }

    public function clearSpotlight(Request $request): JsonResponse
    {
        Spotlight::whereIn('class_id', $request->user()->taughtClasses()->pluck('id'))->delete();

        return response()->json(['ok' => true]);
    }
}
