<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/** Deactivated accounts are signed out immediately (web) or refused (API). */
class EnsureActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && ! $user->is_active) {
            $token = $user->currentAccessToken();
            if ($token && method_exists($token, 'delete')) {
                $token->delete();
            }
            Auth::guard('web')->logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
            }
            if ($request->expectsJson()) {
                abort(403, 'This account has been deactivated.');
            }

            return redirect()->route('login')->withErrors(['email' => 'This account has been deactivated. Contact your administrator.']);
        }

        return $next($request);
    }
}
