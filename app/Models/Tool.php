<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** Authoring row. `data` is the full shared `Tool` object. */
class Tool extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['data' => 'array', 'is_published' => 'boolean', 'sort_order' => 'integer'];
    }
}
