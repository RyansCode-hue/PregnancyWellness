export type Frequency = 'daily' | 'weekly';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday=0 ... Saturday=6

export interface Supplement {
  id: string;
  name: string;
  dosesPerDay: number;
  whenToTake?: string;
  frequency: Frequency;
  dayOfWeek?: DayOfWeek; // only used when frequency === 'weekly'
  linkedSupplementIds?: string[]; // linked supplements share dose progress
  createdAt: string;
}

export interface Workout {
  id: string;
  name: string;
  assignedDays: DayOfWeek[]; // which days of the week
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
    completed: boolean;
    notes?: string;
  };
}

export interface AppSettings {
  dueDate?: string; // ISO date string (YYYY-MM-DD)
  darkMode: boolean;
  partnerName: string; // e.g. "Amy"
  remindersEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  partnerName: 'Amy',
  remindersEnabled: true,
};

export type RootStackParamList = {
  Calendar: undefined;
  DayDetail: { date: string };
  AddEditSupplement: { supplement?: Supplement };
  AddEditWorkout: { workout?: Workout };
  Settings: undefined;
  WeeklyReport: undefined;
};
