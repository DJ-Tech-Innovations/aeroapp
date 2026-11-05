<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {

        // Super administrators pass every permission check.
        Gate::before(fn (User $user) => $user->isSuperAdmin() ? true : null);

        RateLimiter::for('login', fn (Request $r) => Limit::perMinute(10)->by(strtolower((string) $r->input('email')).'|'.$r->ip()));

        ResetPassword::createUrlUsing(fn (User $u, string $token) => url("/reset-password/{$token}?email=".urlencode($u->email)));
    }
}
