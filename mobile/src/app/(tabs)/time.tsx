import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../lib/api';

export default function TimeTrackingScreen() {
  const queryClient = useQueryClient();

  const { data: active } = useQuery({
    queryKey: ['time-active'],
    queryFn: () => apiGet('/time-tracking/active'),
    refetchInterval: 30000,
  });

  const clockIn = useMutation({
    mutationFn: () => apiPost('/time-tracking/clock-in'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-active'] }),
  });

  const clockOut = useMutation({
    mutationFn: () => apiPost('/time-tracking/clock-out'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-active'] }),
  });

  const isClockedIn = !!active;

  return (
    <View style={styles.container}>
      <View style={styles.clockCard}>
        <Text style={styles.status}>
          {isClockedIn ? 'Eingestempelt' : 'Nicht eingestempelt'}
        </Text>
        {isClockedIn && (
          <Text style={styles.since}>
            seit {new Date(active.clockIn).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.clockButton, isClockedIn ? styles.clockOut : styles.clockIn]}
          onPress={() => isClockedIn ? clockOut.mutate() : clockIn.mutate()}
          disabled={clockIn.isPending || clockOut.isPending}
        >
          {(clockIn.isPending || clockOut.isPending) ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <Text style={styles.clockButtonText}>
              {isClockedIn ? 'Ausstempeln' : 'Einstempeln'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', padding: 24 },
  clockCard: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  status: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  since: { fontSize: 14, color: '#6366f1', marginBottom: 24 },
  clockButton: { width: 160, height: 160, borderRadius: 80, justifyContent: 'center', alignItems: 'center' },
  clockIn: { backgroundColor: '#6366f1' },
  clockOut: { backgroundColor: '#ef4444' },
  clockButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
