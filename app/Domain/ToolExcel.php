<?php

namespace App\Domain;

use App\Models\Tool;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\RichText\RichText;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Throwable;

/**
 * Excel round trip for the tool catalogue: Instructions + Tools (one row per tool) + Parts + References
 * (many rows per tool, linked by slug). The same layout serves the empty template and exports, so an
 * export can be edited and imported back. Imports are validated in full before anything is saved.
 */
final class ToolExcel
{
    public const MAX_ROWS = 500;

    public const MAX_BYTES = 5 * 1024 * 1024;

    private const ACCENT = 'FF1D4ED8';

    /** [key, header, width, kind, required, list, help] */
    private static function toolCols(): array
    {
        return [
            ['id', 'ID', 38, 'text', false, null, 'Leave blank for a new tool. Export fills it in. Keep it to update that tool.'],
            ['slug', 'Slug', 26, 'text', false, null, 'Short web name, unique per tool. Blank = made from the name. Parts and References use it.'],
            ['name', 'Name', 30, 'text', true, null, 'At least 2 characters.'],
            ['category', 'Category', 14, 'list', true, 'category', 'Pick from the dropdown.'],
            ['subcategory', 'Subcategory', 14, 'list', false, 'subcategory', 'Only for Power (pneumatic, electric) and Measuring (english, metric).'],
            ['brand', 'Brand', 18, 'list', true, 'brand', 'Pick from the dropdown.'],
            ['model', 'Model', 16, 'text', true, null, 'Manufacturer model number.'],
            ['unitSystem', 'Unit system', 13, 'list', true, 'unitSystem', 'Pick from the dropdown.'],
            ['weight', 'Weight', 9, 'number', true, null, 'Number only, no unit.'],
            ['weightUnit', 'Weight unit', 11, 'list', true, 'weightUnit', ''],
            ['length', 'Length', 9, 'number', true, null, ''],
            ['width', 'Width', 9, 'number', true, null, ''],
            ['height', 'Height', 9, 'number', true, null, ''],
            ['sizeUnit', 'Size unit', 10, 'list', true, 'sizeUnit', 'Unit for length, width and height.'],
            ['aircraftApplications', 'Aircraft applications', 36, 'lines', true, null, 'One per line.'],
            ['purpose', 'Purpose', 44, 'long', true, null, 'What the tool is for (10+ characters).'],
            ['howItWorks', 'How it works', 44, 'long', true, null, '10+ characters.'],
            ['howToUse', 'How to use (steps)', 44, 'lines', true, null, 'One step per line, at least 2. Do not number them.'],
            ['maintenance', 'Maintenance', 40, 'lines', true, null, 'One per line.'],
            ['safety', 'Safety', 40, 'lines', true, null, 'One per line (PPE and hazards).'],
            ['archetype', 'Placeholder 3D model', 20, 'list', true, 'archetype', 'Built-in 3D shape.'],
            ['videoFile', 'Video file', 26, 'text', false, null, 'videos/<file>.mp4 or https URL. Blank = no video.'],
            ['videoDuration', 'Video length (s)', 10, 'number', false, null, 'Blank = 8.'],
            ['tags', 'Tags', 24, 'text', false, null, 'Comma separated.'],
            ['sample', 'Sample data', 10, 'yesno', false, 'yesno', 'Yes shows a “Sample data” badge.'],
            ['published', 'Published', 10, 'yesno', false, 'yesno', 'No = draft, left out of content packs.'],
            ['voPurpose', 'Voice-over: purpose', 30, 'long', false, null, 'Optional. Blank = written automatically (recommended).'],
            ['voHowItWorks', 'Voice-over: how it works', 30, 'long', false, null, 'Optional.'],
            ['voHowToUse', 'Voice-over: how to use', 30, 'long', false, null, 'Optional.'],
            ['voMaintenance', 'Voice-over: maintenance', 30, 'long', false, null, 'Optional.'],
            ['aiModel', 'AI 3D model (read-only)', 22, 'readonly', false, null, 'Shown by Export, ignored by Import.'],
        ];
    }

    private static function partCols(): array
    {
        return [
            ['tool', 'Tool slug', 28, 'text', true, null, 'The tool’s slug (or exact name) from the Tools sheet.'],
            ['n', 'Part #', 8, 'number', false, null, 'Order of the part. Blank = row order.'],
            ['name', 'Part name', 28, 'text', true, null, ''],
            ['purpose', 'Purpose', 60, 'long', true, null, 'What the part does; read aloud by the app.'],
        ];
    }

    private static function refCols(): array
    {
        return [
            ['tool', 'Tool slug', 28, 'text', true, null, 'The tool’s slug (or exact name) from the Tools sheet.'],
            ['title', 'Title', 40, 'text', true, null, ''],
            ['publisher', 'Publisher', 20, 'text', true, null, ''],
            ['section', 'Section', 20, 'text', false, null, 'Optional.'],
            ['url', 'URL', 40, 'text', false, null, 'Optional, https://…'],
        ];
    }

    private static function lists(): array
    {
        return [
            'category' => array_keys(Catalog::CATEGORIES), 'subcategory' => array_keys(Catalog::SUBCATEGORIES), 'brand' => Catalog::BRANDS,
            'unitSystem' => array_keys(Catalog::UNIT_SYSTEMS), 'weightUnit' => Catalog::WEIGHT_UNITS, 'sizeUnit' => Catalog::SIZE_UNITS,
            'archetype' => Catalog::archetypeNames(), 'yesno' => ['Yes', 'No'],
        ];
    }

    // ───────────── Export ─────────────

    /** @param  Tool[]|null  $tools  null = empty template */
    public static function workbook(?iterable $tools): string
    {
        $book = new Spreadsheet;
        $book->getProperties()->setCreator('AeroApp Admin')->setTitle('AeroApp tools');
        $book->removeSheetByIndex(0);
        $list = $tools ? collect($tools)->all() : [];
        self::instructions($book, $tools === null ? null : count($list));

        $rows = $parts = $refs = [];
        foreach ($list as $row) {
            $t = $row->data;
            $auto = ToolBuilder::autoVoiceOver($t);
            $rows[] = [
                'id' => $t['id'], 'slug' => $t['slug'], 'name' => $t['name'], 'category' => $t['category'], 'subcategory' => $t['subcategory'] ?? '',
                'brand' => $t['brand'], 'model' => $t['model'], 'unitSystem' => $t['unitSystem'],
                'weight' => $t['weight']['value'], 'weightUnit' => $t['weight']['unit'],
                'length' => $t['dimensions']['length'], 'width' => $t['dimensions']['width'], 'height' => $t['dimensions']['height'], 'sizeUnit' => $t['dimensions']['unit'],
                'aircraftApplications' => implode("\n", $t['aircraftApplications']), 'purpose' => $t['purpose'], 'howItWorks' => $t['howItWorks'],
                'howToUse' => implode("\n", $t['howToUse']), 'maintenance' => implode("\n", $t['maintenance']), 'safety' => implode("\n", $t['safety']),
                'archetype' => Catalog::archetypeOf($t['model3d']['file']) ?? ($t['model3d']['fallback'] ?? ''),
                'videoFile' => $t['video']['file'] ?? '', 'videoDuration' => $t['video']['durationSec'] ?? '', 'tags' => implode(', ', $t['tags'] ?? []),
                'sample' => ($t['isSampleData'] ?? false) ? 'Yes' : 'No', 'published' => $row->is_published ? 'Yes' : 'No',
                // Only custom narration is exported, so editing the text keeps the automatic voice-over in step.
                'voPurpose' => $t['voiceOver']['purpose'] === $auto['purpose'] ? '' : $t['voiceOver']['purpose'],
                'voHowItWorks' => $t['voiceOver']['howItWorks'] === $auto['howItWorks'] ? '' : $t['voiceOver']['howItWorks'],
                'voHowToUse' => $t['voiceOver']['howToUse'] === $auto['howToUse'] ? '' : $t['voiceOver']['howToUse'],
                'voMaintenance' => $t['voiceOver']['maintenance'] === $auto['maintenance'] ? '' : $t['voiceOver']['maintenance'],
                'aiModel' => Catalog::isGlb($t['model3d']['file']) ? 'Yes ('.count($t['model3d']['hotspots']).' parts placed)' : '',
            ];
            foreach ($t['model3d']['hotspots'] as $n => $h) {
                $parts[] = ['tool' => $t['slug'], 'n' => $n + 1, 'name' => $h['label'], 'purpose' => $h['description']];
            }
            foreach ($t['references'] as $r) {
                $refs[] = ['tool' => $t['slug'], 'title' => $r['title'], 'publisher' => $r['publisher'], 'section' => $r['section'] ?? '', 'url' => $r['url'] ?? ''];
            }
        }
        self::sheet($book, 'Tools', self::toolCols(), $rows);
        self::sheet($book, 'Parts', self::partCols(), $parts);
        self::sheet($book, 'References', self::refCols(), $refs);

        $ls = $book->createSheet()->setTitle('Lists');
        $i = 1;
        foreach (self::lists() as $name => $values) {
            $ls->setCellValue([$i, 1], $name);
            foreach (array_values($values) as $r => $v) {
                $ls->setCellValue([$i, $r + 2], $v);
            }
            $i++;
        }
        $ls->setSheetState(Worksheet::SHEETSTATE_HIDDEN);
        $book->setActiveSheetIndex(0);

        ob_start();
        (new Xlsx($book))->save('php://output');

        return (string) ob_get_clean();
    }

    private static function instructions(Spreadsheet $book, ?int $exported): void
    {
        $ws = $book->createSheet()->setTitle('Instructions');
        $ws->getColumnDimension('A')->setWidth(120);
        $lines = [
            ['AeroApp — tool import', true],
            [$exported === null ? 'Empty template. Fill it in, then upload it in Admin → Tools → Import / Export.' : "Export of {$exported} tool(s) on ".now()->toDateString().'. Edit it and import it back to update them.', false],
            ['', false],
            ['How to use', true],
            ['1. Fill one row per tool on the Tools sheet. Headers marked * are required. Use the dropdowns where a cell has one.', false],
            ['2. List each tool’s parts on the Parts sheet and its references on the References sheet. Link rows to the tool with its slug (or exact name).', false],
            ['3. “One per line” cells: put each item on its own line in the same cell (Windows: Alt+Enter · Mac: Control+Option+Return), or separate with “ | ”.', false],
            ['4. Save as .xlsx, upload it and click Check file. Nothing is saved until every row is valid and you click Import.', false],
            ['5. Imported tools reach learners only after you publish a new content pack.', false],
            ['', false],
            ['Rules', true],
            ['• A row with an ID (or a slug that already exists) updates that tool; other rows create new tools. Tools left out of the file are never deleted.', false],
            ['• A tool with the placeholder 3D model needs exactly 3 parts. A tool with an AI model keeps its placed parts; you can rename them, but the count must stay the same.', false],
            ['• Leave a tool’s Parts or References rows out entirely to keep the ones it already has.', false],
            ['• Do not rename sheets or header cells. You can reorder columns.', false],
            ['• At most '.self::MAX_ROWS.' tools and '.(self::MAX_BYTES / 1048576).' MB per file.', false],
        ];
        foreach ($lines as $i => [$text, $bold]) {
            $ws->setCellValue('A'.($i + 1), $text);
            $ws->getStyle('A'.($i + 1))->getFont()->setBold($bold)->setSize($i === 0 ? 16 : ($bold ? 13 : 11));
            $ws->getStyle('A'.($i + 1))->getAlignment()->setWrapText(true);
        }
    }

    private static function sheet(Spreadsheet $book, string $title, array $cols, array $rows): void
    {
        $ws = $book->createSheet()->setTitle($title);
        $listNames = array_keys(self::lists());
        foreach ($cols as $i => [$key, $header, $width, $kind, $required, $list, $help]) {
            $c = $i + 1;
            $letter = Coordinate::stringFromColumnIndex($c);
            $ws->setCellValue([$c, 1], $required ? "{$header} *" : $header);
            $ws->getColumnDimension($letter)->setWidth($width);
            $style = $ws->getStyle("{$letter}1");
            $style->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
            $style->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB($kind === 'readonly' ? 'FF6B7280' : ($required ? self::ACCENT : 'FF374151'));
            $style->getAlignment()->setWrapText(true)->setVertical('center');
            if ($help) {
                $ws->getComment("{$letter}1")->getText()->createText($help);
            }
            if (in_array($kind, ['lines', 'long'], true)) {
                $ws->getStyle("{$letter}2:{$letter}".(count($rows) + 300))->getAlignment()->setWrapText(true)->setVertical('top');
            }
            if ($list) {
                $li = Coordinate::stringFromColumnIndex(array_search($list, $listNames, true) + 1);
                $n = count(self::lists()[$list]) + 1;
                $v = new DataValidation;
                $v->setType(DataValidation::TYPE_LIST)->setAllowBlank(true)->setShowDropDown(true)->setShowErrorMessage(true)
                    ->setErrorTitle($header)->setError('Pick a value from the list.')->setFormula1("Lists!\${$li}\$2:\${$li}\${$n}");
                $ws->setDataValidation("{$letter}2:{$letter}".max(count($rows) + 200, 300), $v);
            }
        }
        $ws->getRowDimension(1)->setRowHeight(32);
        $ws->freezePane('A2');
        foreach ($rows as $r => $row) {
            foreach ($cols as $i => [$key]) {
                $ws->setCellValueExplicit([$i + 1, $r + 2], (string) ($row[$key] ?? ''), is_numeric($row[$key] ?? null) ? 'n' : 's');
            }
        }
    }

    // ───────────── Import ─────────────

    /**
     * Reads and validates the whole file without saving anything.
     *
     * @return array{rows: array<int, array{row: int, name: string, slug: string, action: string, errors: string[], notes: string[]}>, problems: string[], inputs: array}
     */
    public static function plan(string $file): array
    {
        try {
            $book = IOFactory::createReader('Xlsx')->setReadDataOnly(true)->load($file);
        } catch (Throwable) {
            return ['rows' => [], 'problems' => ['This is not a valid .xlsx file. Save it from Excel as “Excel Workbook (.xlsx)”.'], 'inputs' => []];
        }
        $tools = self::read($book->getSheetByName('Tools'), self::toolCols());
        $parts = self::read($book->getSheetByName('Parts'), self::partCols());
        $refs = self::read($book->getSheetByName('References'), self::refCols());
        $problems = [];
        if (! $tools) {
            return ['rows' => [], 'problems' => ['The file has no “Tools” sheet. Start from the template.'], 'inputs' => []];
        }
        foreach (['Tools' => $tools, 'Parts' => $parts, 'References' => $refs] as $name => $s) {
            if ($s && $s['missing']) {
                $problems[] = "{$name} sheet is missing column(s): ".implode(', ', $s['missing']).'.';
            }
        }
        if (! $tools['rows']) {
            $problems[] = 'The Tools sheet has no tools.';
        }
        if (count($tools['rows']) > self::MAX_ROWS) {
            $problems[] = 'Too many tools ('.count($tools['rows']).'). Import at most '.self::MAX_ROWS.' at a time.';
        }
        if ($problems) {
            return ['rows' => [], 'problems' => $problems, 'inputs' => []];
        }

        $existing = Tool::all(['id', 'slug', 'data', 'name']);
        $byId = $existing->keyBy('id');
        $bySlug = $existing->keyBy('slug');
        $norm = fn ($s) => trim(preg_replace('/\s+/', ' ', str_replace('*', '', mb_strtolower((string) $s))));

        $slugs = array_map(fn ($r) => $r['slug'] ?: Str::slug($r['name']), $tools['rows']);
        $keyOf = [];
        foreach ($tools['rows'] as $n => $r) {
            $keyOf[$norm($slugs[$n])] = $n;
            if ($r['name'] !== '') {
                $keyOf[$norm($r['name'])] = $n;
            }
        }
        $group = function (?array $sheet, string $label) use ($keyOf, $norm, &$problems) {
            $out = [];
            foreach ($sheet['rows'] ?? [] as $r) {
                $n = $keyOf[$norm($r['tool'])] ?? null;
                if ($n === null) {
                    $problems[] = "{$label} row {$r['_row']}: no tool “".($r['tool'] ?: '(blank)').'” on the Tools sheet.';

                    continue;
                }
                $out[$n][] = $r;
            }

            return $out;
        };
        $partsOf = $group($parts, 'Parts');
        $refsOf = $group($refs, 'References');

        $pick = function (string $raw, array $options) use ($norm) {
            foreach ($options as $k => $label) {
                $code = is_int($k) ? $label : $k;
                if ($norm($code) === $norm($raw) || $norm($label) === $norm($raw)) {
                    return $code;
                }
            }

            return null;
        };
        $lists = self::lists();
        $seenSlug = $seenId = [];
        $rows = $inputs = [];

        foreach ($tools['rows'] as $n => $r) {
            $errors = $notes = [];
            $slug = $slugs[$n];
            $match = null;
            if ($r['id'] !== '') {
                $match = $byId[$r['id']] ?? null;
                if (! $match) {
                    $errors[] = 'ID: no tool has this ID. Clear the ID cell to create a new tool.';
                }
            } else {
                $match = $bySlug[$slug] ?? null;
            }
            $owner = $bySlug[$slug] ?? null;
            if ($owner && $match && $owner->id !== $match->id) {
                $errors[] = "Slug: “{$slug}” is already used by “{$owner->name}”.";
            }
            if (isset($seenSlug[$slug])) {
                $errors[] = "Slug: “{$slug}” is also on row {$seenSlug[$slug]}.";
            }
            $seenSlug[$slug] = $r['_row'];
            if ($match) {
                if (isset($seenId[$match->id])) {
                    $errors[] = "This tool is also on row {$seenId[$match->id]}.";
                }
                $seenId[$match->id] = $r['_row'];
            }
            foreach (self::toolCols() as [$key, $header, , , $required]) {
                if ($required && $r[$key] === '') {
                    $errors[] = "{$header}: required.";
                }
            }
            $choose = function (string $key, array $options, string $header) use ($r, $pick, &$errors) {
                if ($r[$key] === '') {
                    return '';
                }
                $v = $pick($r[$key], $options);
                if ($v === null) {
                    $errors[] = "{$header}: “{$r[$key]}” is not one of the allowed values.";
                }

                return $v ?? $r[$key];
            };
            $yes = function (string $key, string $header) use ($r, $norm, &$errors) {
                $v = $norm($r[$key]);
                if ($v === '' || in_array($v, ['no', 'n', 'false', '0'], true)) {
                    return false;
                }
                if (in_array($v, ['yes', 'y', 'true', '1', 'x'], true)) {
                    return true;
                }
                $errors[] = "{$header}: write Yes or No.";

                return false;
            };
            $num = function (string $key, string $header) use ($r, &$errors) {
                if ($r[$key] === '') {
                    return null;
                }
                $v = str_replace(',', '.', $r[$key]);
                if (! is_numeric($v)) {
                    $errors[] = "{$header}: “{$r[$key]}” is not a number.";

                    return null;
                }

                return $v + 0;
            };

            $category = $choose('category', Catalog::CATEGORIES, 'Category');
            $sub = $choose('subcategory', Catalog::SUBCATEGORIES, 'Subcategory');
            $existingTool = $match?->data;
            $glb = $existingTool && Catalog::isGlb($existingTool['model3d']['file']) ? $existingTool['model3d']['file'] : null;

            $sheetParts = $partsOf[$n] ?? null;
            if ($sheetParts) {
                usort($sheetParts, fn ($a, $b) => [(int) ($a['n'] ?: PHP_INT_MAX), $a['_row']] <=> [(int) ($b['n'] ?: PHP_INT_MAX), $b['_row']]);
                $hotspots = array_map(fn ($p) => ['label' => $p['name'], 'description' => $p['purpose']], $sheetParts);
            } elseif ($existingTool) {
                $hotspots = array_map(fn ($h) => ['label' => $h['label'], 'description' => $h['description']], $existingTool['model3d']['hotspots']);
                $notes[] = 'Parts kept';
            } else {
                $hotspots = [];
                $errors[] = 'Parts: add the tool’s parts on the Parts sheet (3 for the placeholder model).';
            }
            $positions = null;
            if ($glb) {
                $placed = $existingTool['model3d']['hotspots'];
                if (count($hotspots) !== count($placed)) {
                    $errors[] = 'Parts: this tool has an AI 3D model with '.count($placed).' placed parts, but the file lists '.count($hotspots).'. Keep the same number, or change parts in the tool editor.';
                }
                $positions = array_column($placed, 'position');
                $notes[] = 'AI 3D model kept';
            }
            if (isset($refsOf[$n])) {
                $references = array_map(fn ($x) => ['title' => $x['title'], 'publisher' => $x['publisher'], 'section' => $x['section'], 'url' => $x['url']], $refsOf[$n]);
            } elseif ($existingTool) {
                $references = $existingTool['references'];
                $notes[] = 'References kept';
            } else {
                $references = [];
                $errors[] = 'References: add at least one on the References sheet.';
            }

            $raw = [
                'id' => $match?->id, 'name' => $r['name'], 'slug' => $r['slug'], 'category' => $category, 'subcategory' => $sub ?: null,
                'brand' => $choose('brand', Catalog::BRANDS, 'Brand'), 'model' => $r['model'], 'unitSystem' => $choose('unitSystem', Catalog::UNIT_SYSTEMS, 'Unit system'),
                'weight' => ['value' => $num('weight', 'Weight'), 'unit' => $choose('weightUnit', $lists['weightUnit'], 'Weight unit')],
                'dimensions' => ['length' => $num('length', 'Length'), 'width' => $num('width', 'Width'), 'height' => $num('height', 'Height'), 'unit' => $choose('sizeUnit', $lists['sizeUnit'], 'Size unit')],
                'aircraftApplications' => $r['aircraftApplications'], 'purpose' => $r['purpose'], 'howItWorks' => $r['howItWorks'],
                'howToUse' => $r['howToUse'], 'maintenance' => $r['maintenance'], 'safety' => $r['safety'],
                'archetype' => $choose('archetype', Catalog::archetypeNames(), 'Placeholder 3D model'), 'glb' => $glb,
                'hotspots' => $hotspots, 'hotspotPositions' => $positions,
                'voiceOver' => ['purpose' => $r['voPurpose'], 'howItWorks' => $r['voHowItWorks'], 'howToUse' => $r['voHowToUse'], 'maintenance' => $r['voMaintenance']],
                'video' => $r['videoFile'] !== '' ? ['file' => $r['videoFile'], 'durationSec' => $num('videoDuration', 'Video length (s)') ?? 8] : null,
                'references' => $references, 'tags' => $r['tags'],
                'isSampleData' => $yes('sample', 'Sample data'), 'isPublished' => $yes('published', 'Published'),
            ];
            if (! $errors) {
                try {
                    $inputs[] = ToolBuilder::validate($raw);
                } catch (ValidationException $e) {
                    foreach ($e->errors() as $field => $msgs) {
                        foreach ($msgs as $m) {
                            $errors[] = self::label($field).': '.$m;
                        }
                    }
                }
            }
            $rows[] = ['row' => $r['_row'], 'name' => $r['name'] ?: '(no name)', 'slug' => $slug, 'action' => $match ? 'update' : 'create', 'errors' => array_values(array_unique($errors)), 'notes' => $notes];
        }

        return ['rows' => $rows, 'problems' => $problems, 'inputs' => $inputs];
    }

    private static function label(string $field): string
    {
        $map = ['weight.value' => 'Weight', 'dimensions.length' => 'Length', 'dimensions.width' => 'Width', 'dimensions.height' => 'Height', 'video.durationSec' => 'Video length', 'hotspots' => 'Parts', 'references' => 'References'];
        if (preg_match('/^hotspots\.(\d+)/', $field, $m)) {
            return 'Parts row '.($m[1] + 1);
        }
        if (preg_match('/^references\.(\d+)/', $field, $m)) {
            return 'References row '.($m[1] + 1);
        }

        return $map[$field] ?? Str::headline(explode('.', $field)[0]);
    }

    /** @return array{rows: array, missing: string[]}|null */
    private static function read(?Worksheet $ws, array $cols): ?array
    {
        if (! $ws) {
            return null;
        }
        $norm = fn ($s) => trim(preg_replace('/\s+/', ' ', str_replace('*', '', mb_strtolower((string) $s))));
        $index = [];
        $highCol = Coordinate::columnIndexFromString($ws->getHighestDataColumn());
        for ($c = 1; $c <= $highCol; $c++) {
            $index[$norm(self::text($ws->getCell([$c, 1])->getValue()))] = $c;
        }
        $missing = array_values(array_map(fn ($c) => $c[1], array_filter($cols, fn ($c) => $c[4] && ! isset($index[$norm($c[1])]))));
        $rows = [];
        $high = $ws->getHighestDataRow();
        for ($r = 2; $r <= $high; $r++) {
            $row = ['_row' => $r];
            $blank = true;
            foreach ($cols as [$key, $header, , $kind]) {
                $at = $index[$norm($header)] ?? null;
                $v = $at ? self::text($ws->getCell([$at, $r])->getValue()) : '';
                if ($kind === 'lines') {
                    $v = array_values(array_filter(array_map('trim', preg_split('/\r?\n|\s\|\s/', $v)), fn ($s) => $s !== ''));
                } elseif ($key === 'tags') {
                    $v = array_values(array_filter(array_map('trim', explode(',', $v))));
                }
                if ($kind !== 'readonly' && $v !== '' && $v !== []) {
                    $blank = false;
                }
                $row[$key] = $v;
            }
            if (! $blank) {
                $rows[] = $row;
            }
        }

        return ['rows' => $rows, 'missing' => $missing];
    }

    private static function text(mixed $v): string
    {
        if ($v instanceof RichText) {
            return trim($v->getPlainText());
        }
        if (is_float($v) && floor($v) == $v && abs($v) < 1e15) {
            return (string) (int) $v;
        }

        return trim((string) ($v ?? ''));
    }
}
