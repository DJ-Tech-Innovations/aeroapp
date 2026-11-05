<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Authoring row. `data` is the full shared `Quiz` object (incl. answer key). */
class Quiz extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['data' => 'array', 'is_published' => 'boolean', 'sort_order' => 'integer'];
    }
}
