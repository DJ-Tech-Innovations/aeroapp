<?php

namespace App\Http\Controllers\Admin;

use App\Domain\PackService;
use App\Http\Controllers\Controller;
use App\Models\ContentPack;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

class PackController extends Controller
{
    public function index(Request $request): Response
    {
        $latest = PackService::latestPublished();
        $payload = PackService::buildPayload();
        $draft = PackService::namedChangelog($latest['payload'] ?? null, $payload);

        // Versions sort by semver in PHP (not SQL); there are only ever a few hundred, so paginate the collection.
        $all = ContentPack::sorted()->load('publisher:id,full_name');
        $page = max(1, (int) $request->query('page', 1));
        $per = 10;
        $packs = new LengthAwarePaginator(
            $all->forPage($page, $per)->values()->map(fn (ContentPack $p) => [
                'version' => $p->version, 'releasedAt' => $p->released_at->toIso8601String(), 'tools' => $p->tool_count, 'quizzes' => $p->quiz_count,
                'size' => $p->size_bytes, 'sha256' => $p->sha256, 'isPublished' => $p->is_published, 'minAppVersion' => $p->min_app_version,
                'changelog' => $p->changelog, 'publisher' => $p->publisher?->full_name,
            ]),
            $all->count(), $per, $page, ['path' => $request->url(), 'query' => $request->query()],
        );

        return Inertia::render('admin/packs', [
            'packs' => $packs,
            'latest' => $latest ? ['version' => $latest['row']->version, 'tools' => $latest['row']->tool_count, 'quizzes' => $latest['row']->quiz_count] : null,
            'draft' => $draft,
            'changes' => PackService::changeCount($draft),
            'next' => ['tools' => count($payload['tools']), 'quizzes' => count($payload['quizzes'])],
            'problems' => PackService::validate($payload),
            'suggested' => PackService::suggestVersion(),
            'appVersion' => config('aeroapp.version'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'version' => ['required', 'string'],
            'minAppVersion' => ['required', 'string'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $pack = PackService::publish($data['version'], $data['minAppVersion'], $data['notes'] ?? null, $request->user()->id);

        return back()->with('success', "Published v{$pack->version}: {$pack->tool_count} tools, {$pack->quiz_count} quizzes (SHA-256 ".substr($pack->sha256, 0, 12).'…). Learners can install it from Settings → Content updates.');
    }

    public function toggle(ContentPack $pack): RedirectResponse
    {
        PackService::setPublished($pack, ! $pack->is_published);

        return back()->with('success', $pack->is_published ? "v{$pack->version} is available again." : "v{$pack->version} withdrawn — learners won't be offered it.");
    }

    public function download(ContentPack $pack)
    {
        $text = PackService::read($pack->version);
        abort_if($text === null, 404);

        return response($text, 200, ['Content-Type' => 'application/json', 'Content-Disposition' => "attachment; filename=\"pack-{$pack->version}.json\""]);
    }
}
