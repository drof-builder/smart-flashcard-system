import { Card, CardReview } from '../types';

export function useReviews(_deckId: string) {
  return {
    getDueCount: async (): Promise<number> => 0,
    getDueCards: async (): Promise<Card[]> => [],
    saveReview: async (_card: Card, _rating: number, _existing: CardReview | null): Promise<string | null> => null,
    getReviewForCard: async (_cardId: string): Promise<CardReview | null> => null,
  };
}
