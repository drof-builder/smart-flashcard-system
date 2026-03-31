import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../types';

export function useCards(deckId: string) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('deck_id', deckId)
        .order('created_at', { ascending: true });
      if (error) setError(error.message);
      else setCards(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const createCard = async (front: string, back: string): Promise<string | null> => {
    const { error } = await supabase.from('cards').insert({ deck_id: deckId, front, back });
    if (error) return error.message;
    await fetchCards();
    return null;
  };

  const updateCard = async (id: string, front: string, back: string): Promise<string | null> => {
    const { error } = await supabase.from('cards').update({ front, back }).eq('id', id);
    if (error) return error.message;
    await fetchCards();
    return null;
  };

  const deleteCard = async (id: string): Promise<string | null> => {
    const { error } = await supabase.from('cards').delete().eq('id', id);
    if (error) return error.message;
    await fetchCards();
    return null;
  };

  return { cards, loading, error, createCard, updateCard, deleteCard, refetch: fetchCards };
}
