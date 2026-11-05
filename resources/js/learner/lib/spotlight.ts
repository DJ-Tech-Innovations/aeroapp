import type { Spotlight } from '@/shared';
import { api } from './api';
import { cached } from './db';

/** Latest "tool of the day" for the learner's class(es); cached so it still shows offline. */
export const getSpotlight = () => cached('spotlight:latest', async () => (await api.get<{ spotlight: Spotlight | null }>('/spotlight')).spotlight);

export const setSpotlight = (toolId: string, note: string) => api.post<{ ok: true; classes: number }>('/instructor/spotlights', { toolId, note });
export const clearSpotlight = () => api.del('/instructor/spotlights');
