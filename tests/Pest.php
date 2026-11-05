<?php

use App\Domain\PackService;
use App\Models\Quiz;
use App\Models\Tool;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->beforeEach(function () {
        $this->withoutVite();
        Storage::fake('local');
        Storage::fake('public');
        $this->seed(RolesAndPermissionsSeeder::class);
    })
    ->in('Feature');

function userWithRole(string $role, array $attrs = []): User
{
    return User::factory()->role($role)->create($attrs);
}

/** Seeds the authoring tables + packs 1.1.0 and 1.2.0 from the fixtures (byte-exact). */
function seedContent(): void
{
    $fx = database_path('data/fixtures/packs');
    $p12 = json_decode(file_get_contents("{$fx}/pack-1.2.0/payload.json"), true);
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
    foreach (['1.1.0', '1.2.0'] as $v) {
        $m = json_decode(file_get_contents("{$fx}/pack-{$v}/manifest.json"), true);
        PackService::store($v, $m['minAppVersion'], file_get_contents("{$fx}/pack-{$v}/payload.json"), $m['changelog'], Carbon::parse($m['releasedAt']));
    }
}
