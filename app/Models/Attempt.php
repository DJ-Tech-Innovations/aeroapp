<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attempt extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'question_order' => 'array', 'choice_order' => 'array', 'answers' => 'array',
            'score' => 'float', 'max_score' => 'float', 'client_score' => 'float', 'passed' => 'boolean',
            'started_at' => 'datetime', 'submitted_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function percent(): float
    {
        return $this->max_score > 0 ? round($this->score / $this->max_score * 100, 1) : 0.0;
    }

    public function isSubmitted(): bool
    {
        return $this->submitted_at !== null;
    }

    /** Shared `AttemptRow`-like shape for the UI. */
    public function toSummary(): array
    {
        return [
            'id' => $this->id, 'userId' => $this->user_id, 'quizId' => $this->quiz_id, 'quizTitle' => $this->quiz_title,
            'quizMode' => $this->quiz_mode, 'packVersion' => $this->pack_version,
            'score' => $this->score, 'maxScore' => $this->max_score, 'percent' => $this->percent(), 'passed' => $this->passed,
            'startedAt' => $this->started_at?->toIso8601String(), 'submittedAt' => $this->submitted_at?->toIso8601String(),
        ];
    }
}
