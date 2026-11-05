<?php

namespace App\Domain;

use App\Models\Attempt;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Offline attempts arrive in batches from the learner app's outbox. Each one is idempotent by its device-generated id
 * and is re-scored here against the answer key of the pack version it was taken with, so the stored score can be trusted.
 */
final class AttemptService
{
    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array{id: string, status: 'stored'|'duplicate'|'rejected', reason?: string, score?: float|int, maxScore?: float|int, passed?: bool}>
     */
    public static function ingest(User $user, array $items): array
    {
        $out = [];
        foreach (array_slice($items, 0, 200) as $item) {
            $out[] = self::one($user, is_array($item) ? $item : []);
        }

        return $out;
    }

    private static function one(User $user, array $a): array
    {
        $id = (string) ($a['id'] ?? '');
        $reject = fn (string $reason) => ['id' => $id, 'status' => 'rejected', 'reason' => $reason];

        if (! Str::isUuid($id)) {
            return $reject('Invalid attempt id.');
        }
        if ($existing = Attempt::find($id)) {
            return $existing->user_id === $user->id
                ? ['id' => $id, 'status' => 'duplicate', 'score' => $existing->score, 'maxScore' => $existing->max_score, 'passed' => $existing->passed]
                : $reject('Attempt id already used.');
        }
        if (empty($a['submittedAt'])) {
            return $reject('Only submitted attempts can be synced.');
        }

        $payload = PackService::payload((string) ($a['packVersion'] ?? ''));
        if (! $payload) {
            return $reject('Unknown content pack version.');
        }
        $quiz = collect($payload['quizzes'])->firstWhere('id', $a['quizId'] ?? null);
        if (! $quiz) {
            return $reject('That quiz is not in the pack it was taken with.');
        }

        $order = array_values(array_filter((array) ($a['questionOrder'] ?? []), 'is_string'));
        $known = array_column($quiz['questions'], 'id');
        if (! $order || array_diff($order, $known) || count(array_unique($order)) !== count($order)) {
            return $reject('The attempt contains unknown questions.');
        }
        $choiceOrder = is_array($a['choiceOrder'] ?? null) ? $a['choiceOrder'] : [];
        $answers = [];
        foreach ($order as $qid) {
            $v = $a['answers'][$qid] ?? null;
            $answers[$qid] = is_string($v) ? $v : null;
        }

        if ($quiz['mode'] === 'exam' && $quiz['maxAttempts'] !== null) {
            $used = Attempt::where('user_id', $user->id)->where('quiz_id', $quiz['id'])->count();
            if ($used >= $quiz['maxAttempts']) {
                return $reject('No attempts left for this exam.');
            }
        }

        $questions = QuizEngine::restore($quiz, $order, $choiceOrder);
        $score = Scoring::score($questions, $answers, $quiz['passingPercent']);
        $clientScore = is_numeric($a['score'] ?? null) ? (float) $a['score'] : null;
        if ($clientScore !== null && abs($clientScore - $score['score']) > 0.001) {
            Log::warning('Attempt score mismatch', ['attempt' => $id, 'user' => $user->id, 'client' => $clientScore, 'server' => $score['score']]);
        }

        $date = fn ($v) => rescue(fn () => Carbon::parse($v), null, false);
        DB::transaction(fn () => Attempt::create([
            'id' => $id, 'user_id' => $user->id, 'quiz_id' => $quiz['id'], 'quiz_title' => $quiz['title'], 'quiz_mode' => $quiz['mode'],
            'pack_version' => $a['packVersion'], 'question_order' => $order, 'choice_order' => $choiceOrder ?: new \stdClass, 'answers' => $answers,
            'score' => $score['score'], 'max_score' => $score['maxScore'], 'passed' => $score['passed'], 'client_score' => $clientScore,
            'source' => 'web', 'started_at' => $date($a['startedAt'] ?? null) ?? now(), 'submitted_at' => $date($a['submittedAt']) ?? now(),
        ]));
        self::touchDay($user);

        return ['id' => $id, 'status' => 'stored', 'score' => $score['score'], 'maxScore' => $score['maxScore'], 'passed' => $score['passed']];
    }

    public static function touchDay(User $user): void
    {
        DB::table('activity_days')->insertOrIgnore(['user_id' => $user->id, 'day' => now()->toDateString()]);
    }
}
