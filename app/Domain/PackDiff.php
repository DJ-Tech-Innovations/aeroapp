<?php

namespace App\Domain;

/** Port of packages/shared diffPacks — items are "updated" when their updatedAt stamp differs. */
final class PackDiff
{
    public static function diff(array $old, array $new): array
    {
        $t = self::list($old['tools'] ?? [], $new['tools'] ?? []);
        $q = self::list($old['quizzes'] ?? [], $new['quizzes'] ?? []);

        return [
            'toolsAdded' => $t[0], 'toolsUpdated' => $t[1], 'toolsRemoved' => $t[2],
            'quizzesAdded' => $q[0], 'quizzesUpdated' => $q[1], 'quizzesRemoved' => $q[2],
        ];
    }

    private static function list(array $old, array $new): array
    {
        $o = [];
        foreach ($old as $x) {
            $o[$x['id']] = $x;
        }
        $n = [];
        foreach ($new as $x) {
            $n[$x['id']] = $x;
        }
        $added = $updated = $removed = [];
        foreach ($n as $id => $x) {
            if (! isset($o[$id])) {
                $added[] = $id;
            } elseif (($o[$id]['updatedAt'] ?? null) !== ($x['updatedAt'] ?? null)) {
                $updated[] = $id;
            }
        }
        foreach (array_keys($o) as $id) {
            if (! isset($n[$id])) {
                $removed[] = $id;
            }
        }

        return [$added, $updated, $removed];
    }
}
