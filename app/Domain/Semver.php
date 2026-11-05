<?php

namespace App\Domain;

use InvalidArgumentException;

final class Semver
{
    public const PATTERN = '/^\d+\.\d+\.\d+$/';

    /** @return array{int,int,int} */
    public static function parse(string $v): array
    {
        if (! preg_match('/^v?(\d+)\.(\d+)\.(\d+)/', trim($v), $m)) {
            throw new InvalidArgumentException("Invalid semantic version: \"{$v}\"");
        }

        return [(int) $m[1], (int) $m[2], (int) $m[3]];
    }

    public static function compare(string $a, string $b): int
    {
        return self::parse($a) <=> self::parse($b);
    }

    public static function isNewer(string $candidate, string $current): bool
    {
        return self::compare($candidate, $current) === 1;
    }

    /** Next patch / minor suggestion for the publish form. */
    public static function bump(string $v, string $part = 'minor'): string
    {
        [$ma, $mi, $pa] = self::parse($v);

        return match ($part) {
            'major' => ($ma + 1).'.0.0',
            'patch' => "{$ma}.{$mi}.".($pa + 1),
            default => "{$ma}.".($mi + 1).'.0',
        };
    }
}
