import { brandColor, type Category } from '@/shared';
import { Icon } from './ui';

export const CATEGORY_ICON: Record<Category, string> = { power: 'bolt', common: 'hammer', measuring: 'ruler-combined', special: 'plane-alt' };

/** Lightweight tile for lists; the real 3D canvas is only mounted on the detail screen. */
export function ToolThumb({ category, brand, size = 40, className }: { category: Category; brand: string; size?: number; className?: string }) {
    const c = brandColor(brand);
    return (
        <span aria-hidden className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: size, height: size, borderRadius: size * 0.28, background: `linear-gradient(135deg, ${c}26, ${c}10)`, border: `1px solid ${c}55`, color: c, fontSize: size * 0.45 }}>
            <Icon name={CATEGORY_ICON[category]} />
        </span>
    );
}
