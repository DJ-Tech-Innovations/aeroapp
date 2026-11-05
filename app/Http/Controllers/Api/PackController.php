<?php

namespace App\Http\Controllers\Api;

use App\Domain\PackService;
use App\Http\Controllers\Controller;
use App\Models\ContentPack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/** Learners only ever see published packs, and only through these endpoints. */
class PackController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'packs' => ContentPack::sorted(true)->map->toManifest()->values(),
        ]);
    }

    public function latest(): JsonResponse
    {
        return response()->json(['manifest' => ContentPack::live()?->toManifest()]);
    }

    /** The exact stored bytes the manifest checksum covers. */
    public function download(string $version): Response
    {
        $pack = ContentPack::published()->findOrFail($version);
        $text = PackService::read($pack->version);
        abort_if($text === null, 404, 'Pack file missing.');

        return response($text, 200, [
            'Content-Type' => 'application/json',
            'Content-Length' => (string) strlen($text),
            'Cache-Control' => 'private, max-age=31536000, immutable',
            'X-Content-SHA256' => $pack->sha256,
        ]);
    }
}
