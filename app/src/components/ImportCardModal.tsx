import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { ParsedCard } from '../lib/pdfParser';

type Props = {
  visible: boolean;
  card: ParsedCard | null;
  onClose: () => void;
  onSave: (updated: ParsedCard) => void;
};

const LETTERS = ['a', 'b', 'c', 'd'] as const;

export default function ImportCardModal({ visible, card, onClose, onSave }: Props) {
  const [front, setFront] = useState('');
  const [optionTexts, setOptionTexts] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('a');

  useEffect(() => {
    if (visible && card) {
      setFront(card.front);
      setOptionTexts(
        card.options.map(o => o.replace(/^[a-d]\)\s*/, ''))
      );
      setCorrectAnswer(card.correctAnswer);
    }
  }, [visible, card]);

  const handleSave = () => {
    if (!card || !front.trim()) return;
    onSave({
      questionNumber: card.questionNumber,
      front: front.trim(),
      options: optionTexts.map((t, i) => `${LETTERS[i]}) ${t.trim()}`),
      correctAnswer,
    });
  };

  const canSave = front.trim().length > 0 && optionTexts.every(t => t.trim().length > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <ScrollView>
            <Text style={styles.title}>Edit Card (Q{card?.questionNumber})</Text>

            <Text style={styles.fieldLabel}>Question</Text>
            <TextInput
              style={styles.input}
              value={front}
              onChangeText={setFront}
              multiline
            />

            {LETTERS.map((letter, i) => (
              <View key={letter}>
                <Text style={styles.fieldLabel}>Option {letter})</Text>
                <TextInput
                  style={styles.input}
                  value={optionTexts[i]}
                  onChangeText={text => {
                    const updated = [...optionTexts];
                    updated[i] = text;
                    setOptionTexts(updated);
                  }}
                  multiline
                />
              </View>
            ))}

            <Text style={styles.fieldLabel}>Correct Answer</Text>
            <View style={styles.answerRow}>
              {LETTERS.map(letter => (
                <TouchableOpacity
                  key={letter}
                  style={[
                    styles.answerBtn,
                    correctAnswer === letter && styles.answerBtnSelected,
                  ]}
                  onPress={() => setCorrectAnswer(letter)}
                >
                  <Text
                    style={[
                      styles.answerBtnText,
                      correctAnswer === letter && styles.answerBtnTextSelected,
                    ]}
                  >
                    {letter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    maxHeight: '85%',
  },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: '#f9fafb',
    minHeight: 44,
    textAlignVertical: 'top',
  },
  answerRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  answerBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  answerBtnSelected: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  answerBtnText: { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  answerBtnTextSelected: { color: '#6366f1' },
  saveBtn: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontSize: 16 },
});
