<?php

namespace App\Support;

/**
 * The single list of permissions and default roles. The seeder syncs the database to it,
 * the Roles page groups the matrix by `group`, and routes check the names.
 */
final class Permissions
{
    /** @return array<string, array{group: string, description: string}> */
    public static function all(): array
    {
        return [
            'admin.access' => ['group' => 'Portal', 'description' => 'Sign in to the admin portal'],
            'dashboard.view' => ['group' => 'Portal', 'description' => 'See the dashboard'],

            'tools.view' => ['group' => 'Tools', 'description' => 'View the tool catalogue'],
            'tools.manage' => ['group' => 'Tools', 'description' => 'Create, edit and delete tools'],
            'tools.import' => ['group' => 'Tools', 'description' => 'Import / export tools with Excel'],
            'tools.ai' => ['group' => 'Tools', 'description' => 'Generate 3D models and part suggestions with AI'],

            'quizzes.view' => ['group' => 'Quizzes', 'description' => 'View quizzes and exams'],
            'quizzes.manage' => ['group' => 'Quizzes', 'description' => 'Create, edit and delete quizzes and exams'],

            'packs.view' => ['group' => 'Content packs', 'description' => 'View published content packs'],
            'packs.publish' => ['group' => 'Content packs', 'description' => 'Publish and withdraw content packs'],

            'media.view' => ['group' => 'Media', 'description' => 'Browse the media library'],
            'media.manage' => ['group' => 'Media', 'description' => 'Upload and delete media'],

            'classes.view' => ['group' => 'Classes', 'description' => 'View classes and rosters'],
            'classes.manage' => ['group' => 'Classes', 'description' => 'Create classes and manage members'],

            'users.view' => ['group' => 'Users', 'description' => 'View user accounts'],
            'users.manage' => ['group' => 'Users', 'description' => 'Create, edit, deactivate and delete users'],
            'roles.manage' => ['group' => 'Users', 'description' => 'Create roles and edit their permissions'],

            'reports.view' => ['group' => 'Reports', 'description' => 'See attempt results across all classes'],
            'audit.view' => ['group' => 'Reports', 'description' => 'See the audit trail'],

            'settings.manage' => ['group' => 'Settings', 'description' => 'Change system settings and API keys'],

            'app.learn' => ['group' => 'Learner app', 'description' => 'Use the student app: browse tools, take quizzes & exams'],
            'app.instruct' => ['group' => 'Learner app', 'description' => 'Use the instructor app: class results, students, spotlight'],
        ];
    }

    /**
     * Default roles. `super-admin` bypasses every check (Gate::before), so it needs no permissions.
     *
     * @return array<string, array{label: string, description: string, system: bool, permissions: string[]}>
     */
    public static function roles(): array
    {
        $staff = array_values(array_filter(array_keys(self::all()), fn ($p) => ! str_starts_with($p, 'app.')));

        return [
            'super-admin' => ['label' => 'Super Administrator', 'description' => 'Full access to everything. Cannot be restricted.', 'system' => true, 'permissions' => []],
            'admin' => ['label' => 'Administrator', 'description' => 'Runs the portal: content, packs, users and settings.', 'system' => true, 'permissions' => $staff],
            'content-editor' => ['label' => 'Content Editor', 'description' => 'Authors tools and quizzes; cannot publish or manage users.', 'system' => false, 'permissions' => [
                'admin.access', 'dashboard.view', 'tools.view', 'tools.manage', 'tools.import', 'tools.ai', 'quizzes.view', 'quizzes.manage', 'packs.view', 'media.view', 'media.manage',
            ]],
            'instructor' => ['label' => 'Instructor', 'description' => 'Teaches classes: sees student results and spotlights tools.', 'system' => true, 'permissions' => ['app.instruct']],
            'student' => ['label' => 'Student', 'description' => 'Learns tools and takes quizzes & exams in the app.', 'system' => true, 'permissions' => ['app.learn']],
        ];
    }
}
