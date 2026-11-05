<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Authoring tables — admin only. Learners never read these (they read published_* below).
        Schema::create('tools', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('slug')->unique();
            $t->string('name');
            $t->enum('category', ['power', 'common', 'measuring', 'special']);
            $t->enum('subcategory', ['pneumatic', 'electric', 'english', 'metric'])->nullable();
            $t->string('brand');
            $t->enum('unit_system', ['english', 'metric', 'dual', 'na']);
            $t->unsignedInteger('sort_order')->default(0);
            $t->json('data');               // full Tool object (packages/shared contracts)
            $t->boolean('is_published')->default(true); // include in the next pack
            $t->timestamps();
            $t->index(['category', 'sort_order']);
        });

        Schema::create('quizzes', function (Blueprint $t) {
            $t->string('id')->primary();
            $t->string('title');
            $t->enum('mode', ['quiz', 'exam']);
            $t->unsignedInteger('sort_order')->default(0);
            $t->json('data');               // full Quiz object incl. questions + answer key
            $t->boolean('is_published')->default(true);
            $t->timestamps();
        });

        // Immutable, versioned releases. The pack file bytes are what the checksum covers.
        Schema::create('content_packs', function (Blueprint $t) {
            $t->string('version', 32)->primary();
            $t->string('min_app_version', 32)->default('1.0.0');
            $t->timestamp('released_at');
            $t->unsignedInteger('tool_count');
            $t->unsignedInteger('quiz_count');
            $t->unsignedBigInteger('size_bytes');
            $t->char('sha256', 64);
            $t->json('changelog');
            $t->string('storage_path');
            $t->boolean('is_published')->default(true);
            $t->foreignUuid('published_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_packs');
        Schema::dropIfExists('quizzes');
        Schema::dropIfExists('tools');
    }
};
