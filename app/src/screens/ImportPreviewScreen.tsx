import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../types';
import { ParsedCard } from '../lib/pdfParser';
import { formatCardBack } from '../lib/cardUtils';
import { getPendingImport, clearPendingImport } from '../lib/importStore';
import { supabase } from '../lib/supabase';
import ImportCardModal from '../components/ImportCardModal';
import Toast from '../components/Toast';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'ImportPreview'>;
  route: RouteProp<MainStackParamList, 'ImportPreview'>;
};

export default function ImportPreviewScreen({ navigation, route }: Props) {
  const { deckName } = route.params;
  const [cards, setCards] = useState<ParsedCard[]>([]);
  const [editingCard, setEditingCard] = useState<ParsedCard | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setCards(getPendingImport());
  }, []);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `${deckName} — ${cards.length} cards`,
    });
  }, [navigation, deckName, cards.length]);

  const handleEditSave = (updated: ParsedCard) => {
    setCards(prev =>
      prev.map(c => (c.questionNumber === updated.questionNumber ? updated : c))
    );
    setModalVisible(false);
  };

  const handleDelete = (questionNumber: number) => {
    Alert.alert('Remove Card', `Remove Q${questionNumber} from import?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setCards(prev => prev.filter(c => c.questionNumber !== questionNumber)),
      },
    ]);
  };

  const handleImport = async () => {
    if (cards.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: deck, error: deckError } = await supabase
        .from('decks')
        .insert({ name: deckName, user_id: user.id })
        .select()
        .single();

      if (deckError || !deck) throw new Error(deckError?.message ?? 'Failed to create deck');

      const cardRows = cards.map(c => ({
        deck_id: deck.id,
        front: c.front,
        back: formatCardBack(c),
      }));

      const { error: cardsError } = await supabase.from('cards').insert(cardRows);

      if (cardsError) throw new Error(cardsError.message);

      clearPendingImport();
      navigation.reset({
        index: 1,
        routes: [
          { name: 'DeckList' },
          { name: 'DeckDetail', params: { deckId: deck.id, deckName } },
        ],
      });
    } catch (error) {
      Alert.alert(
        'Import Error',
        error instanceof Error ? error.message : 'Failed to import cards.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        keyExtractor={item => String(item.questionNumber)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              setEditingCard(item);
              setModalVisible(true);
            }}
            onLongPress={() => handleDelete(item.questionNumber)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.qNum}>Q{item.questionNumber}</Text>
              <Text style={styles.answer}>Answer: {item.correctAnswer}</Text>
            </View>
            <Text style={styles.qText} numberOfLines={2}>
              {item.front}
            </Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.importBtn, (isSaving || cards.length === 0) && styles.importBtnDisabled]}
          onPress={handleImport}
          disabled={isSaving || cards.length === 0}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.importBtnText}>
              Import {cards.length} Card{cards.length !== 1 ? 's' : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ImportCardModal
        visible={modalVisible}
        card={editingCard}
        onClose={() => setModalVisible(false)}
        onSave={handleEditSave}
      />

      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  qNum: { fontWeight: '700', color: '#6366f1', fontSize: 14 },
  answer: { color: '#6b7280', fontSize: 13 },
  qText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  importBtn: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  importBtnDisabled: { opacity: 0.5 },
  importBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
