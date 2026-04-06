import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList, Card } from '../types';
import { useReviews } from '../hooks/useReviews';
import Toast from '../components/Toast';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'FlipCards'>;
  route: RouteProp<MainStackParamList, 'FlipCards'>;
};

export default function FlipCardScreen({ navigation, route }: Props) {
  const { deckId, deckName, practiceMode } = route.params;
  const { getDueCards, saveReview, getReviewForCard } = useReviews(deckId);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRating, setIsRating] = useState(false);

  useEffect(() => {
    getDueCards()
      .then(c => { setCards(c); setLoading(false); })
      .catch(() => { setLoadError('Could not load cards. Check your connection.'); setLoading(false); });
  }, [getDueCards]);

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

  const handleRate = async (rating: number) => {
    if (isRating) return;
    setIsRating(true);
    try {
      if (!practiceMode) {
        const existing = await getReviewForCard(card.id);
        const saveError = await saveReview(card, rating, existing);
        if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
      }
      const newCorrect = rating >= 3 ? correctCount + 1 : correctCount;
      const nextIndex = index + 1;
      if (nextIndex >= cards.length) {
        navigation.replace('SessionSummary', {
          result: { total: cards.length, correct: newCorrect },
          deckId,
          deckName,
        });
      } else {
        if (rating >= 3) setCorrectCount(c => c + 1);
        setFlipped(false);
        setIndex(nextIndex);
      }
    } finally {
      setIsRating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>{index + 1} / {cards.length}</Text>

      <TouchableOpacity style={styles.card} onPress={() => setFlipped(f => !f)} activeOpacity={0.9}>
        <Text style={styles.cardLabel}>{flipped ? 'Answer' : 'Question'}</Text>
        <Text style={styles.cardText}>{flipped ? card.back : card.front}</Text>
        {!flipped && <Text style={styles.tapHint}>Tap to reveal answer</Text>}
      </TouchableOpacity>

      {flipped && (
        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>How well did you know this?</Text>
          <View style={styles.ratingRow}>
            {([0, 1, 2, 3, 4, 5] as const).map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.ratingBtn, r < 3 && styles.ratingBtnFail, isRating && { opacity: 0.6 }]}
                onPress={() => handleRate(r)}
                disabled={isRating}
              >
                <Text style={styles.ratingNum}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.ratingLegend}>
            <Text style={styles.legendText}>0–2: Forgot</Text>
            <Text style={styles.legendText}>3–5: Remembered</Text>
          </View>
        </View>
      )}

      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb', alignItems: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 16, color: '#374151', textAlign: 'center', marginBottom: 24 },
  backBtn: { backgroundColor: '#6366f1', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  progress: { alignSelf: 'flex-end', color: '#6b7280', marginBottom: 16 },
  card: { width: '100%', minHeight: 220, backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, marginBottom: 32, position: 'relative' },
  cardLabel: { position: 'absolute', top: 14, left: 16, color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardText: { fontSize: 22, fontWeight: '500', textAlign: 'center', lineHeight: 32 },
  tapHint: { position: 'absolute', bottom: 14, color: '#9ca3af', fontSize: 12 },
  ratingSection: { width: '100%' },
  ratingLabel: { textAlign: 'center', color: '#374151', marginBottom: 16, fontSize: 16, fontWeight: '500' },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  ratingBtn: { flex: 1, margin: 4, paddingVertical: 14, backgroundColor: '#10b981', borderRadius: 8, alignItems: 'center' },
  ratingBtnFail: { backgroundColor: '#ef4444' },
  ratingNum: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  ratingLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendText: { color: '#9ca3af', fontSize: 12 },
});
