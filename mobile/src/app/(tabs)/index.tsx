import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuthStore } from '../../stores/auth.store';

export default function DashboardScreen() {
  const { user } = useAuthStore();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.welcome}>
        <Text style={styles.welcomeText}>Willkommen, {user?.firstName}!</Text>
        <Text style={styles.subtitle}>Hier ist Ihre Übersicht.</Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Arbeitszeit" value="--:--" />
        <StatCard label="Resturlaub" value="25 T" />
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Aufgaben" value="--" />
        <StatCard label="Beiträge" value="--" />
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  welcome: { padding: 20, paddingTop: 8 },
  welcomeText: { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  subtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
});
