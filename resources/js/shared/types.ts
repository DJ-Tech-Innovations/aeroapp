// Data contracts shared by the student/instructor PWA, the admin panel and the Supabase schema.
// Content types are identical to the original mobile spec so content packs stay compatible.

export type UnitSystem = 'english' | 'metric' | 'dual' | 'na';
export type Category = 'power' | 'common' | 'measuring' | 'special';
export type Subcategory = 'pneumatic' | 'electric' | 'english' | 'metric' | null;
export type Brand = 'Milwaukee' | 'INGCO' | 'Stanley' | 'Aviation Specialty';

export interface Measurement { value: number; unit: 'kg' | 'g' | 'lb' | 'oz' }
export interface Dimensions { length: number; width: number; height: number; unit: 'mm' | 'cm' | 'in' }
export interface Reference { title: string; publisher: string; section?: string; url?: string }
export interface Hotspot { id: string; label: string; description: string; position: [number, number, number] }
export type VoiceSection = 'purpose' | 'howItWorks' | 'howToUse' | 'maintenance';

export interface Tool {
  id: string;
  slug: string;
  name: string;
  category: Category;
  subcategory: Subcategory;
  brand: Brand;
  model: string;
  unitSystem: UnitSystem;
  weight: Measurement;
  dimensions: Dimensions;
  aircraftApplications: string[];
  purpose: string;
  howItWorks: string;
  howToUse: string[];
  maintenance: string[];
  safety: string[];
  voiceOver: {
    purpose: string; howItWorks: string; howToUse: string; maintenance: string;
    audioFiles?: Partial<Record<VoiceSection, string>>;
  };
  /** `file` is a pack-relative path (e.g. "videos/placeholder.mp4") or an absolute https URL (Supabase Storage). */
  video: { file: string; durationSec: number; thumbnail: string } | null;
  /**
   * `file` is `procedural://<archetype>` (placeholder) or a .glb path/URL (AI-generated or uploaded).
   * `fallback` is the archetype drawn while a GLB loads or if it cannot be loaded (e.g. offline before it was cached).
   * Hotspot positions: procedural models use archetype coordinates; GLB models use the normalised space
   * (model centred and scaled to fit a unit sphere), so they stay correct whatever size the file is.
   */
  model3d: { file: string; scale: number; animations: string[]; hotspots: Hotspot[]; fallback?: string };
  thumbnail: string;
  references: Reference[];
  tags: string[];
  isSampleData: boolean;
  updatedAt: string;
}

export type QuestionType = 'mcq' | 'true_false' | 'identify_tool' | 'identify_part';
export interface Question {
  id: string; type: QuestionType; prompt: string; toolId?: string; hotspotId?: string;
  choices: { id: string; text: string }[]; correctChoiceId: string; explanation: string; points: number;
}
export interface Quiz {
  id: string; title: string; description: string; mode: 'quiz' | 'exam';
  timeLimitSec: number | null; maxAttempts: number | null; passingPercent: number; drawCount: number | null;
  shuffleQuestions: true; shuffleChoices: true; questions: Question[]; updatedAt: string;
}

export type SyncStatus = 'pending' | 'synced' | 'failed';
export interface Attempt {
  id: string; quizId: string; userId: string; packVersion: string;
  questionOrder: string[]; choiceOrder: Record<string, string[]>; answers: Record<string, string | null>;
  score: number; maxScore: number; passed: boolean; startedAt: string; submittedAt: string | null; syncStatus: SyncStatus;
}
/** Local attempt row (adds display fields so history survives removal of the quiz by a later pack). */
export interface AttemptRow extends Attempt { quizTitle: string; quizMode: 'quiz' | 'exam' }

export interface PackChangelog {
  toolsAdded: string[]; toolsUpdated: string[]; toolsRemoved: string[];
  quizzesAdded: string[]; quizzesUpdated: string[]; quizzesRemoved: string[]; notes?: string;
}
export interface PackManifest {
  packVersion: string; minAppVersion: string; releasedAt: string; toolCount: number; quizCount: number;
  sizeBytes: number; sha256: string; changelog: PackChangelog;
}
export interface PackPayload { tools: Tool[]; quizzes: Quiz[] }

// ── users / classes ──
export type Role = 'student' | 'instructor' | 'admin';
export interface UserProfile {
  id: string; role: Role; email: string; fullName: string; idNumber: string; school: string; section: string; yearLevel: number | null;
  avatarUrl: string | null; pendingSync?: boolean;
}
export interface ClassRow { id: string; name: string; instructorId: string }
export interface Spotlight { classId: string; toolId: string; note: string; instructorName: string; createdAt: string }
