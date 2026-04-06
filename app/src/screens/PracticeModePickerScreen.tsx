import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../types';
import { useReviews } from '../hooks/useReviews';
import { useCards } from '../hooks/useCards';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'PracticeModePicker'>;
  route: RouteProp<MainStackParamList, 'PracticeModePicker'>;
};

type Filter = 'all' | 'due';

export default function PracticeModePickerScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { getAllCards, getDueCards } = useReviews(deckId);
  const { cards } = useCards(deckId);
  const [filter, setFilter] = useState<Filter>('all');
  const [cardCount, setCardCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetch = filter === 'all' ? getAllCards : getDueCards;
    fetch()
      .then(c => { setCardCount(c.length); setLoading(false); })
      .catch(() => { setCardCount(0); setLoading(false); });
  }, [filter, getAllCards, getDueCards]);

  const canMultipleChoice = cards.length >= 4;

  const navigate = (mode: 'FlipCards' | 'MultipleChoice' | 'TypeAnswer') => {
    navigation.navigate(mode, { deckId, deckName, practiceMode: true });
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  return (
    <View style={styles.container}>
      <Text style={styles.deckName}>{deckName}</Text>

      {/* Filter toggle */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>
            All Cards
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'due' && styles.filterBtnActive]}
          onPress={() => setFilter('due')}
        >
          <Text style={[styles.filterBtnText, filter === 'due' && styles.filterBtnTextActive]}>
            Due Today
          </Text>
        </TouchableOpacity>
      </View>

      {cardCount === 0 && filter === 'due' ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No cards due today. Try "All Cards" instead.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.countText}>{cardCount} card{cardCount !== 1 ? 's' : ''} selected</Text>

          <TouchableOpacity style={styles.modeBtn} onPress={() => navigate('FlipCards')}>
            <Text style={styles.modeIcon}>🃏</Text>
            <View style={styles.modeInfo}>
              <Text style={styles.modeName}>Flip Cards</Text>
              <Text style={styles.modeDesc}>Tap to reveal, then rate your recall</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeBtn, !canMultipleChoice && styles.modeBtnDisabled]}
            disabled={!canMultipleChoice}
            onPress={() => navigate('MultipleChoice')}
          >
            <Text style={styles.modeIcon}>🔘</Text>
            <View style={styles.modeInfo}>
              <Text style={styles.modeName}>Multiple Choice</Text>
              <Text style={styles.modeDesc}>
                {canMultipleChoice ? '4 options, pick the correct one' : 'Need at least 4 cards in deck'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modeBtn} onPress={() => navigate('TypeAnswer')}>
            <Text style={styles.modeIcon}>⌨️</Text>
            <View style={styles.modeInfo}>
              <Text style={styles.modeName}>Type Answer</Text>
              <Text style={styles.modeDesc}>Type the answer from memory</Text>
            </View>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  deckName: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  filterRow: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, padding: 4, marginBottom: 20 },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  filterBtnActive: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  filterBtnText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  filterBtnTextActive: { color: '#6366f1' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#6b7280', fontSize: 16, textAlign: 'center' },
  countText: { color: '#f59e0b', fontWeight: '600', fontSize: 15, marginBottom: 24 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 16, gap: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  modeBtnDisabled: { opacity: 0.4 },
  modeIcon: { fontSize: 32 },
  modeInfo: { flex: 1 },
  modeName: { fontSize: 18, fontWeight: '600' },
  modeDesc: { color: '#6b7280', marginTop: 2, fontSize: 14 },
});
