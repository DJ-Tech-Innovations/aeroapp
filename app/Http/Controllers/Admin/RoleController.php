<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    public function index(Request $request): Response
    {
        $roles = Role::with('permissions:id,name')->withCount('users')->orderBy('id')->get();
        $selected = $roles->firstWhere('name', $request->query('role')) ?? $roles->first();

        return Inertia::render('admin/roles', [
            'roles' => $roles->map(fn (Role $r) => [
                'id' => $r->id, 'name' => $r->name, 'label' => $r->label ?: $r->name, 'description' => $r->description,
                'isSystem' => (bool) $r->is_system, 'users' => $r->users_count,
                'permissions' => $r->permissions->pluck('name')->values(),
                'isSuper' => $r->name === User::SUPER_ADMIN,
            ]),
            'permissions' => Permission::orderBy('id')->get(['id', 'name', 'group', 'description']),
            'selected' => $selected?->name,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:60'],
            'description' => ['nullable', 'string', 'max:200'],
            'copyFrom' => ['nullable', 'string', Rule::exists('roles', 'name')],
        ]);
        $name = Str::slug($data['label']);
        if (Role::where('name', $name)->exists()) {
            return back()->withErrors(['label' => 'A role with this name already exists.']);
        }
        $role = Role::create(['name' => $name, 'guard_name' => 'web']);
        $role->forceFill(['label' => $data['label'], 'description' => $data['description'] ?? '', 'is_system' => false])->save();
        if (! empty($data['copyFrom']) && $data['copyFrom'] !== User::SUPER_ADMIN) {
            $role->syncPermissions(Role::findByName($data['copyFrom'])->permissions);
        }
        Activity::record('role.created', $role->label);

        return redirect()->route('admin.roles.index', ['role' => $role->name])->with('success', "Role “{$role->label}” created. Choose its permissions.");
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:60'],
            'description' => ['nullable', 'string', 'max:200'],
            'permissions' => ['array'],
            'permissions.*' => ['string', Rule::exists('permissions', 'name')],
        ]);
        $role->forceFill(['label' => $data['label'], 'description' => $data['description'] ?? ''])->save();
        if ($role->name !== User::SUPER_ADMIN) {
            $role->syncPermissions($data['permissions'] ?? []);
        }
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Activity::record('role.updated', $role->label, ['permissions' => count($data['permissions'] ?? [])]);

        return back()->with('success', "Role “{$role->label}” saved.");
    }

    public function destroy(Role $role): RedirectResponse
    {
        if ($role->is_system) {
            return back()->with('error', 'Built-in roles cannot be deleted.');
        }
        if ($role->users()->exists()) {
            return back()->with('error', 'Move the users out of this role before deleting it.');
        }
        $label = $role->label;
        $role->delete();
        Activity::record('role.deleted', $label);

        return redirect()->route('admin.roles.index')->with('success', "Role “{$label}” deleted.");
    }
}
