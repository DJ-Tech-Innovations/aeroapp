<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Catalog;
use App\Domain\ToolBuilder;
use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\AppSecret;
use App\Models\Media;
use App\Models\ModelJob;
use App\Models\Tool;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ToolController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $cat = (string) $request->query('category', '');
        $status = (string) $request->query('status', '');

        $tools = Tool::query()
            ->when($q, fn ($w) => $w->where(fn ($w) => $w->where('name', 'like', "%{$q}%")->orWhere('slug', 'like', "%{$q}%")))
            ->when($cat, fn ($w) => $w->where('category', $cat))
            ->when($status === 'published', fn ($w) => $w->where('is_published', true))
            ->when($status === 'draft', fn ($w) => $w->where('is_published', false))
            ->orderBy('sort_order')->orderBy('name')
            ->paginate((int) $request->query('size', 20))->withQueryString()
            ->through(fn (Tool $t) => [
                'id' => $t->id, 'name' => $t->name, 'slug' => $t->slug, 'category' => $t->category, 'subcategory' => $t->subcategory,
                'brand' => $t->brand, 'model' => $t->data['model'] ?? '', 'is_published' => $t->is_published,
                'hasGlb' => Catalog::isGlb($t->data['model3d']['file'] ?? ''), 'hasVideo' => ! empty($t->data['video']),
                'parts' => count($t->data['model3d']['hotspots'] ?? []), 'updated_at' => $t->updated_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/tools/index', [
            'tools' => $tools,
            'filters' => ['q' => $q, 'category' => $cat, 'status' => $status],
            'counts' => Tool::selectRaw('category, COUNT(*) as n')->groupBy('category')->pluck('n', 'category'),
            'total' => Tool::count(),
        ]);
    }

    public function create(): Response
    {
        return $this->editor(null);
    }

    public function edit(Tool $tool): Response
    {
        return $this->editor($tool);
    }

    public function store(Request $request): RedirectResponse
    {
        $tool = ToolBuilder::persist(ToolBuilder::validate([...$request->all(), 'id' => null]));
        Activity::record('tool.created', $tool->name);

        return redirect()->route('admin.tools.edit', $tool)->with('success', 'Tool created. Publish a new content pack to deliver it to learners.');
    }

    public function update(Request $request, Tool $tool): RedirectResponse
    {
        $saved = ToolBuilder::persist(ToolBuilder::validate([...$request->all(), 'id' => $tool->id]));
        Activity::record('tool.updated', $saved->name);

        return back()->with('success', 'Saved. Publish a new content pack to deliver this change to learners.');
    }

    public function destroy(Tool $tool): RedirectResponse
    {
        $name = $tool->name;
        Storage::disk('public')->deleteDirectory("model-sources/{$tool->id}");
        Storage::disk('public')->deleteDirectory("models/{$tool->id}");
        $tool->delete();
        Activity::record('tool.deleted', $name);

        return redirect()->route('admin.tools.index')->with('success', "“{$name}” deleted. It leaves the learners' catalogue in your next pack.");
    }

    public function togglePublished(Tool $tool): RedirectResponse
    {
        $tool->update(['is_published' => ! $tool->is_published]);

        return back()->with('success', $tool->is_published ? "“{$tool->name}” will be in the next pack." : "“{$tool->name}” is now a draft.");
    }

    private function editor(?Tool $tool): Response
    {
        return Inertia::render('admin/tools/edit', [
            'tool' => $tool?->data,
            'published' => $tool?->is_published ?? true,
            'archetypes' => collect(Catalog::archetypeNames())->map(fn ($n) => ['name' => $n, 'animations' => array_column(Catalog::archetypes()[$n]['animations'], 'name')]),
            'videos' => Media::where('kind', 'video')->orderBy('name')->pluck('path')->prepend('videos/placeholder.mp4')->unique()->values(),
            'jobs' => $tool ? ModelJob::where('tool_id', $tool->id)->latest()->get()->map->toClient() : [],
            'photos' => $tool ? ModelJob::photos($tool->id) : [],
            'ai' => ['meshy' => (bool) AppSecret::reveal('meshy'), 'anthropic' => (bool) AppSecret::reveal('anthropic')],
            'catalog' => [
                'categories' => Catalog::CATEGORIES, 'subcategories' => Catalog::SUBCATEGORIES, 'subs' => Catalog::SUBS,
                'brands' => Catalog::BRANDS, 'unitSystems' => Catalog::UNIT_SYSTEMS,
            ],
        ]);
    }
}
