<?php

namespace App\Http\Controllers\Admin;

use Anthropic\Client;
use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\AppSecret;
use App\Models\AppSetting;
use App\Services\MeshyProvider;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class SettingsController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('admin/settings', [
            'tab' => $request->query('tab', 'organization'),
            'organization' => AppSetting::get('organization', ['name' => 'AeroApp', 'tagline' => 'Aircraft Tool Familiarization']),
            'loginScreen' => AppSetting::get('login_screen', [
                'headline' => 'Know every tool before you touch the aircraft.',
                'message' => 'Interactive 3D models, narrated procedures and timed exams for aircraft maintenance students — online or offline.',
            ]),
            'meshy' => [...MeshyProvider::DEFAULTS, ...(array) AppSetting::get('meshy', [])],
            'secrets' => AppSecret::summary(['meshy', 'anthropic']),
            'canManage' => $request->user()->can('settings.manage'),
        ]);
    }

    public function organization(Request $request): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:60'], 'tagline' => ['nullable', 'string', 'max:120']]);
        AppSetting::put('organization', $data);
        Activity::record('settings.organization');

        return back()->with('success', 'Organization details saved.');
    }

    public function loginScreen(Request $request): RedirectResponse
    {
        $data = $request->validate(['headline' => ['required', 'string', 'max:120'], 'message' => ['nullable', 'string', 'max:400']]);
        AppSetting::put('login_screen', $data);
        Activity::record('settings.login_screen');

        return back()->with('success', 'Sign-in screen updated.');
    }

    public function meshy(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'aiModel' => ['required', Rule::in(['latest', 'meshy-6', 'meshy-6-lite'])],
            'targetPolycount' => ['required', 'integer', 'min:1000', 'max:300000'],
            'enablePbr' => ['boolean'],
        ]);
        AppSetting::put('meshy', $data);

        return back()->with('success', '3D generation defaults saved.');
    }

    /** Keys are checked before they are stored; the browser only ever sees the last 4 characters. */
    public function secret(Request $request, string $name): RedirectResponse
    {
        abort_unless(in_array($name, ['meshy', 'anthropic'], true), 404);
        $data = $request->validate(['value' => ['nullable', 'string', 'max:300']]);
        $value = trim((string) ($data['value'] ?? ''));

        if ($value === '') {
            AppSecret::where('name', $name)->delete();
            Activity::record('settings.secret_removed', $name);

            return back()->with('success', 'Key removed.');
        }
        try {
            if ($name === 'meshy') {
                MeshyProvider::balance($value);
            } else {
                (new Client(apiKey: $value))->models->retrieve('claude-opus-5-5');
            }
        } catch (Throwable $e) {
            throw ValidationException::withMessages(["{$name}" => 'That key was rejected: '.$e->getMessage()]);
        }
        AppSecret::store($name, $value);
        Activity::record('settings.secret_saved', $name);

        return back()->with('success', 'Key verified and saved (encrypted).');
    }

    public function account(Request $request): Response
    {
        $u = $request->user();

        return Inertia::render('admin/account', [
            'profile' => ['full_name' => $u->full_name, 'email' => $u->email, 'phone' => $u->phone, 'avatar' => $u->avatarUrl(), 'initials' => $u->initials()],
        ]);
    }

    public function updateAccount(Request $request): RedirectResponse
    {
        $u = $request->user();
        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($u->id)],
            'phone' => ['nullable', 'string', 'max:40'],
        ]);
        $u->forceFill(['full_name' => $data['full_name'], 'email' => strtolower($data['email']), 'phone' => $data['phone'] ?? ''])->save();

        return back()->with('success', 'Profile updated.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $data = $request->validate(['current' => ['required'], 'password' => ['required', 'confirmed', Password::min(8)]]);
        if (! Hash::check($data['current'], $request->user()->password)) {
            throw ValidationException::withMessages(['current' => 'Your current password is incorrect.']);
        }
        $request->user()->forceFill(['password' => $data['password']])->save();

        return back()->with('success', 'Password changed.');
    }
}
