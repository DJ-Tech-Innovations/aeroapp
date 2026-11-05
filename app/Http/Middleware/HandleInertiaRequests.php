<?php

namespace App\Http\Middleware;

use App\Models\AppSetting;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'app' => [
                'name' => config('app.name'),
                'version' => config('aeroapp.version'),
                'org' => fn () => AppSetting::get('organization', ['name' => 'AeroApp', 'tagline' => 'Aircraft Tool Familiarization']),
                'demo' => ! app()->isProduction(),
            ],
            'auth' => [
                'user' => fn () => $request->user()?->toAuth(),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'status' => fn () => $request->session()->get('status'),
            ],
        ];
    }
}
