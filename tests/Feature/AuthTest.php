<?php

it('shows the sign-in page to guests and redirects the root there', function () {
    $this->get('/')->assertRedirect('/login');
    $this->get('/login')->assertOk()->assertInertia(fn ($p) => $p->component('auth/login'));
});

it('sends learners to the offline app and staff to the admin portal', function () {
    $student = userWithRole('student');
    $this->post('/login', ['email' => $student->email, 'password' => 'password'], ['X-Inertia' => 'true'])
        ->assertStatus(409)->assertHeader('X-Inertia-Location', '/app');

    auth()->logout();
    $admin = userWithRole('admin');
    $this->post('/login', ['email' => $admin->email, 'password' => 'password'])->assertRedirect('/admin');
});

it('rejects a wrong password with a friendly message', function () {
    $u = userWithRole('student');
    $this->post('/login', ['email' => $u->email, 'password' => 'nope'])->assertSessionHasErrors(['email' => 'Incorrect email or password.']);
    $this->assertGuest();
});

it('refuses deactivated accounts and signs them out mid-session', function () {
    $u = userWithRole('admin', ['is_active' => false]);
    $this->post('/login', ['email' => $u->email, 'password' => 'password'])->assertSessionHasErrors('email');
    $this->assertGuest();

    $active = userWithRole('admin');
    $this->actingAs($active)->get('/admin')->assertOk();
    $active->forceFill(['is_active' => false])->save();
    $this->get('/admin')->assertRedirect('/login');
    $this->assertGuest();
});

it('never reveals whether an account exists on forgot password', function () {
    $this->post('/forgot-password', ['email' => 'nobody@example.com'])->assertSessionHas('status');
    $u = userWithRole('student');
    $this->post('/forgot-password', ['email' => $u->email])->assertSessionHas('status');
});
