# Pregnancy Wellness

A React Native (Expo) mobile app for tracking daily supplements, workouts, and wellness during pregnancy.

## Features

- **Calendar View** — Monthly calendar grid showing daily supplement and workout completion at a glance
- **Supplement Tracking** — Track multiple supplements with configurable doses per day, daily/weekly frequency, and linked supplements that share dose progress
- **Workout Tracking** — Assign workouts to specific days of the week with completion status and notes
- **Weekly Reports** — View weekly summaries of supplement and workout adherence
- **Reminders** — Push notification reminders via Expo Notifications
- **Dark Mode** — Full light/dark theme support
- **Offline Storage** — All data persisted locally with AsyncStorage

## Tech Stack

- **React Native** 0.81 with **Expo** SDK 54
- **React Navigation** (native stack)
- **TypeScript**
- **AsyncStorage** for local persistence
- **Expo Notifications** for reminders
- **React Native SVG** for icons

## Getting Started

### Prerequisites

- Node.js
- Expo CLI (`npx expo`)
- iOS Simulator, Android Emulator, or Expo Go on a physical device

### Install

```bash
npm install
```

### Run

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in browser
```

## Project Structure

```
src/
  screens/
    CalendarScreen.tsx         # Main calendar view
    DayDetailScreen.tsx        # Daily supplement & workout detail
    AddEditSupplementScreen.tsx
    AddEditWorkoutScreen.tsx
    SettingsScreen.tsx         # Due date, dark mode, reminders
    WeeklyReportScreen.tsx
  components/
    CalendarGrid.tsx           # Monthly calendar grid
    SupplementCard.tsx         # Supplement display/interaction
    WorkoutCard.tsx            # Workout display/interaction
    WhenToTakePicker.tsx       # Time-of-day picker for supplements
    Icons.tsx                  # SVG icon components
  storage/
    storage.ts                 # AsyncStorage read/write helpers
  ThemeContext.tsx              # Theme provider with light/dark colors
  theme.ts                     # Color palette definitions
  notifications.ts             # Expo push notification scheduling
  types.ts                     # TypeScript interfaces and types
```

## Building for Production

This project uses [EAS Build](https://docs.expo.dev/build/introduction/) for production builds.

```bash
npx eas build --platform android
npx eas build --platform ios
```
