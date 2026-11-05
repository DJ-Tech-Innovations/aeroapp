<?php

use App\Http\Middleware\EnsureActive;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // The learner PWA calls /api/* with the same session cookie (Sanctum SPA auth).
        $middleware->statefulApi();
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
        $middleware->appendToGroup('web', EnsureActive::class);
        $middleware->appendToGroup('api', EnsureActive::class);
        $middleware->redirectGuestsTo('/login');
        $middleware->redirectUsersTo(fn (Request $r) => $r->user()?->homePath() ?? '/app');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Friendly, branded error pages (404, 403, 419, 429, 500, 503) instead of the framework defaults.
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            $status = $response->getStatusCode();
            if ($request->is('api/*') || $request->expectsJson() || ! in_array($status, [403, 404, 419, 429, 500, 503], true)) {
                return $response;
            }
            if ($status === 500 && app()->hasDebugModeEnabled()) {
                return $response; // keep the stack trace while developing
            }
            if ($status === 419) {
                return back()->with('error', 'The page expired. Please try again.');
            }

            return Inertia::render('error', ['status' => $status])
                ->toResponse($request)
                ->setStatusCode($status);
        });
    })->create();
