<?php

namespace Database\Seeders;

use App\Domain\PackService;
use App\Domain\QuizEngine;
use App\Domain\Scoring;
use App\Models\Attempt;
use App\Models\ContentPack;
use App\Models\Media;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Models\Spotlight;
use App\Models\Tool;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Demo data (password "password" for every account). Idempotent; refuses to run in production.
 * Authoring tables = pack 1.2.0 state; packs 1.1.0 and 1.2.0 are stored byte-for-byte with their published checksums.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('The demo seeder never runs in production. Use `php artisan aeroapp:create-admin` instead.');
        }
        $this->call(RolesAndPermissionsSeeder::class);
        $fixtures = database_path('data/fixtures');

        $people = [
            ['admin@demo.com', 'super-admin', 'Avery Santos', 'ADM-0001'],
            ['editor@demo.com', 'content-editor', 'Elena Marquez', 'ADM-0002'],
            ['instructor@demo.com', 'instructor', 'Morgan Reyes', 'INS-0042'],
            ['student@demo.com', 'student', 'Alex Rivera', 'AMT-2026-014'],
        ];
        foreach (['Jordan Cruz', 'Sam Okafor', 'Taylor Nguyen', 'Casey Morales', 'Riley Patel', 'Jamie Santos', 'Drew Kim'] as $i => $name) {
            $people[] = ['student'.($i + 2).'@demo.com', 'student', $name, sprintf('AMT-2026-%03d', 20 + $i)];
        }
        // Panel respondents: all faculty + 1st-year students. Faculty are instructors (no section / year level).
        $faculty = [
            ['instructor2@demo.com', 'instructor', 'Dana Villanueva', 'INS-0043'],
            ['instructor3@demo.com', 'instructor', 'Chris Bautista', 'INS-0044'],
        ];
        $ids = [];
        foreach ([...$people, ...$faculty] as [$email, $role, $name, $idNo]) {
            $student = $role === 'student';
            $u = User::firstOrNew(['email' => $email]);
            $u->fill([
                'full_name' => $name, 'id_number' => $idNo, 'school' => 'Northwind Aviation Institute', 'password' => 'password',
                'section' => $student ? 'AMT-1A' : '', 'year_level' => $student ? 1 : null,
            ]);
            $u->is_active = true;
            $u->save();
            $u->syncRoles([$role]);
            $ids[$email] = $u->id;
        }

        // Earlier demo data used 2nd-year classes; rename them in place so re-seeding keeps their ids.
        foreach (['AMT-2A' => 'AMT-1A', 'AMT-2B' => 'AMT-1B'] as $from => $to) {
            if (! SchoolClass::where('name', $to)->exists()) {
                SchoolClass::where('name', $from)->update(['name' => $to]);
            }
        }
        $class = SchoolClass::updateOrCreate(['name' => 'AMT-1A'], ['instructor_id' => $ids['instructor@demo.com']]);
        $students = collect($people)->where(1, 'student')->map(fn ($p) => $ids[$p[0]])->values();
        $class->students()->sync($students);
        SchoolClass::updateOrCreate(['name' => 'AMT-1B'], ['instructor_id' => $ids['instructor2@demo.com']]);

        // Reset demo state.
        Spotlight::query()->delete();
        Attempt::whereIn('user_id', array_values($ids))->delete();
        foreach (ContentPack::all() as $p) {
            Storage::disk(PackService::DISK)->delete($p->storage_path);
        }
        ContentPack::query()->delete();

        // Catalogue = pack 1.2.0.
        $p12 = json_decode(file_get_contents("{$fixtures}/packs/pack-1.2.0/payload.json"), true);
        DB::transaction(function () use ($p12) {
            Tool::query()->delete();
            Quiz::query()->delete();
            foreach ($p12['tools'] as $i => $t) {
                $row = new Tool;
                $row->id = $t['id'];
                $row->fill(['slug' => $t['slug'], 'name' => $t['name'], 'category' => $t['category'], 'subcategory' => $t['subcategory'], 'brand' => $t['brand'], 'unit_system' => $t['unitSystem'], 'sort_order' => $i, 'data' => $t, 'is_published' => true])->save();
            }
            foreach ($p12['quizzes'] as $i => $q) {
                $row = new Quiz;
                $row->id = $q['id'];
                $row->fill(['title' => $q['title'], 'mode' => $q['mode'], 'sort_order' => $i, 'data' => $q, 'is_published' => true])->save();
            }
        });

        // Media: placeholder clip.
        Storage::disk('public')->put('videos/placeholder.mp4', file_get_contents("{$fixtures}/placeholder.mp4"));
        Media::updateOrCreate(['path' => 'videos/placeholder.mp4'], ['name' => 'placeholder.mp4', 'mime' => 'video/mp4', 'size' => filesize("{$fixtures}/placeholder.mp4"), 'kind' => 'video']);

        // Packs, byte-for-byte.
        foreach (['1.1.0', '1.2.0'] as $v) {
            $text = file_get_contents("{$fixtures}/packs/pack-{$v}/payload.json");
            $m = json_decode(file_get_contents("{$fixtures}/packs/pack-{$v}/manifest.json"), true);
            if (hash('sha256', $text) !== $m['sha256']) {
                throw new RuntimeException("pack {$v}: checksum mismatch");
            }
            PackService::store($v, $m['minAppVersion'], $text, $m['changelog'], Carbon::parse($m['releasedAt']), $ids['admin@demo.com']);
            $this->command?->info("  pack {$v}: {$m['toolCount']} tools, {$m['quizCount']} quizzes ✓ checksum");
        }

        // Realistic attempts for the demo roster (taken on pack 1.1.0).
        $p11 = json_decode(file_get_contents("{$fixtures}/packs/pack-1.1.0/payload.json"), true);
        $rng = QuizEngine::seededRng(2026);
        $quizzes = array_values(array_filter($p11['quizzes'], fn ($q) => $q['id'] !== 'quiz-hand-tool-safety'));
        $rows = [];
        foreach (array_slice($people, 4) as $si => [$email]) {
            $skill = 0.5 + 0.08 * $si + $rng() * 0.1;
            foreach ($quizzes as $q) {
                if ($rng() < 0.15) {
                    continue;
                }
                $n = 1 + (int) floor($rng() * 2);
                for ($k = 0; $k < $n; $k++) {
                    $prep = QuizEngine::prepare($q, $rng);
                    $answers = [];
                    foreach ($prep['questions'] as $qu) {
                        $r = $rng();
                        $wrong = array_values(array_filter($qu['choices'], fn ($c) => $c['id'] !== $qu['correctChoiceId']));
                        $answers[$qu['id']] = $r < $skill + $k * 0.08 ? $qu['correctChoiceId'] : ($r > 0.97 ? null : $wrong[(int) floor($rng() * count($wrong))]['id']);
                    }
                    $sc = Scoring::score($prep['questions'], $answers, $q['passingPercent']);
                    $started = now()->subSeconds((int) ((1 + $rng() * 12) * 86400));
                    $rows[] = [
                        'id' => (string) Str::uuid(), 'user_id' => $ids[$email], 'quiz_id' => $q['id'], 'quiz_title' => $q['title'], 'quiz_mode' => $q['mode'],
                        'pack_version' => '1.1.0', 'question_order' => json_encode($prep['questionOrder']), 'choice_order' => json_encode($prep['choiceOrder']),
                        'answers' => json_encode($answers), 'score' => $sc['score'], 'max_score' => $sc['maxScore'], 'passed' => $sc['passed'],
                        'source' => 'web', 'started_at' => $started, 'submitted_at' => $started->copy()->addMinutes(8), 'created_at' => now(), 'updated_at' => now(),
                    ];
                }
            }
        }
        Attempt::insert($rows);
        $this->command?->info('  '.count($rows).' attempts for '.(count($people) - 4).' students');
        $this->command?->info('Seeded. Sign in with admin@demo.com, editor@demo.com, instructor@demo.com (also instructor2/3@demo.com) or student@demo.com (password: password).');
    }
}
