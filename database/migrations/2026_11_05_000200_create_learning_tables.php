<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attempts', function (Blueprint $t) {
            $t->uuid('id')->primary();                  // client-generated on mobile → idempotent sync
            $t->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $t->string('quiz_id')->index();             // deliberately not a FK: history survives pack updates
            $t->string('quiz_title');
            $t->enum('quiz_mode', ['quiz', 'exam']);
            $t->string('pack_version', 32);
            $t->json('question_order');
            $t->json('choice_order');
            $t->json('answers');
            $t->decimal('score', 8, 2)->default(0);
            $t->decimal('max_score', 8, 2)->default(0);
            $t->boolean('passed')->default(false);
            $t->decimal('client_score', 8, 2)->nullable(); // what the device claimed (audit)
            $t->enum('source', ['web', 'mobile'])->default('web');
            $t->timestamp('started_at');
            $t->timestamp('submitted_at')->nullable();  // null = in progress (web)
            $t->timestamps();
            $t->index(['user_id', 'quiz_id']);
        });

        Schema::create('spotlights', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('class_id')->constrained('classes')->cascadeOnDelete();
            $t->string('tool_id');
            $t->string('note')->default('');
            $t->string('instructor_name')->default('');
            $t->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['class_id', 'created_at']);
        });

        Schema::create('tool_views', function (Blueprint $t) {
            $t->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $t->string('tool_id');
            $t->unsignedInteger('views')->default(1);
            $t->timestamp('first_viewed_at');
            $t->timestamp('last_viewed_at');
            $t->primary(['user_id', 'tool_id']);
        });

        Schema::create('activity_days', function (Blueprint $t) {
            $t->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $t->date('day');
            $t->primary(['user_id', 'day']);
        });

        Schema::create('media', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('path')->unique();   // on the public disk, e.g. videos/placeholder.mp4
            $t->string('name');
            $t->string('mime', 120);
            $t->unsignedBigInteger('size');
            $t->enum('kind', ['video', 'image', 'model', 'audio', 'other']);
            $t->foreignUuid('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('app_settings', function (Blueprint $t) {
            $t->string('key')->primary();
            $t->json('value');
            $t->timestamps();
        });
        Schema::create('app_secrets', function (Blueprint $t) {
            $t->string('name')->primary();
            $t->text('value');              // Crypt-encrypted; never sent to a browser
            $t->string('last4', 8);
            $t->timestamps();
        });

        Schema::create('activity_log', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('action', 60);       // e.g. pack.published, tool.updated
            $t->string('subject')->default('');
            $t->json('meta')->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->index('created_at');
        });
    }

    public function down(): void
    {
        foreach (['activity_log', 'app_secrets', 'app_settings', 'media', 'activity_days', 'tool_views', 'spotlights', 'attempts'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
