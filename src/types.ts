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

export type WorkoutFrequency = 'days' | 'weekly';

export interface Workout {
  id: string;
  name: string;
  frequency: WorkoutFrequency;
  assignedDays: DayOfWeek[]; // used when frequency === 'days'
  weeklyGoal?: number; // used when frequency === 'weekly' (e.g. 3 = "3 times any day this week")
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
  partnerName: string; // e.g. "Amy" — used only in default reminder bodies
  remindersEnabled: boolean;
  reminders: ReminderConfig[];
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
      body: 'Hey Amy, remember to take your supplements today!',
    },
    {
      id: 'evening',
      hour: 20,
      minute: 0,
      title: 'Evening check-in',
      body: 'Hey Amy, have you taken all your supplements today?',
    },
  ],
};

export type RootStackParamList = {
  Calendar: undefined;
  DayDetail: { date: string };
  AddEditSupplement: { supplement?: Supplement };
  AddEditWorkout: { workout?: Workout };
  Settings: undefined;
  WeeklyReport: undefined;
};
