<?php

namespace App\Http\Controllers\Api;

use App\Domain\AttemptService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/** The signed-in learner's own profile. Roles can never be changed from here. */
class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        AttemptService::touchDay($user);

        return response()->json([
            'profile' => $user->toProfile(),
            'canAccessAdmin' => $user->canAccessAdmin(),
            'offlineDays' => config('aeroapp.offline_days'),
            'serverTime' => now()->toIso8601String(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'fullName' => ['sometimes', 'string', 'max:120'],
            'idNumber' => ['sometimes', 'nullable', 'string', 'max:60'],
            'school' => ['sometimes', 'nullable', 'string', 'max:160'],
            'section' => ['sometimes', 'nullable', 'string', 'max:60'],
        ]);
        $map = ['fullName' => 'full_name', 'idNumber' => 'id_number', 'school' => 'school', 'section' => 'section'];
        $user = $request->user();
        foreach ($data as $k => $v) {
            $user->{$map[$k]} = trim((string) $v);
        }
        $user->save();

        return response()->json(['profile' => $user->toProfile()]);
    }

    public function avatar(Request $request): JsonResponse
    {
        $request->validate(['avatar' => ['required', 'image', 'max:4096']]);
        $user = $request->user();
        $old = $user->avatar_path;
        $user->avatar_path = $request->file('avatar')->store("avatars/{$user->id}", 'public');
        $user->save();
        if ($old) {
            Storage::disk('public')->delete($old);
        }

        return response()->json(['profile' => $user->toProfile()]);
    }

    public function password(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);
        $user = $request->user();
        if (! Hash::check($data['current'], $user->password)) {
            throw ValidationException::withMessages(['current' => 'Your current password is incorrect.']);
        }
        $user->password = $data['password'];
        $user->save();

        return response()->json(['ok' => true]);
    }
}
