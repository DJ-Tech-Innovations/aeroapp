<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Media extends Model
{
    use HasUuids;

    protected $table = 'media';

    protected $guarded = [];

    public function url(): string
    {
        return Storage::disk('public')->url($this->path);
    }

    public static function kindFor(string $mime, string $name): string
    {
        return match (true) {
            str_starts_with($mime, 'video/') => 'video',
            str_starts_with($mime, 'image/') => 'image',
            str_starts_with($mime, 'audio/') => 'audio',
            str_ends_with(strtolower($name), '.glb') => 'model',
            default => 'other',
        };
    }
}
