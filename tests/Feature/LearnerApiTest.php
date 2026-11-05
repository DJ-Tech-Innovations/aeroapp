<?php

use App\Domain\PackService;
use App\Domain\QuizEngine;
use App\Models\Attempt;
use App\Models\ContentPack;
use App\Models\SchoolClass;
use Illuminate\Support\Str;

beforeEach(fn () => seedContent());

function finishedAttempt(array $quiz, string $pack, bool $allCorrect = true, array $override = []): array
{
    $prep = QuizEngine::prepare($quiz);
    $answers = [];
    foreach ($prep['questions'] as $q) {
        $answers[$q['id']] = $allCorrect ? $q['correctChoiceId'] : collect($q['choices'])->firstWhere('id', '!=', $q['correctChoiceId'])['id'];
    }

    return [...[
        'id' => (string) Str::uuid(), 'quizId' => $quiz['id'], 'quizTitle' => $quiz['title'], 'quizMode' => $quiz['mode'], 'packVersion' => $pack,
        'questionOrder' => $prep['questionOrder'], 'choiceOrder' => $prep['choiceOrder'], 'answers' => $answers, 'score' => 0,
        'startedAt' => now()->subMinutes(5)->toIso8601String(), 'submittedAt' => now()->toIso8601String(),
    ], ...$override];
}

it('requires a session for the learner API', function () {
    $this->getJson('/api/me')->assertUnauthorized();
});

it('returns the profile but never lets learners change their role', function () {
    $u = userWithRole('student');
    $this->actingAs($u)->getJson('/api/me')->assertOk()->assertJsonPath('profile.role', 'student');
    $this->actingAs($u)->patchJson('/api/me', ['fullName' => 'New Name', 'role' => 'admin'])->assertOk()->assertJsonPath('profile.fullName', 'New Name');
    expect($u->fresh()->hasRole('admin'))->toBeFalse();
});

it('lists only published packs and serves their exact bytes', function () {
    $u = userWithRole('student');
    ContentPack::find('1.1.0')->update(['is_published' => false]);
    $this->actingAs($u)->getJson('/api/packs')->assertOk()->assertJsonCount(1, 'packs')->assertJsonPath('packs.0.packVersion', '1.2.0');
    $res = $this->actingAs($u)->get('/api/packs/1.2.0/download')->assertOk();
    expect(hash('sha256', $res->getContent()))->toBe('dd0acf13501a17dc17e304eecb7734a89ee6451510eeb70e878107a426b9c867');
    $this->actingAs($u)->get('/api/packs/1.1.0/download')->assertNotFound();
});

it('re-scores synced attempts on the server and is idempotent', function () {
    $u = userWithRole('student');
    $quiz = PackService::payload('1.2.0')['quizzes'][0];
    $good = finishedAttempt($quiz, '1.2.0', true, ['score' => 0]); // client lied low
    $bad = finishedAttempt($quiz, '1.2.0', false, ['score' => 999]); // client lied high

    $r = $this->actingAs($u)->postJson('/api/attempts', ['attempts' => [$good, $bad]])->assertOk()->json('results');
    expect($r[0]['status'])->toBe('stored')->and($r[0]['passed'])->toBeTrue()
        ->and($r[1]['status'])->toBe('stored')->and($r[1]['score'])->toEqual(0)->and($r[1]['passed'])->toBeFalse();
    expect(Attempt::find($bad['id'])->client_score)->toEqual(999.0);

    $again = $this->actingAs($u)->postJson('/api/attempts', ['attempts' => [$good]])->json('results.0.status');
    expect($again)->toBe('duplicate')->and(Attempt::count())->toBe(2);
});

it('rejects attempts for unknown packs, quizzes or questions', function () {
    $u = userWithRole('student');
    $quiz = PackService::payload('1.2.0')['quizzes'][0];
    $items = [
        finishedAttempt($quiz, '9.9.9'),
        finishedAttempt($quiz, '1.2.0', true, ['quizId' => 'nope']),
        finishedAttempt($quiz, '1.2.0', true, ['questionOrder' => ['fake-question']]),
        finishedAttempt($quiz, '1.2.0', true, ['submittedAt' => null]),
    ];
    $r = collect($this->actingAs($u)->postJson('/api/attempts', ['attempts' => $items])->json('results'));
    expect($r->pluck('status')->unique()->all())->toBe(['rejected'])->and(Attempt::count())->toBe(0);
});

it('enforces exam attempt limits on the server', function () {
    $u = userWithRole('student');
    $exam = collect(PackService::payload('1.2.0')['quizzes'])->firstWhere('mode', 'exam');
    $items = array_map(fn () => finishedAttempt($exam, '1.2.0'), range(1, $exam['maxAttempts'] + 1));
    $r = collect($this->actingAs($u)->postJson('/api/attempts', ['attempts' => $items])->json('results'));
    expect($r->where('status', 'stored')->count())->toBe($exam['maxAttempts'])->and($r->last()['status'])->toBe('rejected');
});

it('scopes instructor data to their own classes', function () {
    $teacher = userWithRole('instructor');
    $other = userWithRole('instructor');
    $mine = userWithRole('student');
    $theirs = userWithRole('student');
    SchoolClass::create(['name' => 'A', 'instructor_id' => $teacher->id])->students()->attach($mine);
    SchoolClass::create(['name' => 'B', 'instructor_id' => $other->id])->students()->attach($theirs);
    $quiz = PackService::payload('1.2.0')['quizzes'][0];
    foreach ([$mine, $theirs] as $s) {
        $this->actingAs($s)->postJson('/api/attempts', ['attempts' => [finishedAttempt($quiz, '1.2.0')]]);
    }

    $this->actingAs($teacher)->getJson('/api/instructor/roster')->assertJsonCount(1, 'roster')->assertJsonPath('roster.0.id', $mine->id);
    $this->actingAs($teacher)->getJson('/api/instructor/attempts')->assertJsonCount(1, 'attempts');
    $this->actingAs($mine)->getJson('/api/instructor/roster')->assertForbidden();
});

it('shows an instructor spotlight to their students', function () {
    $teacher = userWithRole('instructor');
    $student = userWithRole('student');
    SchoolClass::create(['name' => 'A', 'instructor_id' => $teacher->id])->students()->attach($student);
    $this->actingAs($teacher)->postJson('/api/instructor/spotlights', ['toolId' => 'x-tool', 'note' => 'Review'])->assertOk();
    $this->actingAs($student)->getJson('/api/spotlight')->assertJsonPath('spotlight.toolId', 'x-tool');
    $this->actingAs($teacher)->deleteJson('/api/instructor/spotlights')->assertOk();
    $this->actingAs($student)->getJson('/api/spotlight')->assertJsonPath('spotlight', null);
});
