<?php

use App\Models\User;
use Spatie\Permission\Models\Role;

it('creates a user with roles and an admin cannot hand out super-admin', function () {
    $admin = userWithRole('admin');
    $this->actingAs($admin)->post('/admin/users', [
        'full_name' => 'New Person', 'email' => 'NEW@x.com', 'password' => 'password123', 'roles' => ['student', 'super-admin'],
    ])->assertSessionHas('success');
    $u = User::where('email', 'new@x.com')->firstOrFail();
    expect($u->getRoleNames()->all())->toBe(['student']);
});

it('stops people deactivating or deleting themselves', function () {
    $admin = userWithRole('admin');
    $this->actingAs($admin)->post("/admin/users/{$admin->id}/toggle")->assertStatus(422);
    $this->actingAs($admin)->delete("/admin/users/{$admin->id}")->assertStatus(422);
});

it('creates custom roles, edits permissions and protects built-in roles', function () {
    $super = userWithRole('super-admin');
    $this->actingAs($super)->post('/admin/roles', ['label' => 'Reviewer', 'copyFrom' => 'content-editor'])->assertRedirect();
    $role = Role::findByName('reviewer');
    expect($role->permissions->pluck('name'))->toContain('tools.manage');

    $this->actingAs($super)->put("/admin/roles/{$role->id}", ['label' => 'Reviewer', 'permissions' => ['admin.access', 'tools.view']]);
    expect($role->fresh()->permissions->pluck('name')->sort()->values()->all())->toBe(['admin.access', 'tools.view']);

    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $this->actingAs($reviewer)->get('/admin/tools')->assertOk();
    $this->actingAs($reviewer)->get('/admin/quizzes')->assertForbidden();

    $this->actingAs($super)->delete('/admin/roles/'.Role::findByName('student')->id)->assertSessionHas('error');
});

it('derives the learner experience from role permissions', function () {
    expect(userWithRole('student')->kind())->toBe('student')
        ->and(userWithRole('instructor')->kind())->toBe('instructor')
        ->and(userWithRole('super-admin')->kind())->toBe('admin')
        ->and(userWithRole('super-admin')->homePath())->toBe('/admin');
});
