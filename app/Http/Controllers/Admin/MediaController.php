<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Media;
use App\Models\Tool;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class MediaController extends Controller
{
    public function index(Request $request): Response
    {
        $kind = (string) $request->query('kind', '');
        $q = trim((string) $request->query('q', ''));
        $media = Media::query()
            ->when($kind, fn ($w) => $w->where('kind', $kind))
            ->when($q, fn ($w) => $w->where('name', 'like', "%{$q}%"))
            ->latest()->paginate(24)->withQueryString()
            ->through(fn (Media $m) => [
                'id' => $m->id, 'name' => $m->name, 'path' => $m->path, 'url' => $m->url(), 'kind' => $m->kind,
                'mime' => $m->mime, 'size' => $m->size, 'created_at' => $m->created_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/media', [
            'media' => $media,
            'filters' => ['kind' => $kind, 'q' => $q],
            'usage' => ['count' => Media::count(), 'bytes' => (int) Media::sum('size')],
            'maxMb' => 200,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'files' => ['required', 'array', 'max:10'],
            'files.*' => ['file', 'max:204800', 'mimetypes:video/mp4,video/webm,image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,model/gltf-binary,application/octet-stream'],
        ]);
        $n = 0;
        foreach ($request->file('files') as $file) {
            $kind = Media::kindFor((string) $file->getMimeType(), $file->getClientOriginalName());
            $folder = ['video' => 'videos', 'image' => 'images', 'audio' => 'audio', 'model' => 'models/library'][$kind] ?? 'files';
            $base = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)) ?: 'file';
            $name = $base.'-'.Str::lower(Str::random(5)).'.'.strtolower($file->getClientOriginalExtension() ?: 'bin');
            $path = $file->storeAs($folder, $name, 'public');
            Media::create([
                'path' => $path, 'name' => $file->getClientOriginalName(), 'mime' => (string) $file->getMimeType(),
                'size' => $file->getSize(), 'kind' => $kind, 'uploaded_by' => $request->user()->id,
            ]);
            $n++;
        }
        Activity::record('media.uploaded', "{$n} file(s)");

        return back()->with('success', "{$n} file(s) uploaded. Use the path (e.g. videos/…) in a tool's video field.");
    }

    public function destroy(Media $media): RedirectResponse
    {
        $inUse = Tool::where('data->video->file', $media->path)->pluck('name');
        if ($inUse->isNotEmpty()) {
            return back()->with('error', 'This file is used by: '.$inUse->take(5)->implode(', ').'. Change those tools first.');
        }
        Storage::disk('public')->delete($media->path);
        $media->delete();
        Activity::record('media.deleted', $media->name);

        return back()->with('success', "{$media->name} deleted.");
    }
}
