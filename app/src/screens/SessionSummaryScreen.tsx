import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'SessionSummary'>;
  route: RouteProp<MainStackParamList, 'SessionSummary'>;
};

export default function SessionSummaryScreen({ navigation, route }: Props) {
  const { result, deckId, deckName } = route.params;
  const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;

  const emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪';

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>Session Complete!</Text>

      <View style={styles.scoreCard}>
        <Text style={styles.pct}>{pct}%</Text>
        <Text style={styles.detail}>{result.correct} / {result.total} correct</Text>
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => navigation.navigate('DeckDetail', { deckId, deckName })}
      >
        <Text style={styles.btnText}>Back to Deck</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnSecondary]}
        onPress={() => navigation.navigate('StudyModePicker', { deckId, deckName })}
      >
        <Text style={[styles.btnText, styles.btnTextSecondary]}>Study Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 60, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32 },
  scoreCard: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 40, alignItems: 'center', marginBottom: 40, elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8 },
  pct: { fontSize: 64, fontWeight: 'bold', color: '#6366f1' },
  detail: { fontSize: 18, color: '#6b7280', marginTop: 8 },
  btn: { width: '100%', backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnSecondary: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#6366f1' },
  btnTextSecondary: { color: '#6366f1' },
});
