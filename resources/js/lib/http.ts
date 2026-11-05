/** fetch() wrapper for Laravel: session cookie + XSRF header, JSON in/out, readable errors. */
export class HttpError extends Error {
    constructor(message: string, readonly status: number, readonly body: unknown = null) {
        super(message);
        this.name = 'HttpError';
    }
}

const xsrf = () => {
    const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
};

export async function http<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('X-Requested-With', 'XMLHttpRequest');
    if (init.method && init.method !== 'GET') headers.set('X-XSRF-TOKEN', xsrf());
    let body = init.body;
    if (init.json !== undefined) {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify(init.json);
    }
    let res: Response;
    try {
        res = await fetch(url, { ...init, headers, body, credentials: 'same-origin' });
    } catch {
        throw new HttpError('You appear to be offline. Check your connection and try again.', 0);
    }
    const data = res.headers.get('content-type')?.includes('application/json') ? await res.json().catch(() => null) : null;
    if (!res.ok) {
        const d = data as { message?: string; errors?: Record<string, string[]> } | null;
        const first = d?.errors ? Object.values(d.errors)[0]?.[0] : null;
        throw new HttpError(first ?? d?.message ?? `Request failed (${res.status})`, res.status, data);
    }
    return data as T;
}
