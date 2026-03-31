import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardReview } from '../types';
import { applyReview, ReviewCard } from '../lib/sm2';

export function useReviews(deckId: string) {
  const getDueCards = useCallback(async (): Promise<Card[]> => {
    const today = new Date().toISOString().split('T')[0];

    const { data: allCards, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId);

    if (cardsError || !allCards || allCards.length === 0) return [];

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user.id;
    if (!userId) return [];

    const { data: futureReviews } = await supabase
      .from('card_reviews')
      .select('card_id')
      .eq('user_id', userId)
      .in('card_id', allCards.map(c => c.id))
      .gt('next_review_date', today);

    const notDueIds = new Set((futureReviews ?? []).map((r: { card_id: string }) => r.card_id));

    return allCards.filter(c => !notDueIds.has(c.id));
  }, [deckId]);

  const getDueCount = useCallback(async (): Promise<number> => {
    const cards = await getDueCards();
    return cards.length;
  }, [getDueCards]);

  const getReviewForCard = useCallback(async (cardId: string): Promise<CardReview | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user.id;
    if (!userId) return null;
    const { data } = await supabase
      .from('card_reviews')
      .select('*')
      .eq('card_id', cardId)
      .eq('user_id', userId)
      .maybeSingle();
    return data ?? null;
  }, []);

  const saveReview = useCallback(async (
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
    if (!userId) return 'Not authenticated';

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
  }, []);

  return { getDueCards, getDueCount, getReviewForCard, saveReview };
}
