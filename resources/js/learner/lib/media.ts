/**
 * Pack media paths → URLs.
 *  - https://… → as-is
 *  - /storage/… (uploaded/AI models) → as-is (same origin)
 *  - videos/placeholder.mp4 → the clip shipped with the app shell
 *  - videos/x.mp4 (Media library path) → /storage/videos/x.mp4
 */
export function resolveMedia(file: string): string {
    if (/^https?:\/\//.test(file) || file.startsWith('/')) return file;
    if (file === 'videos/placeholder.mp4') return '/media/placeholder.mp4';
    return `/storage/${file}`;
}
