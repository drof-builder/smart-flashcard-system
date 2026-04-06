import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList, Card } from '../types';
import { useReviews } from '../hooks/useReviews';
import Toast from '../components/Toast';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'TypeAnswer'>;
  route: RouteProp<MainStackParamList, 'TypeAnswer'>;
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export default function TypeAnswerScreen({ navigation, route }: Props) {
  const { deckId, deckName, practiceMode, filterMode } = route.params;
  const { getDueCards, saveReview, getReviewForCard, getAllCards } = useReviews(deckId);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const load = practiceMode && filterMode === 'all' ? getAllCards : getDueCards;
    load()
      .then(c => { setCards(c); setLoading(false); })
      .catch(() => { setLoadError('Could not load cards. Check your connection.'); setLoading(false); });
  }, [getDueCards, getAllCards, practiceMode, filterMode]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  if (loadError) return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{loadError}</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  if (cards.length === 0) return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>No cards due for review.</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const card = cards[index];
  const isCorrect = submitted && normalize(input) === normalize(card.back);

  const handleSubmit = async () => {
    if (!input.trim() || submitted) return;
    setSubmitted(true);
    const correct = normalize(input) === normalize(card.back);
    const rating = correct ? 4 : 1;
    if (correct) setCorrectCount(c => c + 1);
    if (!practiceMode) {
      const existing = await getReviewForCard(card.id);
      const saveError = await saveReview(card, rating, existing);
      if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
    }
  };

  const handleNext = () => {
    const nextIndex = index + 1;
    if (nextIndex >= cards.length) {
      navigation.replace('SessionSummary', {
        result: { total: cards.length, correct: correctCount },
        deckId,
        deckName,
      });
    } else {
      setInput('');
      setSubmitted(false);
      setIndex(nextIndex);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.progress}>{index + 1} / {cards.length}</Text>
      <View style={styles.questionCard}>
        <Text style={styles.question}>{card.front}</Text>
      </View>
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          submitted && (isCorrect ? styles.inputCorrect : styles.inputWrong),
        ]}
        placeholder="Type your answer..."
        value={input}
        onChangeText={setInput}
        editable={!submitted}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
        autoCorrect={false}
      />
      {submitted && (
        <View style={styles.feedback}>
          <Text style={[styles.feedbackResult, isCorrect ? styles.correct : styles.wrong]}>
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </Text>
          {!isCorrect && (
            <Text style={styles.correctAnswer}>Correct answer: {card.back}</Text>
          )}
        </View>
      )}
      {!submitted ? (
        <TouchableOpacity
          style={[styles.btn, !input.trim() && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!input.trim()}
        >
          <Text style={styles.btnText}>Submit</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.btn} onPress={handleNext}>
          <Text style={styles.btnText}>Next →</Text>
        </TouchableOpacity>
      )}
      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 16, color: '#374151', textAlign: 'center', marginBottom: 24 },
  backBtn: { backgroundColor: '#6366f1', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  progress: { textAlign: 'right', color: '#6b7280', marginBottom: 16 },
  questionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 28, marginBottom: 24, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  question: { fontSize: 20, fontWeight: '500', textAlign: 'center', lineHeight: 28 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 16, fontSize: 16, backgroundColor: '#fff', marginBottom: 12 },
  inputCorrect: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  inputWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  feedback: { marginBottom: 16 },
  feedbackResult: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  correct: { color: '#16a34a' },
  wrong: { color: '#dc2626' },
  correctAnswer: { color: '#374151', fontSize: 16 },
  btn: { backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
