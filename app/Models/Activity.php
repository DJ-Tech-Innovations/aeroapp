<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Audit trail shown on the admin dashboard. */
class Activity extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'activity_log';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['meta' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function record(string $action, string $subject = '', array $meta = []): void
    {
        static::create(['user_id' => auth()->id(), 'action' => $action, 'subject' => $subject, 'meta' => $meta ?: null]);
    }
}
