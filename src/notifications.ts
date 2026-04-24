import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getSupplements, getSupplementsForDate, getDayRecord, formatDate } from './storage/storage';
import { AppSettings } from './types';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    // Notifications don't work on simulator/emulator
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('supplements', {
      name: 'Supplement Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0D9488',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

function clampHour(h: number): number {
  return Math.max(0, Math.min(23, Math.floor(h)));
}
function clampMinute(m: number): number {
  return Math.max(0, Math.min(59, Math.floor(m)));
}

export async function scheduleReminders(settings: AppSettings): Promise<void> {
  // Cancel all existing notifications first
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!settings.remindersEnabled || settings.reminders.length === 0) return;

  const hasPermission = await requestPermissions();
  if (!hasPermission) return;

  for (const reminder of settings.reminders) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title || 'Reminder',
        body: reminder.body,
        data: { reminderId: reminder.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: clampHour(reminder.hour),
        minute: clampMinute(reminder.minute),
      },
    });
  }
}

// Generate a detailed notification body listing what's needed
export async function getMissedSupplementsList(): Promise<string> {
  const todayStr = formatDate(new Date());
  const allSupplements = await getSupplements();
  const todaySupplements = getSupplementsForDate(allSupplements, todayStr);
  const record = await getDayRecord(todayStr);

  const missed: string[] = [];

  for (const sup of todaySupplements) {
    const doses = record[sup.id] || new Array(sup.dosesPerDay).fill(false);
    const remaining = sup.dosesPerDay - doses.filter(Boolean).length;
    if (remaining > 0) {
      missed.push(`${sup.name} (${remaining} remaining)`);
    }
  }

  if (missed.length === 0) {
    return 'All supplements taken today! Great job!';
  }

  return `Still need: ${missed.join(', ')}`;
}
