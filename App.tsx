import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import CalendarScreen from './src/screens/CalendarScreen';
import DayDetailScreen from './src/screens/DayDetailScreen';
import AddEditSupplementScreen from './src/screens/AddEditSupplementScreen';
import AddEditWorkoutScreen from './src/screens/AddEditWorkoutScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WeeklyReportScreen from './src/screens/WeeklyReportScreen';
import { scheduleReminders } from './src/notifications';
import { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { colors, isDark, settings } = useTheme();

  // Schedule notifications whenever settings change
  useEffect(() => {
    scheduleReminders(settings);
  }, [settings.remindersEnabled, settings.partnerName]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Calendar"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Calendar" component={CalendarScreen} />
        <Stack.Screen name="DayDetail" component={DayDetailScreen} />
        <Stack.Screen
          name="AddEditSupplement"
          component={AddEditSupplementScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="AddEditWorkout"
          component={AddEditWorkoutScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="WeeklyReport"
          component={WeeklyReportScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}
