<?php

namespace App\Http\Controllers\Api;

use App\Domain\AttemptService;
use App\Http\Controllers\Controller;
use App\Models\Attempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttemptController extends Controller
{
    /** The learner's own synced attempts (restores history on a new device). */
    public function index(Request $request): JsonResponse
    {
        $rows = Attempt::where('user_id', $request->user()->id)->latest('submitted_at')->limit(500)->get();

        return response()->json(['attempts' => $rows->map(fn (Attempt $a) => [
            ...$a->toSummary(), 'questionOrder' => $a->question_order, 'choiceOrder' => (object) $a->choice_order, 'answers' => (object) $a->answers,
        ])]);
    }

    /** Batch upload from the offline outbox. Idempotent by attempt id. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['attempts' => ['required', 'array', 'max:200']]);

        return response()->json(['results' => AttemptService::ingest($request->user(), $data['attempts'])]);
    }
}
