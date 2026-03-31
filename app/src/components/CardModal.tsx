import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Card } from '../types';

type Props = {
  visible: boolean;
  card: Card | null;
  onClose: () => void;
  onSave: (front: string, back: string) => Promise<void>;
};

export default function CardModal({ visible, card, onClose, onSave }: Props) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setFront(card?.front ?? '');
      setBack(card?.back ?? '');
    }
  }, [visible, card]);

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) return;
    setLoading(true);
    try {
      await onSave(front.trim(), back.trim());
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save card.');
    } finally {
      setLoading(false);
    }
  };

  const canSave = front.trim().length > 0 && back.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{card ? 'Edit Card' : 'New Card'}</Text>
          <TextInput style={styles.input} placeholder="Front (question) *" value={front} onChangeText={setFront} multiline />
          <TextInput style={styles.input} placeholder="Back (answer) *" value={back} onChangeText={setBack} multiline />
          <TouchableOpacity
            style={[styles.save, (!canSave || loading) && styles.saveDisabled]}
            onPress={handleSave}
            disabled={!canSave || loading}
          >
            <Text style={styles.saveText}>{loading ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, minHeight: 60, textAlignVertical: 'top' },
  save: { backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancel: { padding: 16, alignItems: 'center' },
  cancelText: { color: '#6b7280', fontSize: 16 },
});
