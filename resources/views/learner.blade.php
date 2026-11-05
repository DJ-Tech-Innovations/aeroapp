<!DOCTYPE html>
<html lang="en" class="h-full">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="theme-color" content="#172554">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="description" content="Learn aircraft maintenance tools with 3D models, narration and quizzes — works offline.">
        <title>{{ config('app.name') }}</title>
        <link rel="manifest" href="/manifest.webmanifest">
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
        <script>
            try { var s = JSON.parse(localStorage.getItem('aeroapp.settings') || '{}').state || {}; var t = s.theme || 'system'; if (t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); } catch (e) {}
            window.AEROAPP = { version: @json(config('aeroapp.version')), name: @json(config('app.name')), bundledPack: @json(config('aeroapp.bundled_pack')) };
        </script>
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/learner/main.tsx'])
    </head>
    <body class="h-full">
        <div id="learner-root"></div>
        <noscript>AeroApp needs JavaScript to run.</noscript>
    </body>
</html>
