<?php

namespace App\Domain;

use App\Models\Tool;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Tool editor input → the `Tool` JSON stored in `tools.data` and shipped in packs.
 * Shared by the editor form and the Excel import so both validate and save identically.
 */
final class ToolBuilder
{
    /** @return array<string, mixed> */
    public static function rules(): array
    {
        return [
            'id' => ['nullable', 'uuid'],
            'name' => ['required', 'string', 'min:2', 'max:160'],
            'slug' => ['nullable', 'string', 'max:160', 'regex:/^[a-z0-9-]*$/'],
            'category' => ['required', Rule::in(array_keys(Catalog::CATEGORIES))],
            'subcategory' => ['nullable', Rule::in(array_keys(Catalog::SUBCATEGORIES))],
            'brand' => ['required', Rule::in(Catalog::BRANDS)],
            'model' => ['required', 'string', 'max:80'],
            'unitSystem' => ['required', Rule::in(array_keys(Catalog::UNIT_SYSTEMS))],
            'weight.value' => ['required', 'numeric', 'gt:0'],
            'weight.unit' => ['required', Rule::in(Catalog::WEIGHT_UNITS)],
            'dimensions.length' => ['required', 'numeric', 'gt:0'],
            'dimensions.width' => ['required', 'numeric', 'gt:0'],
            'dimensions.height' => ['required', 'numeric', 'gt:0'],
            'dimensions.unit' => ['required', Rule::in(Catalog::SIZE_UNITS)],
            'aircraftApplications' => ['required', 'array', 'min:1'],
            'aircraftApplications.*' => ['required', 'string'],
            'purpose' => ['required', 'string', 'min:10'],
            'howItWorks' => ['required', 'string', 'min:10'],
            'howToUse' => ['required', 'array', 'min:2'],
            'howToUse.*' => ['required', 'string'],
            'maintenance' => ['required', 'array', 'min:1'],
            'maintenance.*' => ['required', 'string'],
            'safety' => ['required', 'array', 'min:1'],
            'safety.*' => ['required', 'string'],
            'archetype' => ['required', Rule::in(Catalog::archetypeNames())],
            'glb' => ['nullable', 'string', 'regex:/\.glb(\?|$)/i'],
            'hotspots' => ['required', 'array', 'min:1', 'max:20'],
            'hotspots.*.label' => ['required', 'string', 'max:120'],
            'hotspots.*.description' => ['required', 'string', 'max:1000'],
            'hotspotPositions' => ['nullable', 'array', 'max:20'],
            'voiceOver.purpose' => ['nullable', 'string'],
            'voiceOver.howItWorks' => ['nullable', 'string'],
            'voiceOver.howToUse' => ['nullable', 'string'],
            'voiceOver.maintenance' => ['nullable', 'string'],
            'video' => ['nullable', 'array'],
            'video.file' => ['required_with:video', 'string'],
            'video.durationSec' => ['required_with:video', 'numeric', 'min:1'],
            'references' => ['required', 'array', 'min:1'],
            'references.*.title' => ['required', 'string'],
            'references.*.publisher' => ['required', 'string'],
            'references.*.section' => ['nullable', 'string'],
            'references.*.url' => ['nullable', 'url:https,http'],
            'tags' => ['array'],
            'tags.*' => ['string'],
            'isSampleData' => ['boolean'],
            'isPublished' => ['boolean'],
        ];
    }

    public static function messages(): array
    {
        return [
            'aircraftApplications.required' => 'Add at least one aircraft application.',
            'howToUse.min' => 'Add the usage steps (at least 2, one per line).',
            'maintenance.required' => 'Add maintenance notes.',
            'safety.required' => 'Add safety notes.',
            'references.required' => 'Add at least one reference.',
            'hotspots.*.label.required' => 'Every part needs a name.',
            'hotspots.*.description.required' => 'Every part needs a purpose.',
            'purpose.min' => 'Purpose needs at least 10 characters.',
            'howItWorks.min' => 'How it works needs at least 10 characters.',
        ];
    }

    /** Validate raw input (trimmed, blank lines dropped). Throws ValidationException. */
    public static function validate(array $raw): array
    {
        $in = self::normalise($raw);
        $v = Validator::make($in, self::rules(), self::messages());
        $v->after(function ($v) use ($in) {
            $sub = $in['subcategory'] ?? null;
            if ($sub && ! in_array($sub, Catalog::SUBS[$in['category'] ?? ''] ?? [], true)) {
                $v->errors()->add('subcategory', 'This subcategory does not belong to the chosen category.');
            }
            $parts = count($in['hotspots'] ?? []);
            if (empty($in['glb']) && $parts !== 3) {
                $v->errors()->add('hotspots', 'The placeholder model needs exactly 3 parts.');
            }
            if (! empty($in['glb'])) {
                $pos = $in['hotspotPositions'] ?? [];
                $ok = count($pos) === $parts && collect($pos)->every(fn ($p) => is_array($p) && count($p) === 3);
                if (! $ok) {
                    $v->errors()->add('hotspots', 'Place every part on the 3D model (click “Place”, then click the model).');
                }
            }
        });

        return $v->validate();
    }

    public static function normalise(array $raw): array
    {
        $lines = fn ($v) => array_values(array_filter(array_map(fn ($s) => trim((string) $s), is_array($v) ? $v : preg_split('/\r?\n|\s\|\s/', (string) $v)), fn ($s) => $s !== ''));
        foreach (['aircraftApplications', 'howToUse', 'maintenance', 'safety'] as $k) {
            if (array_key_exists($k, $raw)) {
                $raw[$k] = $lines($raw[$k]);
            }
        }
        if (isset($raw['tags']) && ! is_array($raw['tags'])) {
            $raw['tags'] = array_values(array_filter(array_map('trim', explode(',', (string) $raw['tags']))));
        }
        foreach (['name', 'slug', 'model', 'purpose', 'howItWorks'] as $k) {
            if (isset($raw[$k]) && is_string($raw[$k])) {
                $raw[$k] = trim($raw[$k]);
            }
        }
        $raw['subcategory'] = ($raw['subcategory'] ?? null) ?: null;
        $raw['glb'] = ($raw['glb'] ?? null) ?: null;

        return $raw;
    }

    public static function autoVoiceOver(array $i): array
    {
        $steps = collect($i['howToUse'])->map(fn ($s, $n) => 'Step '.($n + 1).". {$s}")->implode(' ');

        return [
            'purpose' => "{$i['name']}. {$i['purpose']}",
            'howItWorks' => "How the {$i['name']} works. {$i['howItWorks']}",
            'howToUse' => "How to use the {$i['name']}. {$steps}",
            'maintenance' => "Maintaining the {$i['name']}. ".implode(' ', $i['maintenance']).' Safety: '.implode(' ', $i['safety']),
        ];
    }

    /** Validated input → shared `Tool` object. */
    public static function build(array $i, string $id, string $stamp): array
    {
        $arch = Catalog::archetypes()[$i['archetype']];
        $slug = ($i['slug'] ?? '') ?: Str::slug($i['name']);
        $auto = self::autoVoiceOver($i);
        $vo = [];
        foreach (['purpose', 'howItWorks', 'howToUse', 'maintenance'] as $k) {
            $vo[$k] = trim((string) ($i['voiceOver'][$k] ?? '')) ?: $auto[$k];
        }
        $num = fn ($v) => $v + 0; // "1.60" → 1.6, "250" → 250
        $hotspots = [];
        foreach (array_values($i['hotspots']) as $n => $h) {
            $hotspots[] = [
                'id' => "{$slug}-hs".($n + 1), 'label' => trim($h['label']), 'description' => trim($h['description']),
                'position' => ! empty($i['glb']) ? array_map($num, $i['hotspotPositions'][$n]) : $arch['anchors'][$n],
            ];
        }

        return [
            'id' => $id, 'slug' => $slug, 'name' => $i['name'], 'category' => $i['category'], 'subcategory' => $i['subcategory'] ?? null,
            'brand' => $i['brand'], 'model' => $i['model'], 'unitSystem' => $i['unitSystem'],
            'weight' => ['value' => $num($i['weight']['value']), 'unit' => $i['weight']['unit']],
            'dimensions' => ['length' => $num($i['dimensions']['length']), 'width' => $num($i['dimensions']['width']), 'height' => $num($i['dimensions']['height']), 'unit' => $i['dimensions']['unit']],
            'aircraftApplications' => $i['aircraftApplications'], 'purpose' => $i['purpose'], 'howItWorks' => $i['howItWorks'],
            'howToUse' => $i['howToUse'], 'maintenance' => $i['maintenance'], 'safety' => $i['safety'], 'voiceOver' => $vo,
            'video' => ! empty($i['video']) ? ['file' => $i['video']['file'], 'durationSec' => $num($i['video']['durationSec']), 'thumbnail' => "thumbs/{$slug}.png"] : null,
            'model3d' => ! empty($i['glb'])
                ? ['file' => $i['glb'], 'scale' => 1, 'animations' => [], 'hotspots' => $hotspots, 'fallback' => $i['archetype']]
                : ['file' => "procedural://{$i['archetype']}", 'scale' => 1, 'animations' => array_column($arch['animations'], 'name'), 'hotspots' => $hotspots],
            'thumbnail' => "thumbs/{$slug}.png",
            'references' => array_map(fn ($r) => array_filter([
                'title' => trim($r['title']), 'publisher' => trim($r['publisher']),
                'section' => trim((string) ($r['section'] ?? '')) ?: null, 'url' => trim((string) ($r['url'] ?? '')) ?: null,
            ], fn ($v) => $v !== null), array_values($i['references'])),
            'tags' => array_values($i['tags'] ?? []),
            'isSampleData' => (bool) ($i['isSampleData'] ?? false),
            'updatedAt' => $stamp,
        ];
    }

    /** Validated input → saved row. `updatedAt` drives the pack changelog ("updated"). */
    public static function persist(array $i, ?int $sort = null): Tool
    {
        $id = $i['id'] ?? (string) Str::uuid();
        $tool = self::build($i, $id, now()->toIso8601ZuluString('millisecond'));
        if (Tool::where('slug', $tool['slug'])->where('id', '!=', $id)->exists()) {
            throw ValidationException::withMessages(['slug' => "Another tool already uses the slug “{$tool['slug']}”."]);
        }

        return DB::transaction(function () use ($id, $tool, $i, $sort) {
            $row = Tool::find($id) ?? new Tool(['id' => $id]);
            $row->fill([
                'slug' => $tool['slug'], 'name' => $tool['name'], 'category' => $tool['category'], 'subcategory' => $tool['subcategory'],
                'brand' => $tool['brand'], 'unit_system' => $tool['unitSystem'], 'data' => $tool,
                'is_published' => (bool) ($i['isPublished'] ?? true),
                'sort_order' => $sort ?? ($row->exists ? $row->sort_order : ((int) Tool::max('sort_order')) + 1),
            ]);
            $row->id = $id;
            $row->save();

            return $row;
        });
    }
}
