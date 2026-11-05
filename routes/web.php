<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Auth\PasswordController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\ServiceWorkerController;
use Illuminate\Support\Facades\Route;

// Root: signed-in users go to their area, guests to sign in.
Route::get('/', fn () => ($u = request()->user()) ? redirect($u->homePath()) : redirect()->route('login'))->name('home');

Route::middleware('guest')->group(function () {
    Route::get('/login', [SessionController::class, 'create'])->name('login');
    Route::post('/login', [SessionController::class, 'store'])->middleware('throttle:login');
    Route::get('/forgot-password', [PasswordController::class, 'request'])->name('password.request');
    Route::post('/forgot-password', [PasswordController::class, 'email'])->middleware('throttle:6,1')->name('password.email');
    Route::get('/reset-password/{token}', [PasswordController::class, 'edit'])->name('password.reset');
    Route::post('/reset-password', [PasswordController::class, 'update'])->name('password.update');
});
Route::post('/logout', [SessionController::class, 'destroy'])->middleware('auth')->name('logout');

// Learner PWA: one HTML shell for every /app route. It is NOT auth-gated on the server so the service worker
// can cache it and the app opens offline; the SPA checks the session through /api/me when online.
Route::view('/app/{any?}', 'learner')->where('any', '.*')->name('app');
Route::get('/sw.js', ServiceWorkerController::class)->name('sw');
Route::get('/.well-known/assetlinks.json', fn () => response()->json(config('aeroapp.android.package') ? [[
    'relation' => ['delegate_permission/common.handle_all_urls'],
    'target' => ['namespace' => 'android_app', 'package_name' => config('aeroapp.android.package'), 'sha256_cert_fingerprints' => array_values(config('aeroapp.android.sha256'))],
]] : []));

Route::prefix('admin')->name('admin.')->middleware(['auth', 'can:admin.access'])->group(function () {
    Route::get('/', Admin\DashboardController::class)->middleware('can:dashboard.view')->name('dashboard');

    Route::middleware('can:tools.view')->group(function () {
        Route::get('tools', [Admin\ToolController::class, 'index'])->name('tools.index');
        Route::get('tools/import', [Admin\ToolImportController::class, 'index'])->middleware('can:tools.import')->name('tools.import');
        Route::get('tools/import/template', [Admin\ToolImportController::class, 'template'])->middleware('can:tools.import')->name('tools.template');
        Route::get('tools/import/export', [Admin\ToolImportController::class, 'export'])->middleware('can:tools.import')->name('tools.export');
        Route::post('tools/import/check', [Admin\ToolImportController::class, 'check'])->middleware('can:tools.import')->name('tools.import.check');
        Route::post('tools/import/run', [Admin\ToolImportController::class, 'import'])->middleware('can:tools.import')->name('tools.import.run');
        Route::middleware('can:tools.manage')->group(function () {
            Route::get('tools/create', [Admin\ToolController::class, 'create'])->name('tools.create');
            Route::post('tools', [Admin\ToolController::class, 'store'])->name('tools.store');
            Route::put('tools/{tool}', [Admin\ToolController::class, 'update'])->name('tools.update');
            Route::delete('tools/{tool}', [Admin\ToolController::class, 'destroy'])->name('tools.destroy');
            Route::post('tools/{tool}/toggle', [Admin\ToolController::class, 'togglePublished'])->name('tools.toggle');
        });
        Route::get('tools/{tool}', [Admin\ToolController::class, 'edit'])->name('tools.edit');
        Route::middleware('can:tools.ai')->prefix('studio')->name('studio.')->group(function () {
            Route::post('tools/{tool}/photos', [Admin\ModelStudioController::class, 'uploadPhotos'])->name('photos');
            Route::delete('tools/{tool}/photos', [Admin\ModelStudioController::class, 'deletePhoto'])->name('photos.delete');
            Route::post('tools/{tool}/jobs', [Admin\ModelStudioController::class, 'start'])->name('jobs.start');
            Route::post('tools/{tool}/parts', [Admin\ModelStudioController::class, 'suggestParts'])->name('parts');
            Route::get('jobs/{job}', [Admin\ModelStudioController::class, 'poll'])->name('jobs.poll');
            Route::delete('jobs/{job}', [Admin\ModelStudioController::class, 'destroy'])->name('jobs.delete');
        });
    });

    Route::middleware('can:quizzes.view')->group(function () {
        Route::get('quizzes', [Admin\QuizController::class, 'index'])->name('quizzes.index');
        Route::middleware('can:quizzes.manage')->group(function () {
            Route::get('quizzes/create', [Admin\QuizController::class, 'create'])->name('quizzes.create');
            Route::post('quizzes', [Admin\QuizController::class, 'store'])->name('quizzes.store');
            Route::put('quizzes/{quiz}', [Admin\QuizController::class, 'update'])->name('quizzes.update');
            Route::delete('quizzes/{quiz}', [Admin\QuizController::class, 'destroy'])->name('quizzes.destroy');
        });
        Route::get('quizzes/{quiz}', [Admin\QuizController::class, 'edit'])->name('quizzes.edit');
    });

    Route::middleware('can:packs.view')->group(function () {
        Route::get('packs', [Admin\PackController::class, 'index'])->name('packs.index');
        Route::get('packs/{pack}/download', [Admin\PackController::class, 'download'])->name('packs.download');
        Route::post('packs', [Admin\PackController::class, 'store'])->middleware('can:packs.publish')->name('packs.store');
        Route::post('packs/{pack}/toggle', [Admin\PackController::class, 'toggle'])->middleware('can:packs.publish')->name('packs.toggle');
    });

    Route::middleware('can:media.view')->group(function () {
        Route::get('media', [Admin\MediaController::class, 'index'])->name('media.index');
        Route::post('media', [Admin\MediaController::class, 'store'])->middleware('can:media.manage')->name('media.store');
        Route::delete('media/{media}', [Admin\MediaController::class, 'destroy'])->middleware('can:media.manage')->name('media.destroy');
    });

    Route::middleware('can:classes.view')->group(function () {
        Route::get('classes', [Admin\ClassController::class, 'index'])->name('classes.index');
        Route::get('classes/{class}', [Admin\ClassController::class, 'show'])->name('classes.show');
        Route::middleware('can:classes.manage')->group(function () {
            Route::post('classes', [Admin\ClassController::class, 'store'])->name('classes.store');
            Route::put('classes/{class}', [Admin\ClassController::class, 'update'])->name('classes.update');
            Route::delete('classes/{class}', [Admin\ClassController::class, 'destroy'])->name('classes.destroy');
            Route::post('classes/{class}/members', [Admin\ClassController::class, 'addMembers'])->name('classes.members.add');
            Route::delete('classes/{class}/members/{user}', [Admin\ClassController::class, 'removeMember'])->name('classes.members.remove');
        });
    });

    Route::middleware('can:users.view')->group(function () {
        Route::get('users', [Admin\UserController::class, 'index'])->name('users.index');
        Route::middleware('can:users.manage')->group(function () {
            Route::post('users', [Admin\UserController::class, 'store'])->name('users.store');
            Route::put('users/{user}', [Admin\UserController::class, 'update'])->name('users.update');
            Route::post('users/{user}/toggle', [Admin\UserController::class, 'toggle'])->name('users.toggle');
            Route::delete('users/{user}', [Admin\UserController::class, 'destroy'])->name('users.destroy');
        });
    });

    Route::middleware('can:roles.manage')->group(function () {
        Route::get('roles', [Admin\RoleController::class, 'index'])->name('roles.index');
        Route::post('roles', [Admin\RoleController::class, 'store'])->name('roles.store');
        Route::put('roles/{role}', [Admin\RoleController::class, 'update'])->name('roles.update');
        Route::delete('roles/{role}', [Admin\RoleController::class, 'destroy'])->name('roles.destroy');
    });

    Route::get('results', [Admin\ReportController::class, 'results'])->middleware('can:reports.view')->name('results');
    Route::get('audit', [Admin\ReportController::class, 'audit'])->middleware('can:audit.view')->name('audit');

    Route::middleware('can:settings.manage')->group(function () {
        Route::get('settings', [Admin\SettingsController::class, 'index'])->name('settings');
        Route::put('settings/organization', [Admin\SettingsController::class, 'organization'])->name('settings.organization');
        Route::put('settings/login-screen', [Admin\SettingsController::class, 'loginScreen'])->name('settings.login');
        Route::put('settings/meshy', [Admin\SettingsController::class, 'meshy'])->name('settings.meshy');
        Route::put('settings/secrets/{name}', [Admin\SettingsController::class, 'secret'])->name('settings.secret');
    });

    Route::get('account', [Admin\SettingsController::class, 'account'])->name('account');
    Route::put('account', [Admin\SettingsController::class, 'updateAccount'])->name('account.update');
    Route::put('account/password', [Admin\SettingsController::class, 'updatePassword'])->name('account.password');
});

// Anything else: the branded 404 page.
Route::fallback(fn () => abort(404));
