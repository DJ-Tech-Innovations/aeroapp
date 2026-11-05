<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\AppSetting;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SessionController extends Controller
{
    public function create(Request $request): Response
    {
        return Inertia::render('auth/login', [
            'status' => session('status'),
            'expired' => $request->boolean('expired'),
            'screen' => AppSetting::get('login_screen', [
                'headline' => 'Know every tool before you touch the aircraft.',
                'message' => 'Interactive 3D models, narrated procedures and timed exams for aircraft maintenance students — online or offline.',
            ]),
            // Demo shortcuts are only offered outside production.
            'demoAccounts' => app()->isProduction() ? [] : [
                ['label' => 'Admin', 'email' => 'admin@demo.com'],
                ['label' => 'Instructor', 'email' => 'instructor@demo.com'],
                ['label' => 'Student', 'email' => 'student@demo.com'],
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse|\Symfony\Component\HttpFoundation\Response
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['boolean'],
        ]);
        $key = Str::lower($data['email']).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            throw ValidationException::withMessages(['email' => 'Too many sign-in attempts. Try again in '.RateLimiter::availableIn($key).' seconds.']);
        }

        if (! Auth::attempt(['email' => $data['email'], 'password' => $data['password']], $data['remember'] ?? true)) {
            RateLimiter::hit($key, 60);

            throw ValidationException::withMessages(['email' => 'Incorrect email or password.']);
        }
        RateLimiter::clear($key);

        /** @var User $user */
        $user = Auth::user();
        if (! $user->is_active) {
            Auth::logout();

            throw ValidationException::withMessages(['email' => 'This account has been deactivated. Contact your administrator.']);
        }

        $request->session()->regenerate();
        $user->forceFill(['last_login_at' => now()])->save();
        Activity::record('auth.login', $user->email);

        $intended = (string) $request->session()->pull('url.intended', '');
        $path = parse_url($intended, PHP_URL_PATH) ?? '';
        $target = $intended && $user->canAccessAdmin() && str_starts_with($path, '/admin') ? $intended : $user->homePath();

        // The learner PWA is its own SPA (not an Inertia page), so leave Inertia with a full page load.
        return str_starts_with(parse_url($target, PHP_URL_PATH) ?? '', '/admin') ? redirect()->to($target) : Inertia::location($target);
    }

    public function destroy(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['ok' => true]);
        }

        return Inertia::location('/login');
    }
}
