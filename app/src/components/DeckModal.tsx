import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Deck } from '../types';

type Props = {
  visible: boolean;
  deck: Deck | null;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
};

export default function DeckModal({ visible, deck, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(deck?.name ?? '');
      setDescription(deck?.description ?? '');
    }
  }, [visible, deck]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSave(name.trim(), description.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{deck ? 'Edit Deck' : 'New Deck'}</Text>
          <TextInput style={styles.input} placeholder="Deck name *" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Description (optional)" value={description} onChangeText={setDescription} multiline />
          <TouchableOpacity
            style={[styles.save, (!name.trim() || loading) && styles.saveDisabled]}
            onPress={handleSave}
            disabled={!name.trim() || loading}
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
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  save: { backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancel: { padding: 16, alignItems: 'center' },
  cancelText: { color: '#6b7280', fontSize: 16 },
});
