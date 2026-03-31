import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setMessage(error.message); setIsError(true); }
      else { setMessage('Password updated successfully.'); setIsError(false); setNewPassword(''); }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.section}>Change Password</Text>
      <TextInput
        style={styles.input}
        placeholder="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
      />
      {message && (
        <Text style={[styles.message, isError && styles.messageError]}>{message}</Text>
      )}
      <TouchableOpacity
        style={[styles.btn, (!newPassword.trim() || loading) && styles.btnDisabled]}
        onPress={handleChangePassword}
        disabled={!newPassword.trim() || loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Update Password</Text>}
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleLogout}>
        <Text style={styles.btnText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  section: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff', marginBottom: 12 },
  message: { color: '#16a34a', marginBottom: 12, fontSize: 14 },
  messageError: { color: '#dc2626' },
  btn: { backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnDanger: { backgroundColor: '#ef4444' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 24 },
});
