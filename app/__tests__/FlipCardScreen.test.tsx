import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import FlipCardScreen from '../src/screens/FlipCardScreen';

// Mock supabase
jest.mock('../src/lib/supabase');
import { mockQueryResult, mockGetSession } from '../src/lib/supabase';

// Mock useReviews hook
jest.mock('../src/hooks/useReviews');
import { useReviews } from '../src/hooks/useReviews';

// Card fixture helpers
const makeCard = (id: string, front: string, back: string) => ({
  id,
  deck_id: 'deck-1',
  front,
  back,
  created_at: '2024-01-01T00:00:00Z',
});

const card1 = makeCard('c1', 'Capital of France?', 'Paris');
const card2 = makeCard('c2', 'Capital of Spain?', 'Madrid');

// Navigation / route props
const mockNavigation = { replace: jest.fn(), goBack: jest.fn() };
const mockRoute = { params: { deckId: 'deck-1', deckName: 'Geography' } };

// Default mock implementations — overridden per test as needed
let mockGetDueCards: jest.Mock;
let mockSaveReview: jest.Mock;
let mockGetReviewForCard: jest.Mock;
let mockGetDueCount: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();

  mockQueryResult.mockResolvedValue({ data: [], error: null });
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-123' } } } });

  mockGetDueCards = jest.fn().mockResolvedValue([card1]);
  mockSaveReview = jest.fn().mockResolvedValue(null);
  mockGetReviewForCard = jest.fn().mockResolvedValue(null);
  mockGetDueCount = jest.fn().mockResolvedValue(1);

  (useReviews as jest.Mock).mockReturnValue({
    getDueCards: mockGetDueCards,
    saveReview: mockSaveReview,
    getReviewForCard: mockGetReviewForCard,
    getDueCount: mockGetDueCount,
  });
});

describe('FlipCardScreen', () => {
  // 1. Shows loading indicator while getDueCards is pending
  test('shows loading indicator while getDueCards is pending', () => {
    mockGetDueCards.mockReturnValue(new Promise(() => {}));
    (useReviews as jest.Mock).mockReturnValue({
      getDueCards: mockGetDueCards,
      saveReview: mockSaveReview,
      getReviewForCard: mockGetReviewForCard,
      getDueCount: mockGetDueCount,
    });

    const { UNSAFE_getByType } = render(
      <FlipCardScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  // 2. Shows "No cards due" message when getDueCards returns []
  test('shows "No cards due" message when getDueCards returns []', async () => {
    mockGetDueCards.mockResolvedValue([]);
    (useReviews as jest.Mock).mockReturnValue({
      getDueCards: mockGetDueCards,
      saveReview: mockSaveReview,
      getReviewForCard: mockGetReviewForCard,
      getDueCount: mockGetDueCount,
    });

    const { getByText } = render(
      <FlipCardScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('No cards due for review.')).toBeTruthy();
    });
  });

  // 3. Renders card front on initial render
  test('renders card front on initial render', async () => {
    const { getByText } = render(
      <FlipCardScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('Capital of France?')).toBeTruthy();
    });
  });

  // 4. Does not show answer before card is flipped
  test('does not show answer before card is flipped', async () => {
    const { queryByText, getByText } = render(
      <FlipCardScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    // Wait for card to load
    await waitFor(() => {
      expect(getByText('Capital of France?')).toBeTruthy();
    });

    expect(queryByText('Paris')).toBeNull();
  });

  // 5. Flipping the card reveals the answer
  test('flipping the card reveals the answer', async () => {
    const { getByText } = render(
      <FlipCardScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    // Wait for card to load
    await waitFor(() => {
      expect(getByText('Capital of France?')).toBeTruthy();
    });

    // Tap the card to flip
    fireEvent.press(getByText('Capital of France?'));

    await waitFor(() => {
      expect(getByText('Paris')).toBeTruthy();
    });
  });

  // 6. Rating buttons appear after card is flipped
  test('rating buttons appear after card is flipped', async () => {
    const { getByText, queryByText } = render(
      <FlipCardScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    // Wait for card to load
    await waitFor(() => {
      expect(getByText('Capital of France?')).toBeTruthy();
    });

    // Rating buttons should NOT be present before flip
    expect(queryByText('0')).toBeNull();

    // Flip the card
    fireEvent.press(getByText('Capital of France?'));

    await waitFor(() => {
      expect(getByText('0')).toBeTruthy();
      expect(getByText('1')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
      expect(getByText('3')).toBeTruthy();
      expect(getByText('4')).toBeTruthy();
      expect(getByText('5')).toBeTruthy();
    });
  });

  // 7. Rating >= 3 counts as pass — navigates with correct: 1
  test('rating >= 3 counts as pass — navigates with correct: 1', async () => {
    const { getByText } = render(
      <FlipCardScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('Capital of France?')).toBeTruthy();
    });

    // Flip the card
    fireEvent.press(getByText('Capital of France?'));

    await waitFor(() => {
      expect(getByText('4')).toBeTruthy();
    });

    // Press rating 4
    await act(async () => {
      fireEvent.press(getByText('4'));
    });

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith(
        'SessionSummary',
        expect.objectContaining({
          result: expect.objectContaining({ correct: 1 }),
        }),
      );
    });
  });

  // 8. Rating < 3 counts as fail — navigates with correct: 0
  test('rating < 3 counts as fail — navigates with correct: 0', async () => {
    const { getByText } = render(
      <FlipCardScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('Capital of France?')).toBeTruthy();
    });

    // Flip the card
    fireEvent.press(getByText('Capital of France?'));

    await waitFor(() => {
      expect(getByText('2')).toBeTruthy();
    });

    // Press rating 2
    await act(async () => {
      fireEvent.press(getByText('2'));
    });

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith(
        'SessionSummary',
        expect.objectContaining({
          result: expect.objectContaining({ correct: 0 }),
        }),
      );
    });
  });

  // 9. Advances to next card without navigating when more cards remain
  test('advances to next card without navigating when more cards remain', async () => {
    mockGetDueCards.mockResolvedValue([card1, card2]);
    (useReviews as jest.Mock).mockReturnValue({
      getDueCards: mockGetDueCards,
      saveReview: mockSaveReview,
      getReviewForCard: mockGetReviewForCard,
      getDueCount: mockGetDueCount,
    });

    const { getByText } = render(
      <FlipCardScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    // Wait for card1 to load
    await waitFor(() => {
      expect(getByText('Capital of France?')).toBeTruthy();
    });

    // Flip card1
    fireEvent.press(getByText('Capital of France?'));

    await waitFor(() => {
      expect(getByText('4')).toBeTruthy();
    });

    // Rate card1 with 4
    await act(async () => {
      fireEvent.press(getByText('4'));
    });

    // Should now show card2, no navigation
    await waitFor(() => {
      expect(getByText('Capital of Spain?')).toBeTruthy();
    });

    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  // 10. saveReview is called when a card is rated
  test('saveReview is called when a card is rated', async () => {
    const { getByText } = render(
      <FlipCardScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('Capital of France?')).toBeTruthy();
    });

    // Flip the card
    fireEvent.press(getByText('Capital of France?'));

    await waitFor(() => {
      expect(getByText('3')).toBeTruthy();
    });

    // Press rating 3
    await act(async () => {
      fireEvent.press(getByText('3'));
    });

    await waitFor(() => {
      expect(mockSaveReview).toHaveBeenCalled();
    });
  });
});
