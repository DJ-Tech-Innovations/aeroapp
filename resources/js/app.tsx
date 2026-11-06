import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import type { ComponentType } from 'react';
import { Toaster } from 'sonner';
import { ConfirmProvider, TooltipProvider } from '@/components/ui';
import AdminLayout from '@/layouts/admin-layout';
import { captureInstallPrompt } from '@/learner/lib/pwa';

// `beforeinstallprompt` fires once, early — capture it before any page mounts.
captureInstallPrompt();

const pages = import.meta.glob<{ default: ComponentType }>('./pages/**/*.tsx');

void createInertiaApp({
    title: (title) => (title ? `${title} · AeroApp` : 'AeroApp'),
    resolve: async (name) => {
        const load = pages[`./pages/${name}.tsx`];
        if (!load) throw new Error(`Page not found: ${name}`);
        return (await load()).default as never;
    },
    layout: (name) => (name.startsWith('admin/') ? AdminLayout : null),
    withApp: (app) => (
        <TooltipProvider delayDuration={120}>
            <ConfirmProvider>
                {app}
                <Toaster position="top-right" richColors closeButton toastOptions={{ className: 'font-sans' }} />
            </ConfirmProvider>
        </TooltipProvider>
    ),
    progress: { color: '#3b82f6', delay: 120, showSpinner: false },
});
