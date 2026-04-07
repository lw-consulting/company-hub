import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../../lib/api';

export default function TasksScreen() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['tasks', 'me'],
    queryFn: () => apiGet<{ data: any[] }>('/tasks?assignedTo=me'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiPatch(`/tasks/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const tasks = data?.data || [];

  return (
    <FlatList
      style={styles.container}
      data={tasks}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <View style={styles.empty}><Text style={styles.emptyText}>Keine Aufgaben</Text></View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.taskCard}
          onPress={() => toggleMutation.mutate({
            id: item.id,
            status: item.status === 'done' ? 'open' : 'done',
          })}
        >
          <View style={[styles.checkbox, item.status === 'done' && styles.checkboxDone]}>
            {item.status === 'done' && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.taskContent}>
            <Text style={[styles.taskTitle, item.status === 'done' && styles.taskDone]}>{item.title}</Text>
            {item.dueDate && <Text style={styles.dueDate}>Fällig: {item.dueDate}</Text>}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 16, gap: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
  checkboxDone: { backgroundColor: '#10b981', borderColor: '#10b981' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: 14, fontWeight: '500', color: '#1e293b' },
  taskDone: { textDecorationLine: 'line-through', color: '#94a3b8' },
  dueDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
});
