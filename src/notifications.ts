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

export async function scheduleReminders(settings: AppSettings): Promise<void> {
  // Cancel all existing notifications first
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!settings.remindersEnabled) return;

  const hasPermission = await requestPermissions();
  if (!hasPermission) return;

  const name = settings.partnerName || 'there';

  // Schedule morning reminder at 8:00 AM daily
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Good morning!',
      body: `Hey ${name}, remember to take your supplements today!`,
      data: { type: 'morning' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });

  // Schedule evening reminder at 8:00 PM daily
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Evening check-in',
      body: `Hey ${name}, have you taken all your supplements today?`,
      data: { type: 'evening' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
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
