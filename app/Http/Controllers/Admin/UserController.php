<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $role = (string) $request->query('role', '');
        $status = (string) $request->query('status', '');

        $users = User::query()->with('roles:id,name,label')
            ->when($q, fn ($w) => $w->where(fn ($w) => $w->where('full_name', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%")->orWhere('id_number', 'like', "%{$q}%")))
            ->when($role, fn ($w) => $w->role($role))
            ->when($status === 'active', fn ($w) => $w->where('is_active', true))
            ->when($status === 'inactive', fn ($w) => $w->where('is_active', false))
            ->orderBy('full_name')
            ->paginate((int) $request->query('size', 15))->withQueryString()
            ->through(fn (User $u) => $this->row($u));

        return Inertia::render('admin/users/index', [
            'users' => $users,
            'filters' => ['q' => $q, 'role' => $role, 'status' => $status],
            'roles' => $this->roleOptions(),
            'counts' => [
                'total' => User::count(),
                'active' => User::where('is_active', true)->count(),
                'inactive' => User::where('is_active', false)->count(),
                'recent' => User::where('last_login_at', '>=', now()->subDays(7))->count(),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $user = new User;
        $this->fill($user, $data);
        $user->password = $data['password'];
        $user->save();
        $this->syncRoles($request, $user, $data['roles']);
        Activity::record('user.created', $user->email, ['roles' => $data['roles']]);

        return back()->with('success', "Account created for {$user->email}.");
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $this->validated($request, $user);
        $this->fill($user, $data);
        if (! empty($data['password'])) {
            $user->password = $data['password'];
        }
        $user->save();
        $this->syncRoles($request, $user, $data['roles']);
        Activity::record('user.updated', $user->email, ['roles' => $data['roles']]);

        return back()->with('success', 'Changes saved.');
    }

    public function toggle(Request $request, User $user): RedirectResponse
    {
        abort_if($user->is($request->user()), 422, 'You cannot deactivate your own account.');
        abort_if($user->isSuperAdmin() && ! $request->user()->isSuperAdmin(), 403);
        $user->forceFill(['is_active' => ! $user->is_active])->save();
        Activity::record($user->is_active ? 'user.activated' : 'user.deactivated', $user->email);

        return back()->with('success', $user->is_active ? "{$user->email} can sign in again." : "{$user->email} was deactivated and signed out.");
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        abort_if($user->is($request->user()), 422, 'You cannot delete your own account.');
        abort_if($user->isSuperAdmin() && ! $request->user()->isSuperAdmin(), 403);
        if ($user->taughtClasses()->exists()) {
            return back()->with('error', 'This instructor still teaches a class. Reassign or delete the class first.');
        }
        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
        }
        $email = $user->email;
        $user->delete();
        Activity::record('user.deleted', $email);

        return back()->with('success', "{$email} was deleted.");
    }

    private function validated(Request $request, ?User $user = null): array
    {
        return $request->validate([
            'email' => ['required', 'email', 'max:160', Rule::unique('users', 'email')->ignore($user?->id)],
            'full_name' => ['required', 'string', 'max:120'],
            'id_number' => ['nullable', 'string', 'max:60'],
            'school' => ['nullable', 'string', 'max:160'],
            'section' => ['nullable', 'string', 'max:60'],
            'phone' => ['nullable', 'string', 'max:40'],
            'password' => [$user ? 'nullable' : 'required', Password::min(8)],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['string', Rule::exists('roles', 'name')],
            'is_active' => ['boolean'],
        ], ['roles.required' => 'Choose at least one role.']);
    }

    private function fill(User $user, array $data): void
    {
        $user->email = strtolower(trim($data['email']));
        $user->full_name = trim($data['full_name']);
        foreach (['id_number', 'school', 'section', 'phone'] as $k) {
            $user->{$k} = trim((string) ($data[$k] ?? ''));
        }
        if (array_key_exists('is_active', $data)) {
            $user->is_active = (bool) $data['is_active'];
        }
    }

    /** Only a super admin can hand out (or take away) the super-admin role. */
    private function syncRoles(Request $request, User $user, array $roles): void
    {
        $actor = $request->user();
        if (! $actor->isSuperAdmin()) {
            $roles = array_values(array_diff($roles, [User::SUPER_ADMIN]));
            if ($user->isSuperAdmin()) {
                $roles[] = User::SUPER_ADMIN;
            }
        }
        if ($user->is($actor) && $actor->isSuperAdmin() && ! in_array(User::SUPER_ADMIN, $roles, true)) {
            $roles[] = User::SUPER_ADMIN; // never lock yourself out
        }
        $user->syncRoles($roles);
    }

    private function roleOptions(): array
    {
        return Role::orderBy('id')->get(['name', 'label', 'description'])->map(fn ($r) => ['name' => $r->name, 'label' => $r->label ?: $r->name, 'description' => $r->description])->all();
    }

    private function row(User $u): array
    {
        return [
            'id' => $u->id, 'email' => $u->email, 'full_name' => $u->full_name, 'id_number' => $u->id_number, 'school' => $u->school,
            'section' => $u->section, 'phone' => $u->phone, 'is_active' => $u->is_active, 'avatar' => $u->avatarUrl(), 'initials' => $u->initials(),
            'roles' => $u->roles->map(fn ($r) => ['name' => $r->name, 'label' => $r->label ?: $r->name])->values(),
            'last_login_at' => $u->last_login_at?->toIso8601String(), 'created_at' => $u->created_at?->toIso8601String(),
        ];
    }
}
