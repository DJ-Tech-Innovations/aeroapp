<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $t) {
            $t->string('label')->default('')->after('name');
            $t->string('description')->default('')->after('label');
            // System roles (super-admin, admin, instructor, student) can be edited but never deleted or renamed.
            $t->boolean('is_system')->default(false)->after('description');
        });
        Schema::table('permissions', function (Blueprint $t) {
            $t->string('group')->default('General')->after('name');
            $t->string('description')->default('')->after('group');
        });
    }

    public function down(): void
    {
        Schema::table('roles', fn (Blueprint $t) => $t->dropColumn(['label', 'description', 'is_system']));
        Schema::table('permissions', fn (Blueprint $t) => $t->dropColumn(['group', 'description']));
    }
};
