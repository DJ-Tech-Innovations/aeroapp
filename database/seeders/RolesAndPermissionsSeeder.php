<?php

namespace Database\Seeders;

use App\Support\Permissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/** Idempotent: safe to run in production on every deploy (adds new permissions, never removes custom roles). */
class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (Permissions::all() as $name => $meta) {
            Permission::updateOrCreate(['name' => $name, 'guard_name' => 'web'], $meta);
        }
        Permission::whereNotIn('name', array_keys(Permissions::all()))->delete();

        foreach (Permissions::roles() as $name => $r) {
            $role = Role::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            $isNew = $role->wasRecentlyCreated;
            $role->forceFill(['label' => $r['label'], 'description' => $r['description'], 'is_system' => $r['system']])->save();
            // Only seed permissions into new roles: an admin may have tuned existing ones on the Roles page.
            if ($isNew) {
                $role->syncPermissions($r['permissions']);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
