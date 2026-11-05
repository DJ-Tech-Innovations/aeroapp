<?php

namespace App\Services;

use App\Models\AppSecret;
use App\Models\AppSetting;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Meshy multi-image → 3D (docs.meshy.ai). Provider-neutral return shape so the vendor can be swapped later.
 * Photos must be reachable by Meshy, so they are sent inline as data URIs (works on localhost and private hosts).
 */
final class MeshyProvider
{
    private const API = 'https://api.meshy.ai/openapi/v1';

    public const DEFAULTS = ['aiModel' => 'latest', 'targetPolycount' => 30000, 'enablePbr' => true];

    public function __construct(private string $key, private array $config) {}

    public static function make(): self
    {
        $key = AppSecret::reveal('meshy');
        if (! $key) {
            throw new RuntimeException('No Meshy API key yet. Add it in Settings → AI services.');
        }

        return new self($key, [...self::DEFAULTS, ...(array) AppSetting::get('meshy', [])]);
    }

    public static function balance(string $key): int
    {
        return (int) (self::call($key, 'GET', '/balance')['balance'] ?? 0);
    }

    /** @param  string[]  $imageDataUris */
    public function create(array $imageDataUris): string
    {
        $r = self::call($this->key, 'POST', '/multi-image-to-3d', [
            'image_urls' => $imageDataUris, 'ai_model' => $this->config['aiModel'], 'should_texture' => true,
            'enable_pbr' => (bool) $this->config['enablePbr'], 'should_remesh' => true, 'topology' => 'triangle',
            'target_polycount' => (int) $this->config['targetPolycount'], 'target_formats' => ['glb'],
        ]);

        return (string) ($r['result'] ?? throw new RuntimeException('Meshy did not return a task id.'));
    }

    /** @return array{status: 'processing'|'ready'|'failed', progress: int, glbUrl?: string, thumbnailUrl?: string, error?: string} */
    public function get(string $taskId): array
    {
        $t = self::call($this->key, 'GET', "/multi-image-to-3d/{$taskId}");
        $status = $t['status'] ?? '';
        if ($status === 'SUCCEEDED') {
            return empty($t['model_urls']['glb'])
                ? ['status' => 'failed', 'progress' => 100, 'error' => 'Meshy finished without a GLB file.']
                : ['status' => 'ready', 'progress' => 100, 'glbUrl' => $t['model_urls']['glb'], 'thumbnailUrl' => $t['thumbnail_url'] ?? null];
        }
        if (in_array($status, ['FAILED', 'CANCELED'], true)) {
            return ['status' => 'failed', 'progress' => (int) ($t['progress'] ?? 0), 'error' => $t['task_error']['message'] ?? 'Meshy task '.strtolower($status).'.'];
        }

        return ['status' => 'processing', 'progress' => (int) ($t['progress'] ?? 0)];
    }

    private static function call(string $key, string $method, string $path, ?array $body = null): array
    {
        $res = Http::withToken($key)->acceptJson()->timeout(60)->send($method, self::API.$path, $body ? ['json' => $body] : []);
        if ($res->status() === 401) {
            throw new RuntimeException('Meshy rejected the API key (401). Check it in Settings.');
        }
        if (! $res->successful()) {
            throw new RuntimeException("Meshy {$res->status()}: ".($res->json('message') ?? $res->reason()));
        }

        return (array) $res->json();
    }
}
