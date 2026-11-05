<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

/**
 * API keys (Meshy, Anthropic) entered on the Settings page. Encrypted with APP_KEY, decrypted only inside
 * server services, and never sent to a browser (the UI only ever sees the last 4 characters).
 */
class AppSecret extends Model
{
    protected $primaryKey = 'name';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected $hidden = ['value'];

    public static function reveal(string $name): ?string
    {
        $row = static::find($name);
        $env = ['meshy' => env('MESHY_API_KEY'), 'anthropic' => env('ANTHROPIC_API_KEY')][$name] ?? null;

        return $row ? rescue(fn () => Crypt::decryptString($row->value), $env, false) : $env;
    }

    public static function store(string $name, string $value): void
    {
        static::updateOrCreate(['name' => $name], ['value' => Crypt::encryptString($value), 'last4' => substr($value, -4)]);
    }

    /** @return array<string, array{set: bool, last4: string|null, source: string|null, updatedAt: string|null}> */
    public static function summary(array $names): array
    {
        $rows = static::whereIn('name', $names)->get()->keyBy('name');
        $env = ['meshy' => env('MESHY_API_KEY'), 'anthropic' => env('ANTHROPIC_API_KEY')];
        $out = [];
        foreach ($names as $n) {
            $r = $rows[$n] ?? null;
            $out[$n] = [
                'set' => (bool) ($r || ($env[$n] ?? null)),
                'last4' => $r?->last4 ?? (($env[$n] ?? null) ? substr($env[$n], -4) : null),
                'source' => $r ? 'settings' : (($env[$n] ?? null) ? 'env' : null),
                'updatedAt' => $r?->updated_at?->toIso8601String(),
            ];
        }

        return $out;
    }
}
