<?php

use Illuminate\Support\Str;

it('keeps learners out of the admin portal', function () {
    $this->actingAs(userWithRole('student'))->get('/admin')->assertForbidden()->assertInertia(fn ($p) => $p->component('error')->where('status', 403));
    $this->actingAs(userWithRole('instructor'))->get('/admin/users')->assertForbidden();
});

it('limits a custom role to its permissions', function () {
    $editor = userWithRole('content-editor');
    seedContent();
    $this->actingAs($editor)->get('/admin/tools')->assertOk();
    $this->actingAs($editor)->get('/admin/users')->assertForbidden();
    $this->actingAs($editor)->post('/admin/packs', ['version' => '9.0.0', 'minAppVersion' => '1.0.0'])->assertForbidden();
});

it('lets a super admin in everywhere through the bypass', function () {
    $super = userWithRole('super-admin');
    seedContent();
    foreach (['/admin', '/admin/tools', '/admin/quizzes', '/admin/packs', '/admin/media', '/admin/classes', '/admin/users', '/admin/roles', '/admin/results', '/admin/audit', '/admin/settings', '/admin/account', '/admin/tools/import'] as $url) {
        $this->actingAs($super)->get($url)->assertOk();
    }
});

it('renders the branded 404 page for unknown URLs', function () {
    $this->get('/definitely-not-here')->assertNotFound()->assertInertia(fn ($p) => $p->component('error')->where('status', 404));
    $this->actingAs(userWithRole('admin'))->get('/admin/tools/'.Str::uuid())->assertNotFound();
});

it('serves the learner shell and a versioned service worker', function () {
    $this->get('/app/tools/anything')->assertOk()->assertSee('learner-root', false);
    $this->get('/sw.js')->assertOk()->assertHeader('Content-Type', 'application/javascript; charset=utf-8')->assertSee('const VERSION');
});
