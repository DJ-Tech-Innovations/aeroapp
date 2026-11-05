<?php

namespace App\Domain;

/**
 * PHP port of packages/shared quiz engine (shuffle, draw, prepare, restore).
 * Works on Question arrays as defined in packages/shared/src/types.ts.
 */
final class QuizEngine
{
    /** @param  callable():float|null  $rng  returns [0,1) */
    public static function shuffle(array $items, ?callable $rng = null): array
    {
        $rng ??= fn () => mt_rand() / (mt_getrandmax() + 1);
        $a = array_values($items);
        for ($i = count($a) - 1; $i > 0; $i--) {
            $j = (int) floor($rng() * ($i + 1));
            [$a[$i], $a[$j]] = [$a[$j], $a[$i]];
        }

        return $a;
    }

    public static function draw(array $items, ?int $count, ?callable $rng = null): array
    {
        $s = self::shuffle($items, $rng);

        return $count === null || $count >= count($s) ? $s : array_slice($s, 0, max(0, $count));
    }

    /** @return array{questionOrder: string[], choiceOrder: array<string,string[]>, questions: array} */
    public static function prepare(array $quiz, ?callable $rng = null): array
    {
        $drawn = self::draw($quiz['questions'], $quiz['drawCount'] ?? null, $rng);
        $questions = array_map(fn ($q) => [...$q, 'choices' => self::shuffle($q['choices'], $rng)], $drawn);

        return [
            'questionOrder' => array_column($questions, 'id'),
            'choiceOrder' => array_combine(array_column($questions, 'id'), array_map(fn ($q) => array_column($q['choices'], 'id'), $questions)) ?: [],
            'questions' => $questions,
        ];
    }

    /** Rebuild the presented questions of a saved attempt from the quiz definition. */
    public static function restore(array $quiz, array $questionOrder, array $choiceOrder): array
    {
        $byId = [];
        foreach ($quiz['questions'] as $q) {
            $byId[$q['id']] = $q;
        }
        $out = [];
        foreach ($questionOrder as $id) {
            if (! isset($byId[$id])) {
                continue;
            }
            $q = $byId[$id];
            $cById = [];
            foreach ($q['choices'] as $c) {
                $cById[$c['id']] = $c;
            }
            $order = $choiceOrder[$id] ?? array_keys($cById);
            $q['choices'] = array_values(array_filter(array_map(fn ($cid) => $cById[$cid] ?? null, $order)));
            $out[] = $q;
        }

        return $out;
    }

    /** Deterministic PRNG (mulberry32) — same sequence as packages/shared seededRng. */
    public static function seededRng(int $seed): callable
    {
        $t = $seed & 0xFFFFFFFF;
        // 32-bit multiply without overflowing PHP's 64-bit ints (split into 16-bit halves), like Math.imul.
        $imul = function (int $a, int $b): int {
            $ah = ($a >> 16) & 0xFFFF;
            $al = $a & 0xFFFF;
            $bh = ($b >> 16) & 0xFFFF;
            $bl = $b & 0xFFFF;

            return (($al * $bl) + ((($ah * $bl + $al * $bh) << 16) & 0xFFFFFFFF)) & 0xFFFFFFFF;
        };

        return function () use (&$t, $imul): float {
            $t = ($t + 0x6D2B79F5) & 0xFFFFFFFF;
            $r = $imul($t ^ ($t >> 15), 1 | $t);
            $r = ($r ^ (($r + $imul($r ^ ($r >> 7), 61 | $r)) & 0xFFFFFFFF)) & 0xFFFFFFFF;

            return (($r ^ ($r >> 14)) & 0xFFFFFFFF) / 4294967296;
        };
    }
}
