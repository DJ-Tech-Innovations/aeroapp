import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Toaster } from 'sonner';
import { ConfirmProvider, TooltipProvider } from '@/components/ui';
import { AppShell } from './components/shell';
import { startNetworkMonitor, useNetwork } from './lib/network';
import { captureInstallPrompt, registerServiceWorker } from './lib/pwa';
import { useSession } from './lib/session';
import { applyTheme, useSettings } from './lib/settings';
import { syncNow } from './lib/sync';
import Home from './pages/home';
import { QuizResults, Results, StudentDetail, Students } from './pages/instructor';
import { NotFound, Welcome } from './pages/misc';
import Play from './pages/play';
import { ChangePassword, EditProfile, Profile } from './pages/profile';
import { QuizIntro, QuizList } from './pages/quizzes';
import Result from './pages/result';
import { About, Settings, Updates, Voice } from './pages/settings';
import ToolPage from './pages/tool';
import Tools from './pages/tools';
import Viewer from './pages/viewer';

/** App-wide side effects: service worker, network monitor, session restore, sync on reconnect, theme. */
function Providers({ children }: { children: ReactNode }) {
    const status = useSession((s) => s.status);
    const userId = useSession((s) => s.profile?.id);
    const online = useNetwork((s) => s.online);
    const theme = useSettings((s) => s.theme);

    useEffect(() => {
        startNetworkMonitor();
        registerServiceWorker();
        captureInstallPrompt();
        void useSession.getState().init();
    }, []);
    useEffect(() => {
        applyTheme(theme);
        if (theme !== 'system') return;
        const mq = matchMedia('(prefers-color-scheme: dark)');
        const f = () => applyTheme('system');
        mq.addEventListener('change', f);
        return () => mq.removeEventListener('change', f);
    }, [theme]);
    // Queued attempts and profile edits upload as soon as we're online with a signed-in user.
    useEffect(() => { if (status === 'signedIn' && userId && online) syncNow(userId).catch(() => {}); }, [status, userId, online]);
    // Re-check the session when the app returns to the foreground.
    useEffect(() => {
        const check = () => { if (document.visibilityState === 'visible' && navigator.onLine) void useSession.getState().init(); };
        document.addEventListener('visibilitychange', check);
        return () => document.removeEventListener('visibilitychange', check);
    }, []);
    return <>{children}</>;
}

export default function App() {
    return (
        <BrowserRouter basename="/app">
            <TooltipProvider delayDuration={150}>
                <ConfirmProvider>
                    <Providers>
                        <Routes>
                            <Route element={<AppShell />}>
                                <Route index element={<Home />} />
                                <Route path="welcome" element={<Welcome />} />
                                <Route path="tools" element={<Tools />} />
                                <Route path="tools/:id" element={<ToolPage />} />
                                <Route path="tools/:id/3d" element={<Viewer />} />
                                <Route path="quizzes" element={<QuizList />} />
                                <Route path="quizzes/:id" element={<QuizIntro />} />
                                <Route path="quizzes/:id/play" element={<Play />} />
                                <Route path="quizzes/:id/result/:attemptId" element={<Result />} />
                                <Route path="students" element={<Students />} />
                                <Route path="students/:id" element={<StudentDetail />} />
                                <Route path="results" element={<Results />} />
                                <Route path="results/:quizId" element={<QuizResults />} />
                                <Route path="profile" element={<Profile />} />
                                <Route path="profile/edit" element={<EditProfile />} />
                                <Route path="profile/password" element={<ChangePassword />} />
                                <Route path="settings" element={<Settings />} />
                                <Route path="settings/updates" element={<Updates />} />
                                <Route path="settings/voice" element={<Voice />} />
                                <Route path="settings/about" element={<About />} />
                                <Route path="*" element={<NotFound />} />
                            </Route>
                        </Routes>
                        <Toaster position="top-center" richColors closeButton />
                    </Providers>
                </ConfirmProvider>
            </TooltipProvider>
        </BrowserRouter>
    );
}

