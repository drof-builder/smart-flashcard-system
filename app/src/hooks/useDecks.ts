import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Deck } from '../types';

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDecks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('decks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setDecks(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDecks(); }, [fetchDecks]);

  const createDeck = async (name: string, description: string): Promise<string | null> => {
    const { error } = await supabase.from('decks').insert({ name, description: description || null });
    if (error) return error.message;
    await fetchDecks();
    return null;
  };

  const updateDeck = async (id: string, name: string, description: string): Promise<string | null> => {
    const { error } = await supabase.from('decks').update({ name, description: description || null }).eq('id', id);
    if (error) return error.message;
    await fetchDecks();
    return null;
  };

  const deleteDeck = async (id: string): Promise<string | null> => {
    const { error } = await supabase.from('decks').delete().eq('id', id);
    if (error) return error.message;
    await fetchDecks();
    return null;
  };

  return { decks, loading, error, createDeck, updateDeck, deleteDeck, refetch: fetchDecks };
}
