import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList, Card } from '../types';
import { useReviews } from '../hooks/useReviews';
import { useCards } from '../hooks/useCards';
import Toast from '../components/Toast';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'MultipleChoice'>;
  route: RouteProp<MainStackParamList, 'MultipleChoice'>;
};

function buildOptions(correct: Card, allCards: Card[]): string[] {
  const distractors = allCards
    .filter(c => c.id !== correct.id)
    .map(c => c.back)
    .filter(v => v !== correct.back)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  return [...distractors, correct.back].sort(() => Math.random() - 0.5);
}

export default function MultipleChoiceScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { getDueCards, saveReview, getReviewForCard } = useReviews(deckId);
  const { cards: allCards } = useCards(deckId);
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getDueCards()
      .then(c => { setDueCards(c); setLoading(false); })
      .catch(() => { setLoadError('Could not load cards. Check your connection.'); setLoading(false); });
  }, [getDueCards]);

  useEffect(() => {
    if (dueCards.length > 0 && allCards.length >= 4 && index < dueCards.length) {
      setOptions(buildOptions(dueCards[index], allCards));
      setSelected(null);
    }
  }, [index, dueCards, allCards]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  if (loadError) return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{loadError}</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const card = dueCards[index];

  const handleSelect = async (option: string) => {
    if (selected !== null || isSaving) return;
    setIsSaving(true);
    setSelected(option);
    const isCorrect = option === card.back;
    const rating = isCorrect ? 4 : 1;
    const newCorrect = isCorrect ? correctCount + 1 : correctCount;
    const existing = await getReviewForCard(card.id);
    const saveError = await saveReview(card, rating, existing);
    if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
    setIsSaving(false);
    setTimeout(() => {
      const nextIndex = index + 1;
      if (nextIndex >= dueCards.length) {
        navigation.replace('SessionSummary', {
          result: { total: dueCards.length, correct: newCorrect },
          deckId,
          deckName,
        });
      } else {
        if (isCorrect) setCorrectCount(c => c + 1);
        setIndex(nextIndex);
      }
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>{index + 1} / {dueCards.length}</Text>
      <View style={styles.questionCard}>
        <Text style={styles.question}>{card.front}</Text>
      </View>
      <View style={styles.options}>
        {options.map((opt, i) => {
          let bg = '#fff';
          let border = '#e5e7eb';
          if (selected !== null) {
            if (opt === card.back) { bg = '#dcfce7'; border = '#16a34a'; }
            else if (opt === selected) { bg = '#fee2e2'; border = '#dc2626'; }
          }
          return (
            <TouchableOpacity
              key={i}
              style={[styles.option, { backgroundColor: bg, borderColor: border }]}
              onPress={() => handleSelect(opt)}
              disabled={selected !== null || isSaving}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
    </View>
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
  options: { gap: 12 },
  option: { borderWidth: 2, borderRadius: 12, padding: 16 },
  optionText: { fontSize: 16 },
});
