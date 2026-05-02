import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import CalendarScreen from './src/screens/CalendarScreen';
import DayDetailScreen from './src/screens/DayDetailScreen';
import AddEditSupplementScreen from './src/screens/AddEditSupplementScreen';
import AddEditWorkoutScreen from './src/screens/AddEditWorkoutScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WeeklyReportScreen from './src/screens/WeeklyReportScreen';
import LaborScreen from './src/screens/LaborScreen';
import AddEditLaborScreen from './src/screens/AddEditLaborScreen';
import ContractionsScreen from './src/screens/ContractionsScreen';
import AppHeader from './src/components/AppHeader';
import { scheduleReminders } from './src/notifications';
import { RootStackParamList } from './src/types';
import { getTabAnimationDirection } from './src/navAnimation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const TAB_ROUTES = ['Calendar', 'Labor', 'Contractions', 'Settings'] as const;

function isTabRoute(name: string): name is (typeof TAB_ROUTES)[number] {
  return (TAB_ROUTES as readonly string[]).includes(name);
}

function AppNavigator() {
  const { colors, isDark, settings } = useTheme();
  const containerRef = useNavigationContainerRef<RootStackParamList>();
  const [routeName, setRouteName] = useState<keyof RootStackParamList>('Calendar');

  // Reschedule whenever the reminders list reference changes (added/removed/edited).
  useEffect(() => {
    scheduleReminders(settings);
  }, [settings.remindersEnabled, settings.reminders]);

  // Track the current route so the hoisted AppHeader knows which tab is active
  // and whether to render at all (only on tab routes).
  useEffect(() => {
    const onChange = () => {
      const r = containerRef.getCurrentRoute();
      if (r) setRouteName(r.name as keyof RootStackParamList);
    };
    const unsub = containerRef.addListener('state', onChange);
    return unsub;
  }, [containerRef]);

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
    <NavigationContainer ref={containerRef} theme={navTheme}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {isTabRoute(routeName) && <AppHeader activeRoute={routeName} />}
        <View style={{ flex: 1 }}>
          <Stack.Navigator
            initialRouteName="Calendar"
            screenOptions={({ route }) => ({
              headerShown: false,
              animation: isTabRoute(route.name)
                ? getTabAnimationDirection()
                : 'slide_from_right',
            })}
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
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} />
            <Stack.Screen name="Labor" component={LaborScreen} />
            <Stack.Screen
              name="AddEditLabor"
              component={AddEditLaborScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="Contractions" component={ContractionsScreen} />
          </Stack.Navigator>
        </View>
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
