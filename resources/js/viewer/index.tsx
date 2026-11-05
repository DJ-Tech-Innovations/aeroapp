import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui';
import type { ToolViewerProps } from './ToolViewer';
import type { ModelPreviewProps } from './ModelPreview';

/** three.js is large — load it only where a viewer is actually shown. */
const Inner = lazy(() => import('./ToolViewer'));
const PreviewInner = lazy(() => import('./ModelPreview'));

export const ToolViewer = (p: ToolViewerProps) => (
    <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}><Inner {...p} /></Suspense>
);
export const ModelPreview = (p: ModelPreviewProps) => (
    <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}><PreviewInner {...p} /></Suspense>
);
export type { Vec3 } from './ModelPreview';
