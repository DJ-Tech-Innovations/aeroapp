import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { Button, DropdownItem, Icon } from '@/components/ui';
import { installStore, isIOS } from '@/learner/lib/pwa';

const IOS_HINT = 'In Safari, tap Share, then “Add to Home Screen”.';

/** Install state shared with the learner app (the prompt is captured once at startup in app.tsx / learner/app.tsx). */
export function useInstall() {
    const { prompt, installed } = useSyncExternalStore(installStore.subscribe, installStore.get, installStore.getServer);
    const ios = isIOS();
    return { installed, canInstall: !installed && (!!prompt || ios), ios, install: () => (ios ? toast.info('Install AeroApp', { description: IOS_HINT }) : installStore.install()) };
}

/** "Install the app" panel for the sign-in screen. Hidden when already installed or the browser can't install. */
export function InstallAppCard({ label = 'AeroApp' }: { label?: string }) {
    const { canInstall, ios, install } = useInstall();
    const [hidden, setHidden] = useState(false);
    if (!canInstall || hidden) return null;
    return (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-3">
            <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">Install {label}</p>
                <p className="text-xs text-muted">{ios ? IOS_HINT : 'Opens full screen from your home screen and works offline.'}</p>
            </div>
            {ios ? <button type="button" onClick={() => setHidden(true)} className="rounded p-1.5 text-muted hover:text-text" aria-label="Dismiss"><Icon name="cross-small" /></button>
                : <Button size="sm" icon="download" onClick={install}>Install</Button>}
        </div>
    );
}

/** Account-menu entry for the admin panel. */
export function InstallAppMenuItem() {
    const { canInstall, install } = useInstall();
    if (!canInstall) return null;
    return <DropdownItem icon="download" onSelect={() => void install()}>Install admin app</DropdownItem>;
}
