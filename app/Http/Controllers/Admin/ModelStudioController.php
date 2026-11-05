<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\ModelJob;
use App\Models\Tool;
use App\Services\MeshyProvider;
use App\Services\PartsSuggester;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/** JSON endpoints behind the tool editor's "3D model & parts" studio. */
class ModelStudioController extends Controller
{
    public function uploadPhotos(Request $request, Tool $tool): JsonResponse
    {
        $request->validate(['photos' => ['required', 'array', 'max:8'], 'photos.*' => ['image', 'mimes:jpeg,png,webp', 'max:20480']]);
        $added = [];
        foreach ($request->file('photos') as $f) {
            $name = now()->format('YmdHis').'-'.Str::slug(pathinfo($f->getClientOriginalName(), PATHINFO_FILENAME)).'.'.$f->extension();
            $path = $f->storeAs(ModelJob::photoFolder($tool->id), $name, 'public');
            $added[] = ['path' => $path, 'url' => Storage::disk('public')->url($path), 'name' => $name];
        }

        return response()->json(['photos' => $added]);
    }

    public function deletePhoto(Request $request, Tool $tool): JsonResponse
    {
        $path = $this->ownPath($tool, (string) $request->input('path'));
        Storage::disk('public')->delete($path);

        return response()->json(['ok' => true]);
    }

    public function start(Request $request, Tool $tool): JsonResponse
    {
        $data = $request->validate(['paths' => ['required', 'array', 'min:1', 'max:4'], 'paths.*' => ['string']]);
        $paths = array_map(fn ($p) => $this->ownPath($tool, $p), $data['paths']);
        try {
            $provider = MeshyProvider::make();
        } catch (Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        $job = ModelJob::create(['tool_id' => $tool->id, 'provider' => 'meshy', 'source_paths' => $paths, 'created_by' => $request->user()->id]);
        try {
            $disk = Storage::disk('public');
            $uris = array_map(fn ($p) => 'data:'.$disk->mimeType($p).';base64,'.base64_encode($disk->get($p)), $paths);
            $job->update(['provider_task_id' => $provider->create($uris), 'status' => 'processing']);
            Activity::record('model.generation_started', $tool->name);
        } catch (Throwable $e) {
            $job->update(['status' => 'failed', 'error' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage(), 'job' => $job->toClient()], 422);
        }

        return response()->json(['job' => $job->fresh()->toClient()]);
    }

    public function poll(ModelJob $job): JsonResponse
    {
        return response()->json(['job' => $job->refreshFromProvider()->toClient()]);
    }

    public function destroy(ModelJob $job): JsonResponse
    {
        $disk = Storage::disk('public');
        foreach (array_filter([$job->glb_path, $job->thumbnail_path]) as $p) {
            $disk->delete($p);
        }
        $job->delete();

        return response()->json(['ok' => true]);
    }

    public function suggestParts(Request $request, Tool $tool): JsonResponse
    {
        $data = $request->validate(['paths' => ['required', 'array', 'min:1', 'max:4'], 'paths.*' => ['string'], 'prompt' => ['nullable', 'string', 'max:2000']]);
        $paths = array_map(fn ($p) => $this->ownPath($tool, $p), $data['paths']);
        try {
            $parts = PartsSuggester::suggest($paths, $tool->data, (string) ($data['prompt'] ?? ''));
        } catch (Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        if (! $parts) {
            return response()->json(['message' => 'No parts were found in these photos. Try clearer photos or more specific instructions.'], 422);
        }

        return response()->json(['parts' => $parts]);
    }

    /** Photos must live in this tool's own library folder. */
    private function ownPath(Tool $tool, string $path): string
    {
        abort_unless(str_starts_with($path, ModelJob::photoFolder($tool->id).'/') && ! str_contains($path, '..'), 422, 'Invalid photo path.');

        return $path;
    }
}
