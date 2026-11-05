<?php

namespace App\Domain;

use App\Models\Activity;
use App\Models\ContentPack;
use App\Models\Quiz;
use App\Models\Tool;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Content packs: immutable, versioned snapshots of every published tool and quiz.
 * The SHA-256 in a manifest covers the stored file's bytes exactly; clients verify those bytes and never re-serialise.
 */
final class PackService
{
    public const DISK = 'local';

    public static function path(string $version): string
    {
        return "packs/pack-{$version}.json";
    }

    /** Everything that would go into a pack if published now. Raw JSON is kept so `{}` stays an object. */
    public static function buildText(): string
    {
        $tools = Tool::where('is_published', true)->orderBy('sort_order')->orderBy('name')->toBase()->pluck('data')->all();
        $quizzes = Quiz::where('is_published', true)->orderBy('sort_order')->orderBy('title')->toBase()->pluck('data')->all();

        return '{"tools":['.implode(',', $tools).'],"quizzes":['.implode(',', $quizzes).']}';
    }

    /** @return array{tools: array, quizzes: array} */
    public static function buildPayload(): array
    {
        return json_decode(self::buildText(), true);
    }

    /** Exact bytes of a stored pack. */
    public static function read(string $version): ?string
    {
        $disk = Storage::disk(self::DISK);
        $p = ContentPack::find($version)?->storage_path ?? self::path($version);

        return $disk->exists($p) ? $disk->get($p) : null;
    }

    /** Decoded payload of a stored pack (cached: packs are immutable). */
    public static function payload(string $version): ?array
    {
        return Cache::rememberForever("pack-payload:{$version}", fn () => ($t = self::read($version)) ? json_decode($t, true) : null);
    }

    /** @return array{row: ContentPack, payload: array}|null */
    public static function latestPublished(): ?array
    {
        $row = ContentPack::live();

        return $row ? ['row' => $row, 'payload' => self::payload($row->version) ?? ['tools' => [], 'quizzes' => []]] : null;
    }

    /** Names (not ids) so the changelog reads well in the app. */
    public static function namedChangelog(?array $prev, array $next, ?string $notes = null): array
    {
        $base = $prev ?? ['tools' => [], 'quizzes' => []];
        $d = PackDiff::diff($base, $next);
        $tn = $qn = [];
        foreach ([...$base['tools'], ...$next['tools']] as $t) {
            $tn[$t['id']] = $t['name'];
        }
        foreach ([...$base['quizzes'], ...$next['quizzes']] as $q) {
            $qn[$q['id']] = $q['title'];
        }
        $map = fn (array $ids, array $names) => array_map(fn ($i) => $names[$i] ?? $i, $ids);
        $out = [
            'toolsAdded' => $map($d['toolsAdded'], $tn), 'toolsUpdated' => $map($d['toolsUpdated'], $tn), 'toolsRemoved' => $map($d['toolsRemoved'], $tn),
            'quizzesAdded' => $map($d['quizzesAdded'], $qn), 'quizzesUpdated' => $map($d['quizzesUpdated'], $qn), 'quizzesRemoved' => $map($d['quizzesRemoved'], $qn),
        ];
        if ($notes) {
            $out['notes'] = $notes;
        }

        return $out;
    }

    public static function changeCount(array $c): int
    {
        return collect($c)->filter(fn ($v) => is_array($v))->sum(fn ($v) => count($v));
    }

    /** Pre-publish integrity checks: learners must never receive a pack with broken references. */
    public static function validate(array $p): array
    {
        $errs = [];
        if (! count($p['tools'])) {
            $errs[] = 'The pack has no published tools.';
        }
        $tools = [];
        $slugs = [];
        foreach ($p['tools'] as $t) {
            $tools[$t['id']] = $t;
            if (isset($slugs[$t['slug']])) {
                $errs[] = "Duplicate tool slug “{$t['slug']}”.";
            }
            $slugs[$t['slug']] = true;
            if (empty($t['references'])) {
                $errs[] = "Tool “{$t['name']}” has no references.";
            }
            if (! Catalog::isGlb($t['model3d']['file'] ?? '') && empty($t['model3d']['animations'])) {
                $errs[] = "Tool “{$t['name']}” has no 3D animation.";
            }
        }
        foreach ($p['quizzes'] as $q) {
            if (empty($q['questions'])) {
                $errs[] = "Quiz “{$q['title']}” has no questions.";
            }
            if (($q['drawCount'] ?? null) !== null && $q['drawCount'] > count($q['questions'])) {
                $errs[] = "Quiz “{$q['title']}” draws {$q['drawCount']} from a pool of only ".count($q['questions']).'.';
            }
            foreach ($q['questions'] as $i => $qu) {
                $where = "Quiz “{$q['title']}”, question ".($i + 1);
                if (! in_array($qu['correctChoiceId'], array_column($qu['choices'], 'id'), true)) {
                    $errs[] = "{$where}: the correct choice is missing.";
                }
                if (count($qu['choices']) < 2) {
                    $errs[] = "{$where}: needs at least 2 choices.";
                }
                if (! empty($qu['toolId']) && ! isset($tools[$qu['toolId']])) {
                    $errs[] = "{$where}: references a tool that is not in this pack.";
                }
                if (! empty($qu['hotspotId'])) {
                    $hs = array_column($tools[$qu['toolId'] ?? '']['model3d']['hotspots'] ?? [], 'id');
                    if (! in_array($qu['hotspotId'], $hs, true)) {
                        $errs[] = "{$where}: references a missing hotspot.";
                    }
                }
            }
        }

        return $errs;
    }

    /** Suggested next version for the publish form. */
    public static function suggestVersion(): string
    {
        $latest = ContentPack::sorted()->first();

        return $latest ? Semver::bump($latest->version) : '1.0.0';
    }

    public static function publish(string $version, string $minAppVersion, ?string $notes, ?string $userId): ContentPack
    {
        $err = fn (string $f, string $m) => throw ValidationException::withMessages([$f => $m]);
        if (! preg_match(Semver::PATTERN, $version)) {
            $err('version', 'Version must look like 1.3.0.');
        }
        if (! preg_match(Semver::PATTERN, $minAppVersion)) {
            $err('minAppVersion', 'Minimum app version must look like 1.0.0.');
        }
        if (ContentPack::find($version)) {
            $err('version', "Version {$version} already exists. Versions are immutable.");
        }
        $latest = ContentPack::sorted()->first();
        if ($latest && Semver::compare($version, $latest->version) <= 0) {
            $err('version', "Version must be higher than the latest ({$latest->version}).");
        }

        $text = self::buildText();
        $payload = json_decode($text, true);
        $problems = self::validate($payload);
        if ($problems) {
            $err('version', 'Fix these first: '.implode(' · ', array_slice($problems, 0, 5)).(count($problems) > 5 ? ' … (+'.(count($problems) - 5).' more)' : ''));
        }

        $changelog = self::namedChangelog(self::latestPublished()['payload'] ?? null, $payload, trim((string) $notes) ?: null);

        return self::store($version, $minAppVersion, $text, $changelog, now(), $userId);
    }

    /** Writes the exact bytes, then records the manifest. Used by publish and by the seeder (fixture packs). */
    public static function store(string $version, string $minAppVersion, string $text, array $changelog, \DateTimeInterface $releasedAt, ?string $userId = null): ContentPack
    {
        $payload = json_decode($text, true);
        $path = self::path($version);
        Storage::disk(self::DISK)->put($path, $text);

        try {
            return DB::transaction(function () use ($version, $minAppVersion, $text, $payload, $changelog, $releasedAt, $userId, $path) {
                $pack = ContentPack::create([
                    'version' => $version, 'min_app_version' => $minAppVersion, 'released_at' => $releasedAt,
                    'tool_count' => count($payload['tools']), 'quiz_count' => count($payload['quizzes']),
                    'size_bytes' => strlen($text), 'sha256' => hash('sha256', $text), 'changelog' => $changelog,
                    'storage_path' => $path, 'is_published' => true, 'published_by' => $userId,
                ]);
                Cache::forget("pack-payload:{$version}");
                Activity::record('pack.published', "v{$version}", ['tools' => $pack->tool_count, 'quizzes' => $pack->quiz_count]);

                return $pack;
            });
        } catch (\Throwable $e) {
            Storage::disk(self::DISK)->delete($path); // never leave an orphan file

            throw $e;
        }
    }

    /** Withdraw (or restore): "check for updates" stops offering it. Copies already installed are unaffected. */
    public static function setPublished(ContentPack $pack, bool $published): void
    {
        $pack->update(['is_published' => $published]);
        Activity::record($published ? 'pack.restored' : 'pack.withdrawn', "v{$pack->version}");
    }
}
