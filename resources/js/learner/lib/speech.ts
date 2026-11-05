import { create } from 'zustand';
import { useSettings } from './settings';

export interface SpeechItem {
  id: string;
  text: string;
  /** Pre-recorded audio URL (from the pack). Played instead of TTS when present. */
  audioUrl?: string;
}

interface VoiceState {
  activeId: string | null;
  playingAll: boolean;
  speak: (item: SpeechItem) => void;
  playAll: (items: SpeechItem[]) => void;
  stop: () => void;
}

let token = 0;
let audio: HTMLAudioElement | null = null;

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Long utterances get cut off on some browsers, so narrate sentence by sentence. */
const chunk = (text: string) => (text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [text]).map((s) => s.trim()).filter(Boolean);

export function getVoices(): SpeechSynthesisVoice[] {
  return speechSupported() ? speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en')) : [];
}

function playOne(item: SpeechItem, onDone: (completed: boolean) => void) {
  const my = ++token;
  const done = (ok: boolean) => { if (my === token) onDone(ok); };
  if (item.audioUrl) {
    audio?.pause();
    audio = new Audio(item.audioUrl);
    audio.onended = () => done(true);
    audio.onerror = () => done(false);
    audio.play().catch(() => done(false));
    return;
  }
  if (!speechSupported()) return done(false);
  const { voiceRate, voicePitch, voiceURI } = useSettings.getState();
  const voice = voiceURI ? speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI) : undefined;
  const parts = chunk(item.text);
  speechSynthesis.cancel();
  const next = (i: number) => {
    if (my !== token) return;
    if (i >= parts.length) return done(true);
    const u = new SpeechSynthesisUtterance(parts[i]);
    u.rate = voiceRate; u.pitch = voicePitch;
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-US';
    u.onend = () => next(i + 1);
    u.onerror = (e) => { if (e.error === 'interrupted' || e.error === 'canceled') return; done(false); };
    speechSynthesis.speak(u);
  };
  // cancel() is async on some engines; give it a tick so the first utterance isn't swallowed
  setTimeout(() => next(0), 30);
}

export const useVoice = create<VoiceState>((set) => ({
  activeId: null,
  playingAll: false,
  speak(item) {
    set({ activeId: item.id, playingAll: false });
    playOne(item, () => set({ activeId: null }));
  },
  playAll(items) {
    const run = (i: number) => {
      if (i >= items.length) return set({ activeId: null, playingAll: false });
      set({ activeId: items[i].id, playingAll: true });
      playOne(items[i], (ok) => (ok ? run(i + 1) : set({ activeId: null, playingAll: false })));
    };
    run(0);
  },
  stop() {
    token++;
    if (speechSupported()) speechSynthesis.cancel();
    audio?.pause(); audio = null;
    set({ activeId: null, playingAll: false });
  },
}));

export const say = (id: string, text: string) => useVoice.getState().speak({ id, text });
