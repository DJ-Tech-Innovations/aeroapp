<?php

use App\Models\User;

it('lets an admin set, filter by and clear a student year level', function () {
    $admin = userWithRole('admin');
    $this->actingAs($admin)->post('/admin/users', [
        'full_name' => 'First Year', 'email' => 'fy@x.com', 'password' => 'password123', 'roles' => ['student'], 'year_level' => '1',
    ])->assertSessionHas('success');
    $u = User::where('email', 'fy@x.com')->firstOrFail();
    expect($u->year_level)->toBe(1);

    $this->actingAs($admin)->get('/admin/users?year=1')->assertInertia(fn ($p) => $p->where('users.data.0.email', 'fy@x.com')->where('users.data.0.year_level', 1));
    $this->actingAs($admin)->get('/admin/users?year=2')->assertInertia(fn ($p) => $p->has('users.data', 0));

    $this->actingAs($admin)->put("/admin/users/{$u->id}", ['full_name' => 'First Year', 'email' => 'fy@x.com', 'roles' => ['student'], 'year_level' => ''])->assertSessionHas('success');
    expect($u->fresh()->year_level)->toBeNull();
});

it('rejects year levels outside 1–4', function () {
    $this->actingAs(userWithRole('admin'))->post('/admin/users', [
        'full_name' => 'X', 'email' => 'x@x.com', 'password' => 'password123', 'roles' => ['student'], 'year_level' => 5,
    ])->assertSessionHasErrors('year_level');
});

it('lets a learner update their own year level from the app', function () {
    $u = userWithRole('student');
    $this->actingAs($u)->patchJson('/api/me', ['yearLevel' => 2])->assertOk()->assertJsonPath('profile.yearLevel', 2);
    $this->actingAs($u)->patchJson('/api/me', ['yearLevel' => null])->assertOk()->assertJsonPath('profile.yearLevel', null);
    $this->actingAs($u)->patchJson('/api/me', ['yearLevel' => 9])->assertUnprocessable();
});
