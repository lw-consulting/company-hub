import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../../stores/auth.store';
import { apiGet, apiPatch, apiPost } from '../../lib/api';
import type { NotificationPreferences } from '@company-hub/shared';

type PushConfig = {
  webPushEnabled: boolean;
  vapidPublicKey: string | null;
  expoPushEnabled: boolean;
  expoProjectId: string | null;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  chat: { inApp: true, email: false, push: true },
  community: { inApp: true, email: false, push: false },
  tasks: { inApp: true, email: true, push: true },
  calendar: { inApp: true, email: true, push: true },
  leave: { inApp: true, email: true, push: true },
  time_tracking: { inApp: true, email: true, push: false },
  ai_assistants: { inApp: true, email: false, push: false },
  system: { inApp: true, email: true, push: true },
};

const sections: Array<{ key: keyof NotificationPreferences; label: string; description: string }> = [
  { key: 'chat', label: 'Chats', description: 'Privat- und Gruppenchats' },
  { key: 'community', label: 'Community', description: 'Beiträge und Reaktionen' },
  { key: 'tasks', label: 'Aufgaben', description: 'Zuweisungen und Fälligkeiten' },
  { key: 'calendar', label: 'Kalender', description: 'Termine und Einladungen' },
  { key: 'leave', label: 'Urlaubsanträge', description: 'Anträge und Entscheidungen' },
  { key: 'time_tracking', label: 'Zeiterfassung', description: 'Freigaben und Änderungsanträge' },
  { key: 'ai_assistants', label: 'KI-Assistenten', description: 'Antworten und Hinweise' },
  { key: 'system', label: 'System', description: 'Wichtige Portal-Meldungen' },
];

function normalizePreferences(value: NotificationPreferences | undefined): NotificationPreferences {
  if (!value) return DEFAULT_NOTIFICATION_PREFERENCES;

  return sections.reduce((acc, section) => {
    acc[section.key] = {
      inApp: value[section.key]?.inApp ?? DEFAULT_NOTIFICATION_PREFERENCES[section.key].inApp,
      email: value[section.key]?.email ?? DEFAULT_NOTIFICATION_PREFERENCES[section.key].email,
      push: value[section.key]?.push ?? DEFAULT_NOTIFICATION_PREFERENCES[section.key].push,
    };
    return acc;
  }, {} as NotificationPreferences);
}

export default function ProfileScreen() {
  const { user, logout, checkAuth } = useAuthStore();
  const [preferences, setPreferences] = useState<NotificationPreferences>(normalizePreferences(user?.notificationPreferences));
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('');

  useEffect(() => {
    setPreferences(normalizePreferences(user?.notificationPreferences));
  }, [user?.notificationPreferences]);

  const initials = useMemo(() => `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase(), [user?.firstName, user?.lastName]);

  const updateChannel = (
    section: keyof NotificationPreferences,
    channel: keyof NotificationPreferences[keyof NotificationPreferences],
    value: boolean,
  ) => {
    setPreferences((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [channel]: value,
      },
    }));
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      await apiPatch('/auth/me', { notificationPreferences: preferences });
      await checkAuth();
      Alert.alert('Gespeichert', 'Deine Benachrichtigungseinstellungen wurden aktualisiert.');
    } catch (error: any) {
      Alert.alert('Fehler', error?.message || 'Einstellungen konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const enableMobilePush = async () => {
    try {
      setPushBusy(true);
      const config = await apiGet<PushConfig>('/notifications/push-config');
      if (!config.expoProjectId) {
        throw new Error('Expo Push ist serverseitig noch nicht konfiguriert.');
      }

      const currentPermission = await Notifications.getPermissionsAsync();
      let finalStatus = currentPermission.status;

      if (finalStatus !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }

      if (finalStatus !== 'granted') {
        throw new Error('Push-Berechtigung wurde nicht erteilt.');
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: config.expoProjectId,
      });

      await apiPost('/notifications/push/expo-token', { token: token.data });
      setPushStatus('Mobile Push ist auf diesem Gerät aktiv.');
    } catch (error: any) {
      setPushStatus(error?.message || 'Mobile Push konnte nicht aktiviert werden.');
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.role}>{user?.role}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Benachrichtigungen</Text>
        <Text style={styles.sectionText}>
          Lege fest, welche Hinweise dich im Portal, per E-Mail und per Push erreichen dürfen.
        </Text>

        {sections.map((section) => (
          <View key={section.key} style={styles.preferenceBlock}>
            <View style={styles.preferenceHeader}>
              <Text style={styles.preferenceTitle}>{section.label}</Text>
              <Text style={styles.preferenceDescription}>{section.description}</Text>
            </View>
            <View style={styles.switchRow}>
              <Switch value={preferences[section.key].inApp} onValueChange={(value) => updateChannel(section.key, 'inApp', value)} />
              <Text style={styles.switchLabel}>Portal</Text>
            </View>
            <View style={styles.switchRow}>
              <Switch value={preferences[section.key].email} onValueChange={(value) => updateChannel(section.key, 'email', value)} />
              <Text style={styles.switchLabel}>E-Mail</Text>
            </View>
            <View style={styles.switchRow}>
              <Switch value={preferences[section.key].push} onValueChange={(value) => updateChannel(section.key, 'push', value)} />
              <Text style={styles.switchLabel}>Push</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.primaryButton} onPress={savePreferences} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? 'Speichert...' : 'Einstellungen speichern'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Mobile Push</Text>
        <Text style={styles.sectionText}>
          Registriere dieses Gerät für Push-Nachrichten aus Chats, Aufgaben, Kalender und weiteren Modulen.
        </Text>

        <TouchableOpacity style={styles.secondaryButton} onPress={enableMobilePush} disabled={pushBusy}>
          <Text style={styles.secondaryButtonText}>{pushBusy ? 'Aktiviert...' : 'Push auf diesem Gerät aktivieren'}</Text>
        </TouchableOpacity>

        {!!pushStatus && <Text style={styles.statusText}>{pushStatus}</Text>}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, gap: 16 },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#6366f1' },
  name: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  email: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  role: {
    fontSize: 12,
    color: '#6366f1',
    marginTop: 8,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  sectionText: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  preferenceBlock: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  preferenceHeader: { gap: 2, marginBottom: 4 },
  preferenceTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  preferenceDescription: { fontSize: 13, color: '#64748b' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 14, color: '#334155', minWidth: 64, textAlign: 'right' },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#4338ca', fontSize: 15, fontWeight: '700' },
  statusText: { fontSize: 13, color: '#475569' },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 24,
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
});
