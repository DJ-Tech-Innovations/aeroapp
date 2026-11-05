<?php

namespace App\Console\Commands;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

#[Signature('aeroapp:create-admin {email} {--name=} {--password=}')]
#[Description('Create a super administrator, or promote an existing account')]
class CreateAdmin extends Command
{
    public function handle(): int
    {
        $this->callSilently('db:seed', ['--class' => RolesAndPermissionsSeeder::class, '--force' => true]);
        $email = strtolower((string) $this->argument('email'));
        $password = $this->option('password') ?: Str::password(16);
        $user = User::firstOrNew(['email' => $email]);
        $isNew = ! $user->exists;
        $user->full_name = $this->option('name') ?: ($user->full_name ?: 'Administrator');
        if ($isNew || $this->option('password')) {
            $user->password = $password;
        }
        $user->is_active = true;
        $user->save();
        $user->assignRole(User::SUPER_ADMIN);

        $this->info(($isNew ? 'Created' : 'Promoted')." {$email} to Super Administrator.");
        if ($isNew && ! $this->option('password')) {
            $this->warn("Temporary password: {$password}  (change it after signing in)");
        }

        return self::SUCCESS;
    }
}
