import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { borderTopColor: '#e2e8f0' },
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#1e293b',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="time" options={{ title: 'Zeiterfassung', tabBarLabel: 'Zeit' }} />
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarLabel: 'Feed' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Aufgaben', tabBarLabel: 'Aufgaben' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarLabel: 'Profil' }} />
    </Tabs>
  );
}
