import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardReview } from '../types';
import { applyReview, ReviewCard } from '../lib/sm2';

export function useReviews(deckId: string) {
  const getDueCards = useCallback(async (): Promise<Card[]> => {
    const today = new Date().toISOString().split('T')[0];

    // All cards in this deck
    const { data: allCards } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId);

    if (!allCards || allCards.length === 0) return [];

    // Cards that have been reviewed and are NOT due yet (next_review_date > today)
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user.id;

    const { data: futureReviews } = await supabase
      .from('card_reviews')
      .select('card_id')
      .eq('user_id', userId)
      .in('card_id', allCards.map(c => c.id))
      .gt('next_review_date', today);

    const notDueIds = new Set((futureReviews ?? []).map((r: { card_id: string }) => r.card_id));

    // Return cards that are either never reviewed OR due today
    return allCards.filter(c => !notDueIds.has(c.id));
  }, [deckId]);

  const getDueCount = useCallback(async (): Promise<number> => {
    const cards = await getDueCards();
    return cards.length;
  }, [getDueCards]);

  const getReviewForCard = async (cardId: string): Promise<CardReview | null> => {
    const { data } = await supabase
      .from('card_reviews')
      .select('*')
      .eq('card_id', cardId)
      .maybeSingle();
    return data ?? null;
  };

  const saveReview = async (
    card: Card,
    rating: number,
    existingReview: CardReview | null,
  ): Promise<string | null> => {
    const current: ReviewCard = existingReview ?? {
      ease_factor: 2.5,
      interval: 0,
      repetitions: 0,
    };

    const result = applyReview(current, rating);

    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user.id;

    const { error } = await supabase.from('card_reviews').upsert(
      {
        card_id: card.id,
        user_id: userId,
        ...result,
        last_reviewed_at: new Date().toISOString(),
      },
      { onConflict: 'card_id,user_id' },
    );

    return error?.message ?? null;
  };

  return { getDueCards, getDueCount, getReviewForCard, saveReview };
}
