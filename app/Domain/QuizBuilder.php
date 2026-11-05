<?php

namespace App\Domain;

use App\Models\Quiz;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Quiz editor input → the shared `Quiz` object (incl. answer key) stored in `quizzes.data`. */
final class QuizBuilder
{
    public static function validate(array $in): array
    {
        $v = Validator::make($in, [
            'id' => ['nullable', 'string', 'max:120'],
            'title' => ['required', 'string', 'min:3', 'max:160'],
            'description' => ['nullable', 'string', 'max:2000'],
            'mode' => ['required', Rule::in(['quiz', 'exam'])],
            'timeLimitSec' => ['nullable', 'integer', 'min:1'],
            'maxAttempts' => ['nullable', 'integer', 'min:1'],
            'passingPercent' => ['required', 'numeric', 'min:1', 'max:100'],
            'drawCount' => ['nullable', 'integer', 'min:1'],
            'isPublished' => ['boolean'],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.id' => ['required', 'string'],
            'questions.*.type' => ['required', Rule::in(array_keys(Catalog::QUESTION_TYPES))],
            'questions.*.prompt' => ['required', 'string', 'min:3'],
            'questions.*.toolId' => ['nullable', 'string'],
            'questions.*.hotspotId' => ['nullable', 'string'],
            'questions.*.choices' => ['required', 'array', 'min:2', 'max:6'],
            'questions.*.choices.*.id' => ['required', 'string'],
            'questions.*.choices.*.text' => ['required', 'string'],
            'questions.*.correctChoiceId' => ['nullable', 'string'], // reported per question by the after-hook below
            'questions.*.explanation' => ['required', 'string', 'min:3'],
            'questions.*.points' => ['required', 'integer', 'min:1', 'max:20'],
        ], [
            'questions.required' => 'Add at least one question.',
            'questions.*.prompt.required' => 'Every question needs a prompt.',
            'questions.*.choices.*.text.required' => 'Every choice needs text.',
            'questions.*.explanation.required' => 'Add an explanation (shown after answering).',
        ]);
        $v->after(function ($v) use ($in) {
            $qs = $in['questions'] ?? [];
            if (! empty($in['drawCount']) && $in['drawCount'] > count($qs)) {
                $v->errors()->add('drawCount', "Draw count ({$in['drawCount']}) can’t exceed the pool size (".count($qs).').');
            }
            if (($in['mode'] ?? '') === 'exam' && empty($in['timeLimitSec'])) {
                $v->errors()->add('timeLimitSec', 'Exams need a time limit.');
            }
            foreach ($qs as $i => $q) {
                $n = $i + 1;
                $ids = array_column($q['choices'] ?? [], 'id');
                if (! in_array($q['correctChoiceId'] ?? '', $ids, true)) {
                    $v->errors()->add("questions.$i", "Question $n: mark the correct choice.");
                }
                if (in_array($q['type'] ?? '', ['identify_tool', 'identify_part'], true) && empty($q['toolId'])) {
                    $v->errors()->add("questions.$i", "Question $n: choose the tool shown.");
                }
                if (($q['type'] ?? '') === 'identify_part' && empty($q['hotspotId'])) {
                    $v->errors()->add("questions.$i", "Question $n: choose the hotspot.");
                }
                $texts = array_map(fn ($c) => mb_strtolower(trim((string) ($c['text'] ?? ''))), $q['choices'] ?? []);
                if (count(array_unique($texts)) !== count($texts)) {
                    $v->errors()->add("questions.$i", "Question $n: choices must be different.");
                }
            }
        });

        return $v->validate();
    }

    public static function build(array $i, string $id, string $stamp): array
    {
        return [
            'id' => $id, 'title' => trim($i['title']), 'description' => trim((string) ($i['description'] ?? '')), 'mode' => $i['mode'],
            'timeLimitSec' => $i['timeLimitSec'] ?? null, 'maxAttempts' => $i['maxAttempts'] ?? null,
            'passingPercent' => $i['passingPercent'] + 0, 'drawCount' => $i['drawCount'] ?? null,
            'shuffleQuestions' => true, 'shuffleChoices' => true,
            'questions' => array_map(fn ($q) => array_filter([
                'id' => $q['id'], 'type' => $q['type'], 'prompt' => trim($q['prompt']),
                'toolId' => $q['toolId'] ?? null,
                'hotspotId' => ($q['type'] === 'identify_part') ? ($q['hotspotId'] ?? null) : null,
                'choices' => array_map(fn ($c) => ['id' => $c['id'], 'text' => trim($c['text'])], array_values($q['choices'])),
                'correctChoiceId' => $q['correctChoiceId'], 'explanation' => trim($q['explanation']), 'points' => (int) $q['points'],
            ], fn ($v) => $v !== null), array_values($i['questions'])),
            'updatedAt' => $stamp,
        ];
    }

    public static function persist(array $i): Quiz
    {
        $id = ($i['id'] ?? null) ?: 'quiz-'.Str::slug($i['title']).'-'.Str::lower(Str::random(4));
        $quiz = self::build($i, $id, now()->toIso8601ZuluString('millisecond'));
        $row = Quiz::find($id) ?? new Quiz;
        $row->id = $id;
        $row->fill([
            'title' => $quiz['title'], 'mode' => $quiz['mode'], 'data' => $quiz, 'is_published' => (bool) ($i['isPublished'] ?? true),
            'sort_order' => $row->exists ? $row->sort_order : ((int) Quiz::max('sort_order')) + 1,
        ]);
        $row->save();

        return $row;
    }
}
