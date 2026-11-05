<?php

namespace App\Domain;

/** PHP port of packages/shared scoreAttempt — must return identical results (see scoring parity fixtures). */
final class Scoring
{
    /**
     * @param  array  $questions  the questions actually presented
     * @param  array<string,string|null>  $answers
     * @return array{score: float|int, maxScore: float|int, percent: float|int, passed: bool, correctIds: string[], wrongIds: string[], unansweredIds: string[]}
     */
    public static function score(array $questions, array $answers, float|int $passingPercent): array
    {
        $score = 0;
        $max = 0;
        $correct = $wrong = $unanswered = [];
        foreach ($questions as $q) {
            $max += $q['points'];
            $a = $answers[$q['id']] ?? null;
            if ($a === null) {
                $unanswered[] = $q['id'];
            } elseif ($a === $q['correctChoiceId']) {
                $score += $q['points'];
                $correct[] = $q['id'];
            } else {
                $wrong[] = $q['id'];
            }
        }
        // JS: Math.round((score / max) * 1000) / 10 — Math.round rounds .5 up (toward +∞)
        $percent = $max == 0 ? 0 : floor(($score / $max) * 1000 + 0.5) / 10;
        if ($percent == floor($percent)) {
            $percent = (int) $percent;
        }

        return [
            'score' => $score, 'maxScore' => $max, 'percent' => $percent, 'passed' => $percent >= $passingPercent,
            'correctIds' => $correct, 'wrongIds' => $wrong, 'unansweredIds' => $unanswered,
        ];
    }

    public static function attemptsLeft(?int $maxAttempts, int $used): ?int
    {
        return $maxAttempts === null ? null : max(0, $maxAttempts - $used);
    }
}
