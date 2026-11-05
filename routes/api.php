<?php

use App\Http\Controllers\Api;
use App\Http\Controllers\Auth\SessionController;
use Illuminate\Support\Facades\Route;

// Cheap connectivity probe for the PWA ("am I really online?").
Route::get('/ping', fn () => response()->json(['ok' => true, 'time' => now()->toIso8601String()]))->name('api.ping');

// The learner PWA authenticates with the web session cookie (Sanctum SPA mode).
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [Api\MeController::class, 'show']);
    Route::patch('/me', [Api\MeController::class, 'update']);
    Route::post('/me/avatar', [Api\MeController::class, 'avatar']);
    Route::post('/me/password', [Api\MeController::class, 'password']);
    Route::post('/logout', [SessionController::class, 'destroy']);

    Route::get('/packs', [Api\PackController::class, 'index']);
    Route::get('/packs/latest', [Api\PackController::class, 'latest']);
    Route::get('/packs/{version}/download', [Api\PackController::class, 'download'])->where('version', '[0-9.]+');

    Route::get('/attempts', [Api\AttemptController::class, 'index']);
    Route::post('/attempts', [Api\AttemptController::class, 'store'])->middleware('throttle:60,1');
    Route::get('/spotlight', [Api\SpotlightController::class, 'show']);

    Route::prefix('instructor')->middleware('can:app.instruct')->group(function () {
        Route::get('/classes', [Api\InstructorController::class, 'classes']);
        Route::get('/roster', [Api\InstructorController::class, 'roster']);
        Route::get('/attempts', [Api\InstructorController::class, 'attempts']);
        Route::post('/spotlights', [Api\InstructorController::class, 'spotlight']);
        Route::delete('/spotlights', [Api\InstructorController::class, 'clearSpotlight']);
    });
});
