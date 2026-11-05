<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/** @extends Factory<User> */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'full_name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => static::$password ??= Hash::make('password'),
            'id_number' => 'STU-'.fake()->unique()->numerify('#####'),
            'school' => 'Philippine State College of Aeronautics',
            'section' => 'AMT-2A',
            'remember_token' => Str::random(10),
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    /** Assign a role after creating (roles must be seeded first). */
    public function role(string $role): static
    {
        return $this->afterCreating(fn (User $u) => $u->assignRole($role));
    }
}
