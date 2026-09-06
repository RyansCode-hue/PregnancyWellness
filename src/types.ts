export type Frequency = 'daily' | 'weekly';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday=0 ... Saturday=6

export interface Supplement {
  id: string;
  name: string;
  dosesPerDay: number;
  whenToTake?: string;
  frequency: Frequency;
  // Linked supplements share dose progress. Links are only valid between supplements
  // of the same frequency; storage rejects cross-frequency links.
  linkedSupplementIds?: string[];
  sortOrder?: number; // user-defined order; lower = earlier in list
  createdAt: string;
}

export type WorkoutFrequency = 'days' | 'weekly';

export interface Workout {
  id: string;
  name: string;
  frequency: WorkoutFrequency;
  assignedDays: DayOfWeek[]; // used when frequency === 'days'
  timesPerDay?: number; // used when frequency === 'days'; sessions needed for the day to count (default 1)
  weeklyGoal?: number; // used when frequency === 'weekly' (e.g. 3 = "3 times any day this week")
  sortOrder?: number; // user-defined order; lower = earlier in list
  createdAt: string;
}

export interface DayRecord {
  [supplementId: string]: boolean[];
}

// Tracks which supplement was actually taken for each dose slot
// e.g. { "iron-id": ["iron-id", "iron-id", "folate-id", "iron-id"] }
// means doses 1,2,4 were Iron and dose 3 was Folate
export interface DoseSourceRecord {
  [supplementId: string]: (string | null)[];
}

export interface WorkoutDayRecord {
  [workoutId: string]: {
    // Number of sessions logged on this day. This is the source of truth for both
    // frequencies; read it through `getWorkoutSessions` so legacy records that only
    // carry `completed` still count as one session.
    sessions?: number;
    // Legacy flag from before the session counter existed. Kept in sync on write
    // (true when sessions > 0) but never read directly by new code.
    completed: boolean;
    notes?: string;
  };
}

export interface ReminderConfig {
  id: string;
  hour: number; // 0-23
  minute: number; // 0-59
  title: string;
  body: string;
}

export interface AppSettings {
  dueDate?: string; // ISO date string (YYYY-MM-DD)
  darkMode: boolean;
  partnerName: string; // substituted for the `{name}` placeholder in reminder bodies
  remindersEnabled: boolean;
  reminders: ReminderConfig[];
  // Visibility toggles for tab-bar buttons. Settings is always visible (not included).
  enabledTabs: Record<'Calendar' | 'Labor' | 'Contractions' | 'Baby', boolean>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  partnerName: 'Amy',
  remindersEnabled: true,
  reminders: [
    {
      id: 'morning',
      hour: 8,
      minute: 0,
      title: 'Good morning!',
      body: 'Hey {name}, remember to take your supplements today!',
    },
    {
      id: 'evening',
      hour: 20,
      minute: 0,
      title: 'Evening check-in',
      body: 'Hey {name}, have you taken all your supplements today?',
    },
  ],
  enabledTabs: {
    Calendar: true,
    Labor: true,
    Contractions: true,
    Baby: true,
  },
};

export type LaborCategory = 'position' | 'comfort';
export type LaborStage = 'early' | 'active' | 'transition' | 'pushing';

export interface LaborItem {
  id: string;
  category: LaborCategory;
  name: string;
  caption: string;
  imageUri?: string;
  videoUrl?: string;
  externalUrl?: string;
  // Which stages of labor this item applies to. Undefined or empty = all stages.
  stages?: LaborStage[];
  createdAt: string;
}

export interface Contraction {
  id: string;
  start: string; // ISO timestamp
  end?: string;  // ISO timestamp; undefined while still in progress
}

// ─── Baby tracking ───
export type FeedType = 'breast' | 'bottle';
export type FeedSide = 'left' | 'right' | 'both';
export type AmountUnit = 'ml' | 'oz';

// Preset hold options. `holdCustom` carries free-text when the user picks "Custom".
export const FEED_HOLDS = [
  'Cradle',
  'Cross-cradle',
  'Football',
  'Laid-back',
  'Side-lying',
] as const;
export type FeedHold = (typeof FEED_HOLDS)[number];

export interface FeedingSession {
  id: string;
  type: FeedType;
  start: string;        // ISO timestamp
  end?: string;         // ISO; undefined while breast feed in progress. Bottle: end === start.
  // Breast-only fields:
  side?: FeedSide;
  hold?: FeedHold;
  holdCustom?: string;  // populated when user typed a custom hold (hold left undefined)
  // Bottle-only fields:
  amount?: number;
  unit?: AmountUnit;
}

export interface SleepSession {
  id: string;
  start: string;        // ISO timestamp
  end?: string;         // ISO; undefined while in progress
}

export type DiaperKind = 'wet' | 'dirty' | 'both';

export interface DiaperEvent {
  id: string;
  kind: DiaperKind;
  time: string;         // ISO timestamp
}

// Tabs that can be hidden from Settings. `Settings` itself is intentionally not toggleable.
export type ToggleableTab = 'Calendar' | 'Labor' | 'Contractions' | 'Baby';

export type RootStackParamList = {
  Calendar: undefined;
  DayDetail: { date: string };
  AddEditSupplement: { supplement?: Supplement };
  AddEditWorkout: { workout?: Workout };
  Settings: undefined;
  WeeklyReport: undefined;
  Labor: undefined;
  AddEditLabor: { item?: LaborItem } | undefined;
  Contractions: undefined;
  Baby: undefined;
};
