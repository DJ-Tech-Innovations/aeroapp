<?php

namespace App\Models;

use App\Services\MeshyProvider;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Throwable;

/** One photo → 3D generation for a tool. Finished files live in public storage under models/<tool id>/. */
class ModelJob extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['source_paths' => 'array', 'progress' => 'integer', 'size_bytes' => 'integer'];
    }

    public static function photoFolder(string $toolId): string
    {
        return "model-sources/{$toolId}";
    }

    /** @return array<int, array{path: string, url: string, name: string}> */
    public static function photos(string $toolId): array
    {
        $disk = Storage::disk('public');

        return collect($disk->files(self::photoFolder($toolId)))
            ->sortByDesc(fn ($p) => $disk->lastModified($p))
            ->map(fn ($p) => ['path' => $p, 'url' => $disk->url($p), 'name' => basename($p)])->values()->all();
    }

    public function isPending(): bool
    {
        return in_array($this->status, ['queued', 'processing'], true);
    }

    public function toClient(): array
    {
        $disk = Storage::disk('public');

        return [
            'id' => $this->id, 'status' => $this->status, 'progress' => $this->progress, 'createdAt' => $this->created_at?->toIso8601String(),
            'error' => $this->error, 'sizeBytes' => $this->size_bytes,
            // Same-origin path: the learner app caches it for offline use like any other pack media.
            'glbUrl' => $this->glb_path ? '/storage/'.$this->glb_path : null,
            'thumbnailUrl' => $this->thumbnail_path ? $disk->url($this->thumbnail_path) : null,
            'photoUrls' => array_map(fn ($p) => $disk->url($p), $this->source_paths ?? []),
            'photoPaths' => $this->source_paths ?? [],
        ];
    }

    /** Polls the provider once; when done, copies the files into our storage (provider URLs expire). */
    public function refreshFromProvider(): self
    {
        if (! $this->isPending() || ! $this->provider_task_id) {
            return $this;
        }
        try {
            $task = MeshyProvider::make()->get($this->provider_task_id);
        } catch (Throwable $e) {
            $this->error = $e->getMessage(); // transient: keep polling

            return $this;
        }
        if ($task['status'] === 'failed') {
            $this->update(['status' => 'failed', 'error' => $task['error'] ?? 'Generation failed.']);

            return $this;
        }
        if ($task['status'] === 'processing') {
            $this->update(['status' => 'processing', 'progress' => min(99, $task['progress']), 'error' => null]);

            return $this;
        }

        // Only one request copies the files.
        $lock = Cache::lock("model-job:{$this->id}", 120);
        if (! $lock->get()) {
            return $this;
        }
        try {
            $disk = Storage::disk('public');
            $glb = Http::timeout(180)->get($task['glbUrl'])->throw()->body();
            $glbPath = "models/{$this->tool_id}/{$this->id}.glb";
            $disk->put($glbPath, $glb);
            $thumb = null;
            if (! empty($task['thumbnailUrl'])) {
                $thumb = rescue(function () use ($disk, $task) {
                    $p = "models/{$this->tool_id}/{$this->id}.png";
                    $disk->put($p, Http::timeout(60)->get($task['thumbnailUrl'])->throw()->body());

                    return $p;
                }, null, false);
            }
            $this->update(['status' => 'ready', 'progress' => 100, 'glb_path' => $glbPath, 'thumbnail_path' => $thumb, 'size_bytes' => strlen($glb), 'error' => null]);
        } catch (Throwable $e) {
            $this->update(['error' => 'Saving the model failed, retrying: '.$e->getMessage()]);
        } finally {
            $lock->release();
        }

        return $this;
    }
}
