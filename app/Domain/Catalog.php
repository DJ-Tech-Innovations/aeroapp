<?php

namespace App\Domain;

/** Enumerations shared with resources/js/shared (types.ts, format.ts, archetypes.json). */
final class Catalog
{
    public const CATEGORIES = ['power' => 'Power Tools', 'common' => 'Common Tools', 'measuring' => 'Measuring Tools', 'special' => 'Special Tools'];

    public const SUBCATEGORIES = ['pneumatic' => 'Pneumatic', 'electric' => 'Electric', 'english' => 'English (imperial)', 'metric' => 'Metric'];

    /** Which subcategories each category allows. */
    public const SUBS = ['power' => ['pneumatic', 'electric'], 'measuring' => ['english', 'metric'], 'common' => [], 'special' => []];

    public const BRANDS = ['Milwaukee', 'INGCO', 'Stanley', 'Aviation Specialty'];

    public const UNIT_SYSTEMS = ['english' => 'English', 'metric' => 'Metric', 'dual' => 'Dual (English + Metric)', 'na' => 'Not applicable'];

    public const WEIGHT_UNITS = ['kg', 'g', 'lb', 'oz'];

    public const SIZE_UNITS = ['mm', 'cm', 'in'];

    public const QUESTION_TYPES = ['mcq' => 'Multiple choice', 'true_false' => 'True / False', 'identify_tool' => 'Identify the tool (3D)', 'identify_part' => 'Identify the part (hotspot)'];

    private static ?array $archetypes = null;

    /** @return array<string, array{parts: array, anchors: array, animations: array}> */
    public static function archetypes(): array
    {
        return self::$archetypes ??= json_decode(file_get_contents(resource_path('js/shared/archetypes.json')), true);
    }

    /** @return string[] */
    public static function archetypeNames(): array
    {
        $n = array_keys(self::archetypes());
        sort($n);

        return $n;
    }

    public static function isGlb(string $file): bool
    {
        return (bool) preg_match('/\.glb(\?|$)/i', $file);
    }

    public static function archetypeOf(string $file): ?string
    {
        return str_starts_with($file, 'procedural://') ? substr($file, strlen('procedural://')) : null;
    }
}
