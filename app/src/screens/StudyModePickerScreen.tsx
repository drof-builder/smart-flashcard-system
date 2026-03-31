import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../types';
import { useReviews } from '../hooks/useReviews';
import { useCards } from '../hooks/useCards';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'StudyModePicker'>;
  route: RouteProp<MainStackParamList, 'StudyModePicker'>;
};

export default function StudyModePickerScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { getDueCount } = useReviews(deckId);
  const { cards } = useCards(deckId);
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getDueCount()
      .then(setDueCount)
      .catch(() => setLoadError('Could not load due cards. Check your connection.'));
  }, [getDueCount]);

  if (dueCount === null) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  if (loadError) return (
    <View style={styles.centered}>
      <Text style={styles.allCaughtUp}>Something went wrong</Text>
      <Text style={styles.subtitle}>{loadError}</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  if (dueCount === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.trophy}>🎉</Text>
        <Text style={styles.allCaughtUp}>All caught up!</Text>
        <Text style={styles.subtitle}>No cards due today. Come back tomorrow.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canMultipleChoice = cards.length >= 4;

  return (
    <View style={styles.container}>
      <Text style={styles.deckName}>{deckName}</Text>
      <Text style={styles.dueText}>{dueCount} cards due today</Text>

      <TouchableOpacity
        style={styles.modeBtn}
        onPress={() => navigation.navigate('FlipCards', { deckId, deckName })}
      >
        <Text style={styles.modeIcon}>🃏</Text>
        <View style={styles.modeInfo}>
          <Text style={styles.modeName}>Flip Cards</Text>
          <Text style={styles.modeDesc}>Tap to reveal, then rate your recall</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.modeBtn, !canMultipleChoice && styles.modeBtnDisabled]}
        disabled={!canMultipleChoice}
        onPress={() => navigation.navigate('MultipleChoice', { deckId, deckName })}
      >
        <Text style={styles.modeIcon}>🔘</Text>
        <View style={styles.modeInfo}>
          <Text style={styles.modeName}>Multiple Choice</Text>
          <Text style={styles.modeDesc}>
            {canMultipleChoice ? '4 options, pick the correct one' : 'Need at least 4 cards in deck'}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.modeBtn}
        onPress={() => navigation.navigate('TypeAnswer', { deckId, deckName })}
      >
        <Text style={styles.modeIcon}>⌨️</Text>
        <View style={styles.modeInfo}>
          <Text style={styles.modeName}>Type Answer</Text>
          <Text style={styles.modeDesc}>Type the answer from memory</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  trophy: { fontSize: 56, marginBottom: 16 },
  allCaughtUp: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#6b7280', fontSize: 16, marginBottom: 32, textAlign: 'center' },
  backBtn: { backgroundColor: '#6366f1', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  deckName: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  dueText: { color: '#f59e0b', fontSize: 16, fontWeight: '600', marginBottom: 32 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 16, gap: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  modeBtnDisabled: { opacity: 0.4 },
  modeIcon: { fontSize: 32 },
  modeInfo: { flex: 1 },
  modeName: { fontSize: 18, fontWeight: '600' },
  modeDesc: { color: '#6b7280', marginTop: 2, fontSize: 14 },
});
