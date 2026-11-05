<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /** Production: roles and permissions only. Local/staging: plus demo accounts and content. */
    public function run(): void
    {
        $this->call(app()->isProduction() ? RolesAndPermissionsSeeder::class : DemoSeeder::class);
    }
}
