<?php

namespace App\Models;

use App\Domain\Semver;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContentPack extends Model
{
    protected $primaryKey = 'version';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['changelog' => 'array', 'is_published' => 'boolean', 'released_at' => 'datetime', 'size_bytes' => 'integer'];
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    public function scopePublished(Builder $q): Builder
    {
        return $q->where('is_published', true);
    }

    /** All packs, newest semver first. */
    public static function sorted(?bool $published = null): Collection
    {
        $q = static::query();
        if ($published !== null) {
            $q->where('is_published', $published);
        }

        return $q->get()->sort(fn ($a, $b) => Semver::compare($b->version, $a->version))->values();
    }

    public static function live(): ?self
    {
        return static::sorted(true)->first();
    }

    /** Shared `PackManifest` contract. */
    public function toManifest(): array
    {
        return [
            'packVersion' => $this->version,
            'minAppVersion' => $this->min_app_version,
            'releasedAt' => $this->released_at->toIso8601ZuluString('millisecond'),
            'toolCount' => $this->tool_count,
            'quizCount' => $this->quiz_count,
            'sizeBytes' => $this->size_bytes,
            'sha256' => $this->sha256,
            'changelog' => $this->changelog,
        ];
    }
}
