<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * Anyone who signs in. What they can do comes from their roles (spatie/laravel-permission):
 * - `admin.access` opens the admin portal (/admin)
 * - `app.instruct` gives the instructor learner app (students, results, spotlight)
 * - `app.learn` gives the student learner app (quizzes & exams)
 *
 * @property string $id
 * @property string $email
 * @property string $full_name
 * @property string $id_number
 * @property string $school
 * @property string $section
 * @property int|null $year_level 1–4 for students, null for staff
 * @property string $phone
 * @property string|null $avatar_path
 * @property bool $is_active
 */
#[Fillable(['email', 'password', 'full_name', 'id_number', 'school', 'section', 'year_level', 'phone'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, HasUuids, Notifiable;

    public const SUPER_ADMIN = 'super-admin';

    protected $attributes = ['is_active' => true];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'year_level' => 'integer',
            'last_login_at' => 'datetime',
        ];
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole(self::SUPER_ADMIN);
    }

    public function canAccessAdmin(): bool
    {
        return $this->isSuperAdmin() || $this->checkPermissionTo('admin.access');
    }

    // Learner experience comes from the role's own permissions — not from the super-admin bypass in Gate::before.
    public function isInstructor(): bool
    {
        return $this->checkPermissionTo('app.instruct');
    }

    public function isLearner(): bool
    {
        return $this->isInstructor() || $this->checkPermissionTo('app.learn');
    }

    /** student | instructor | admin — the experience the learner app shows (shared `Role` contract). */
    public function kind(): string
    {
        return match (true) {
            $this->isInstructor() => 'instructor',
            $this->checkPermissionTo('app.learn') => 'student',
            $this->canAccessAdmin() => 'admin',
            default => 'student',
        };
    }

    /** Learners land in the offline app; staff-only accounts land in the admin portal. */
    public function homePath(): string
    {
        return $this->isLearner() || ! $this->canAccessAdmin() ? '/app' : '/admin';
    }

    /** Classes this user teaches. */
    public function taughtClasses(): HasMany
    {
        return $this->hasMany(SchoolClass::class, 'instructor_id');
    }

    /** Classes this user is enrolled in. */
    public function classes(): BelongsToMany
    {
        return $this->belongsToMany(SchoolClass::class, 'class_members', 'student_id', 'class_id');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(Attempt::class);
    }

    /** True when $student is enrolled in a class this user teaches. */
    public function teaches(User $student): bool
    {
        return $this->isInstructor()
            && $student->classes()->where('instructor_id', $this->id)->exists();
    }

    public function avatarUrl(): ?string
    {
        return $this->avatar_path ? Storage::disk('public')->url($this->avatar_path) : null;
    }

    public function initials(): string
    {
        $parts = preg_split('/\s+/', trim($this->full_name ?: $this->email)) ?: [];

        return strtoupper(mb_substr($parts[0] ?? '', 0, 1).mb_substr($parts[1] ?? '', 0, 1)) ?: 'U';
    }

    /** Shared `UserProfile` contract shape (learner app). */
    public function toProfile(): array
    {
        return [
            'id' => $this->id,
            'role' => $this->kind(),
            'email' => $this->email,
            'fullName' => $this->full_name,
            'idNumber' => $this->id_number,
            'school' => $this->school,
            'section' => $this->section,
            'yearLevel' => $this->year_level,
            'avatarUrl' => $this->avatarUrl(),
        ];
    }

    /** What the Inertia pages get as `auth.user`. */
    public function toAuth(): array
    {
        return [
            ...$this->toProfile(),
            'initials' => $this->initials(),
            'roles' => $this->getRoleNames()->values(),
            'permissions' => $this->isSuperAdmin() ? ['*'] : $this->getAllPermissions()->pluck('name')->values(),
            'canAccessAdmin' => $this->canAccessAdmin(),
            'homePath' => $this->homePath(),
        ];
    }
}
