<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Photo → 3D model generations (Meshy). Finished files are copied into our own storage;
        // provider URLs expire and are never the source of truth.
        Schema::create('model_jobs', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('tool_id')->constrained('tools')->cascadeOnDelete();
            $t->string('provider', 30)->default('meshy');
            $t->string('provider_task_id')->nullable();
            $t->enum('status', ['queued', 'processing', 'ready', 'failed'])->default('queued');
            $t->unsignedTinyInteger('progress')->default(0);
            $t->json('source_paths');
            $t->string('glb_path')->nullable();
            $t->string('thumbnail_path')->nullable();
            $t->unsignedBigInteger('size_bytes')->nullable();
            $t->text('error')->nullable();
            $t->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['tool_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('model_jobs');
    }
};
