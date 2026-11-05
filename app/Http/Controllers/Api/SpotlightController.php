<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Spotlight;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SpotlightController extends Controller
{
    /** Latest "tool of the day" for the learner's classes (or the instructor's own classes). */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $classIds = $user->isInstructor() ? $user->taughtClasses()->pluck('id') : $user->classes()->pluck('classes.id');
        $s = Spotlight::whereIn('class_id', $classIds)->latest()->first();

        return response()->json(['spotlight' => $s ? [
            'classId' => $s->class_id, 'toolId' => $s->tool_id, 'note' => $s->note, 'instructorName' => $s->instructor_name, 'createdAt' => $s->created_at->toIso8601String(),
        ] : null]);
    }
}
