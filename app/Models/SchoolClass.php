<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** A class section (e.g. AMT-1A) taught by one instructor. "Class" is a PHP reserved word, hence SchoolClass. */
class SchoolClass extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'classes';

    protected $fillable = ['name', 'instructor_id'];

    public function instructor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'instructor_id');
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'class_members', 'class_id', 'student_id');
    }
}
