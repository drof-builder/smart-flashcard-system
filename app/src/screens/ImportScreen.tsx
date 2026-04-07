import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types';
import * as DocumentPicker from 'expo-document-picker';
import { parseZipFile } from '../lib/pdfParser';
import { setPendingImport } from '../lib/importStore';
import Toast from '../components/Toast';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'ImportDeck'>;
};

function fileNameToDeckName(fileName: string): string {
  return fileName
    .replace(/\.zip$/i, '')
    .replace(/[_-]/g, ' ')
    .trim();
}

export default function ImportScreen({ navigation }: Props) {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [deckName, setDeckName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/zip',
      copyToCacheDirectory: true,
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setFileUri(asset.uri);
    setFileName(asset.name);
    setDeckName(fileNameToDeckName(asset.name));
  };

  const handleParse = async () => {
    if (!fileUri || !deckName.trim()) return;
    setIsParsing(true);
    try {
      const { cards, skipped } = await parseZipFile(fileUri);

      if (cards.length === 0) {
        Alert.alert('No Cards Found', 'Could not extract any questions from this ZIP file.');
        return;
      }

      if (skipped > 0) {
        setToastMessage(`Skipped ${skipped} question${skipped > 1 ? 's' : ''} (figures or parse errors)`);
      }

      setPendingImport(cards);
      navigation.navigate('ImportPreview', { deckName: deckName.trim() });
    } catch (error) {
      Alert.alert(
        'Parse Error',
        error instanceof Error ? error.message : 'Failed to parse the ZIP file.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const canParse = fileUri !== null && deckName.trim().length > 0 && !isParsing;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>ZIP File</Text>
      <TouchableOpacity style={styles.filePicker} onPress={handlePickFile} disabled={isParsing}>
        <Text style={styles.filePickerText}>
          {fileName ?? 'Choose ZIP File'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Deck Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter deck name"
        value={deckName}
        onChangeText={setDeckName}
        editable={!isParsing}
      />

      <TouchableOpacity
        style={[styles.parseBtn, !canParse && styles.parseBtnDisabled]}
        onPress={handleParse}
        disabled={!canParse}
      >
        {isParsing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.parseBtnText}>Parse PDF</Text>
        )}
      </TouchableOpacity>

      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  filePicker: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  filePickerText: { fontSize: 16, color: '#6366f1' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  parseBtn: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  parseBtnDisabled: { opacity: 0.5 },
  parseBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
