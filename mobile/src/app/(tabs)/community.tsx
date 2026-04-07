import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

export default function CommunityScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['community-feed'],
    queryFn: () => apiGet<{ data: any[] }>('/community/feed'),
  });

  const posts = data?.data || [];

  return (
    <FlatList
      style={styles.container}
      data={posts}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#6366f1" />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Noch keine Beiträge</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.authorFirstName?.[0]}{item.authorLastName?.[0]}</Text>
            </View>
            <View>
              <Text style={styles.authorName}>{item.authorFirstName} {item.authorLastName}</Text>
              <Text style={styles.postTime}>{new Date(item.createdAt).toLocaleDateString('de-AT')}</Text>
            </View>
          </View>
          <Text style={styles.postContent}>{item.content}</Text>
          <View style={styles.postFooter}>
            <Text style={styles.footerText}>{item.likeCount || 0} Likes</Text>
            <Text style={styles.footerText}>{item.commentCount || 0} Kommentare</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  postCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 12, fontWeight: '600', color: '#6366f1' },
  authorName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  postTime: { fontSize: 11, color: '#94a3b8' },
  postContent: { fontSize: 14, color: '#334155', lineHeight: 20 },
  postFooter: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  footerText: { fontSize: 12, color: '#94a3b8' },
});
