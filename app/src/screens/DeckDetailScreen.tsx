import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList, Card } from '../types';
import { useCards } from '../hooks/useCards';
import { useReviews } from '../hooks/useReviews';
import CardModal from '../components/CardModal';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'DeckDetail'>;
  route: RouteProp<MainStackParamList, 'DeckDetail'>;
};

export default function DeckDetailScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { cards, loading, error, createCard, updateCard, deleteCard } = useCards(deckId);
  const { getDueCount } = useReviews(deckId);
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: deckName,
      headerRight: () => (
        <TouchableOpacity onPress={() => { setEditingCard(null); setModalVisible(true); }}>
          <Text style={{ color: '#6366f1', fontSize: 16, marginRight: 8 }}>+ Card</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, deckName]);

  useEffect(() => {
    getDueCount()
      .then(setDueCount)
      .catch(() => setDueCount(null));
  }, [cards, getDueCount]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;
  if (error) return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Failed to load cards</Text>
      <Text style={styles.emptySubtitle}>{error}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.meta}>{cards.length} cards</Text>
        {dueCount !== null && (
          <Text style={styles.due}>{dueCount} due today</Text>
        )}
        <TouchableOpacity
          style={[styles.studyBtn, cards.length === 0 && styles.studyBtnDisabled]}
          disabled={cards.length === 0}
          onPress={() => navigation.navigate('StudyModePicker', { deckId, deckName })}
        >
          <Text style={styles.studyBtnText}>Study →</Text>
        </TouchableOpacity>
      </View>

      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptySubtitle}>Tap "+ Card" to add your first card</Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => { setEditingCard(item); setModalVisible(true); }}
              onLongPress={() =>
                Alert.alert('Delete Card', 'Delete this card?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: async () => {
                    const err = await deleteCard(item.id);
                    if (err) Alert.alert('Error', err);
                  }},
                ])
              }
            >
              <Text style={styles.front}>{item.front}</Text>
              <Text style={styles.back}>{item.back}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <CardModal
        visible={modalVisible}
        card={editingCard}
        onClose={() => setModalVisible(false)}
        onSave={async (front, back) => {
          const err = editingCard
            ? await updateCard(editingCard.id, front, back)
            : await createCard(front, back);
          if (err) { Alert.alert('Error', err); return; }
          setModalVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', gap: 12 },
  meta: { color: '#6b7280', fontSize: 15 },
  due: { color: '#f59e0b', fontWeight: '600', fontSize: 15 },
  studyBtn: { marginLeft: 'auto', backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  studyBtnDisabled: { backgroundColor: '#d1d5db' },
  studyBtnText: { color: '#fff', fontWeight: 'bold' },
  card: { marginHorizontal: 16, marginTop: 8, padding: 16, backgroundColor: '#fff', borderRadius: 8, elevation: 2 },
  front: { fontSize: 16, fontWeight: '600' },
  back: { color: '#6b7280', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#374151' },
  emptySubtitle: { color: '#6b7280', marginTop: 8 },
});
