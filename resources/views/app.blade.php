<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="theme-color" content="#172554">
        <script>
            // Apply the saved theme before first paint.
            try { var t = localStorage.getItem('aeroapp.theme') || 'system'; if (t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); } catch (e) {}
        </script>
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="{{ request()->is('admin*') ? 'AeroApp Admin' : 'AeroApp' }}">
        {{-- Admin pages install as "AeroApp Admin"; sign-in pages install the learner app. --}}
        <link rel="manifest" href="{{ request()->is('admin*') ? '/admin.webmanifest' : '/manifest.webmanifest' }}">
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        <x-inertia::head>
            <title>{{ config('app.name') }}</title>
        </x-inertia::head>
    </head>
    <body class="h-full">
        <x-inertia::app />
    </body>
</html>
