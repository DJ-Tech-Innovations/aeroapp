<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;

/**
 * Serves /sw.js with the current build's version and pre-cache list baked in. Because the bytes change on every
 * build, browsers pick up new app versions automatically (and the learner can apply them from Settings).
 */
class ServiceWorkerController extends Controller
{
    public function __invoke(): Response
    {
        $manifestPath = public_path('build/manifest.json');
        $manifest = is_file($manifestPath) ? json_decode(file_get_contents($manifestPath), true) : [];
        $files = [];
        $visit = function (string $key) use (&$visit, &$files, $manifest) {
            $chunk = $manifest[$key] ?? null;
            if (! $chunk || isset($files['/build/'.$chunk['file']])) {
                return;
            }
            $files['/build/'.$chunk['file']] = true;
            foreach ([...($chunk['css'] ?? []), ...($chunk['assets'] ?? [])] as $f) {
                $files['/build/'.$f] = true;
            }
            foreach ([...($chunk['imports'] ?? []), ...($chunk['dynamicImports'] ?? [])] as $k) {
                $visit($k);
            }
        };
        $visit('resources/js/learner/main.tsx');
        $visit('resources/css/app.css');
        // Fonts: only woff2 is ever requested by modern browsers.
        $precache = array_values(array_filter(array_keys($files), fn ($f) => ! preg_match('/\.(eot|woff|ttf)$/', $f)));
        $bundled = config('aeroapp.bundled_pack');
        $precache = [...$precache, '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png',
            "/packs/pack-{$bundled}.json", "/packs/pack-{$bundled}.manifest.json", '/media/placeholder.mp4'];

        $version = substr(md5((is_file($manifestPath) ? md5_file($manifestPath) : 'dev').config('aeroapp.version')), 0, 12);
        $js = 'const VERSION = '.json_encode($version).";\nconst PRECACHE = ".json_encode($precache, JSON_UNESCAPED_SLASHES).";\n"
            .file_get_contents(resource_path('sw/sw.js'));

        return response($js, 200, [
            'Content-Type' => 'application/javascript; charset=utf-8',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Service-Worker-Allowed' => '/app',
        ]);
    }
}
