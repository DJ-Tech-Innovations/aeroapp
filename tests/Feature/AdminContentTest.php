<?php

use App\Domain\Catalog;
use App\Domain\PackDiff;
use App\Domain\PackService;
use App\Domain\ToolBuilder;
use App\Domain\ToolExcel;
use App\Models\ContentPack;
use App\Models\Tool;
use Illuminate\Http\UploadedFile;

beforeEach(fn () => seedContent());

it('publishes a pack whose checksum covers the stored bytes and whose changelog names the change', function () {
    $admin = userWithRole('admin');
    $tool = Tool::first();
    $data = $tool->data;
    $data['purpose'] .= ' Edited.';
    $data['updatedAt'] = now()->toIso8601ZuluString();
    $tool->update(['data' => $data]);

    $this->actingAs($admin)->post('/admin/packs', ['version' => '1.3.0', 'minAppVersion' => '1.0.0', 'notes' => 'Hi'])->assertSessionHas('success');
    $pack = ContentPack::find('1.3.0');
    expect(hash('sha256', PackService::read('1.3.0')))->toBe($pack->sha256)
        ->and($pack->changelog['toolsUpdated'])->toBe([$tool->name])
        ->and($pack->changelog['notes'])->toBe('Hi');
});

it('refuses versions that do not increase', function () {
    $this->actingAs(userWithRole('admin'))->post('/admin/packs', ['version' => '1.2.0', 'minAppVersion' => '1.0.0'])->assertSessionHasErrors('version');
    $this->actingAs(userWithRole('admin'))->post('/admin/packs', ['version' => '1.1.5', 'minAppVersion' => '1.0.0'])->assertSessionHasErrors('version');
});

it('withdraws and restores a pack', function () {
    $admin = userWithRole('admin');
    $this->actingAs($admin)->post('/admin/packs/1.2.0/toggle');
    expect(ContentPack::find('1.2.0')->is_published)->toBeFalse();
    $this->actingAs($admin)->post('/admin/packs/1.2.0/toggle');
    expect(ContentPack::find('1.2.0')->is_published)->toBeTrue();
});

it('validates and saves a tool from the editor', function () {
    $admin = userWithRole('admin');
    $this->actingAs($admin)->post('/admin/tools', ['name' => 'X'])->assertSessionHasErrors(['name', 'model', 'purpose', 'references']);

    $src = Tool::first()->data;
    $payload = [
        'name' => 'Test Drill', 'slug' => '', 'category' => 'power', 'subcategory' => 'electric', 'brand' => 'Milwaukee', 'model' => 'M12',
        'unitSystem' => 'metric', 'weight' => ['value' => '1.2', 'unit' => 'kg'], 'dimensions' => ['length' => 200, 'width' => 60, 'height' => 180, 'unit' => 'mm'],
        'aircraftApplications' => ['Panels'], 'purpose' => 'Drills holes in sheet metal.', 'howItWorks' => 'A motor spins the chuck.',
        'howToUse' => ['Fit bit', 'Drill'], 'maintenance' => ['Clean'], 'safety' => ['Goggles'], 'archetype' => 'drill', 'glb' => null,
        'hotspots' => [['label' => 'Chuck', 'description' => 'Holds the bit'], ['label' => 'Trigger', 'description' => 'Speed'], ['label' => 'Battery', 'description' => 'Power']],
        'voiceOver' => ['purpose' => '', 'howItWorks' => '', 'howToUse' => '', 'maintenance' => ''], 'video' => null,
        'references' => [['title' => 'AMT Handbook', 'publisher' => 'FAA', 'section' => '', 'url' => '']], 'tags' => 'drill, power', 'isSampleData' => true, 'isPublished' => true,
    ];
    $this->actingAs($admin)->post('/admin/tools', $payload)->assertSessionHas('success');
    $t = Tool::where('slug', 'test-drill')->firstOrFail();
    expect($t->data['voiceOver']['purpose'])->toStartWith('Test Drill.')
        ->and($t->data['model3d']['hotspots'][0]['position'])->toBe(Catalog::archetypes()['drill']['anchors'][0])
        ->and($t->data['tags'])->toBe(['drill', 'power']);
    expect(PackService::validate(PackService::buildPayload()))->toBe([]);
    unset($src);
});

it('round-trips the Excel export through import validation with zero errors', function () {
    $bytes = ToolExcel::workbook(Tool::all());
    $file = tempnam(sys_get_temp_dir(), 'x').'.xlsx';
    file_put_contents($file, $bytes);
    $plan = ToolExcel::plan($file);
    expect($plan['problems'])->toBe([])
        ->and(collect($plan['rows'])->flatMap(fn ($r) => $r['errors'])->all())->toBe([])
        ->and(count($plan['inputs']))->toBe(Tool::count())
        ->and(collect($plan['rows'])->pluck('action')->unique()->all())->toBe(['update']);
});

it('imports all-or-nothing through the endpoint', function () {
    $admin = userWithRole('admin');
    $bytes = ToolExcel::workbook(null);
    $file = UploadedFile::fake()->createWithContent('t.xlsx', $bytes);
    $this->actingAs($admin)->post('/admin/tools/import/check', ['file' => $file], ['Accept' => 'application/json'])
        ->assertOk()->assertJsonPath('problems.0', 'The Tools sheet has no tools.');
});

it('does not mark tools as updated when an unchanged export is imported again', function () {
    $import = function () {
        $file = tempnam(sys_get_temp_dir(), 'x').'.xlsx';
        file_put_contents($file, ToolExcel::workbook(Tool::orderBy('sort_order')->get()));
        foreach (ToolExcel::plan($file)['inputs'] as $i) {
            ToolBuilder::persist($i);
        }
    };
    $import(); // first pass may normalise hand-made fixture data
    $before = PackService::buildPayload();
    $import(); // second pass: identical content
    $diff = PackDiff::diff($before, PackService::buildPayload());
    expect($diff['toolsUpdated'])->toBe([])->and($diff['toolsAdded'])->toBe([]);
});
