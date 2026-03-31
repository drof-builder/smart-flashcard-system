import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, Deck } from '../types';
import { useDecks } from '../hooks/useDecks';
import DeckModal from '../components/DeckModal';

type Props = { navigation: NativeStackNavigationProp<MainStackParamList, 'DeckList'> };

export default function DeckListScreen({ navigation }: Props) {
  const { decks, loading, createDeck, updateDeck, deleteDeck } = useDecks();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);

  const filtered = decks.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => { setEditingDeck(null); setModalVisible(true); }}>
          <Text style={{ color: '#6366f1', fontSize: 16, marginRight: 8 }}>+ New</Text>
        </TouchableOpacity>
      ),
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={{ fontSize: 20, marginLeft: 8 }}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search decks..."
        value={search}
        onChangeText={setSearch}
      />
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{search ? 'No results' : 'No decks yet'}</Text>
          <Text style={styles.emptySubtitle}>
            {search ? 'Try a different search' : 'Tap "+ New" to create your first deck'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('DeckDetail', { deckId: item.id, deckName: item.name })}
              onLongPress={() =>
                Alert.alert(item.name, undefined, [
                  { text: 'Edit', onPress: () => { setEditingDeck(item); setModalVisible(true); } },
                  { text: 'Delete', style: 'destructive', onPress: () =>
                    Alert.alert('Delete Deck', `Delete "${item.name}"? All cards will be deleted.`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteDeck(item.id) },
                    ])
                  },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            >
              <Text style={styles.deckName}>{item.name}</Text>
              {item.description ? <Text style={styles.deckDesc}>{item.description}</Text> : null}
            </TouchableOpacity>
          )}
        />
      )}
      <DeckModal
        visible={modalVisible}
        deck={editingDeck}
        onClose={() => setModalVisible(false)}
        onSave={async (name, description) => {
          if (editingDeck) await updateDeck(editingDeck.id, name, description);
          else await createDeck(name, description);
          setModalVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  search: { margin: 16, padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 16 },
  card: { marginHorizontal: 16, marginBottom: 8, padding: 16, backgroundColor: '#fff', borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  deckName: { fontSize: 18, fontWeight: '600' },
  deckDesc: { color: '#6b7280', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#374151' },
  emptySubtitle: { color: '#6b7280', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
