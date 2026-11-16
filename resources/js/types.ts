export interface AuthUser {
    id: string;
    role: 'student' | 'instructor' | 'admin';
    email: string;
    fullName: string;
    initials: string;
    idNumber: string;
    school: string;
    section: string;
    yearLevel: number | null;
    avatarUrl: string | null;
    roles: string[];
    permissions: string[];
    canAccessAdmin: boolean;
    homePath: string;
}

export interface SharedProps {
    app: { name: string; version: string; org: { name: string; tagline?: string }; demo: boolean };
    auth: { user: AuthUser | null };
    flash: { success?: string | null; error?: string | null; status?: string | null };
    errors: Record<string, string>;
    [key: string]: unknown;
}

export interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

export const can = (user: AuthUser | null | undefined, permission?: string) =>
    !permission || !!user && (user.permissions.includes('*') || user.permissions.includes(permission));
