import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import MultipleChoiceScreen from '../src/screens/MultipleChoiceScreen';

// Mock supabase
jest.mock('../src/lib/supabase');
import { mockQueryResult, mockGetSession } from '../src/lib/supabase';

// Mock hooks
jest.mock('../src/hooks/useReviews');
jest.mock('../src/hooks/useCards');
import { useReviews } from '../src/hooks/useReviews';
import { useCards } from '../src/hooks/useCards';

// Card fixture
const makeCard = (id: string, back: string) => ({
  id,
  deck_id: 'deck-1',
  front: `Q${id}`,
  back,
  created_at: '2024-01-01T00:00:00Z',
});

const card1 = makeCard('c1', 'Paris');
const card2 = makeCard('c2', 'Berlin');
const card3 = makeCard('c3', 'Madrid');
const card4 = makeCard('c4', 'Rome');
const allFourCards = [card1, card2, card3, card4];

// Navigation / route props
const mockNavigation = { replace: jest.fn(), goBack: jest.fn() };
const mockRoute = { params: { deckId: 'deck-1', deckName: 'Geography' } };

// Default mock implementations — overridden per test as needed
let mockGetDueCards: jest.Mock;
let mockSaveReview: jest.Mock;
let mockGetReviewForCard: jest.Mock;
let mockGetDueCount: jest.Mock;

function setupDefaultMocks() {
  (useReviews as jest.Mock).mockReturnValue({
    getDueCards: mockGetDueCards,
    saveReview: mockSaveReview,
    getReviewForCard: mockGetReviewForCard,
    getDueCount: mockGetDueCount,
  });
  (useCards as jest.Mock).mockReturnValue({
    cards: allFourCards,
    loading: false,
    error: null,
    createCard: jest.fn(),
    updateCard: jest.fn(),
    deleteCard: jest.fn(),
    refetch: jest.fn(),
  });
}

describe('MultipleChoiceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryResult.mockResolvedValue({ data: [], error: null });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-123' } } } });

    mockGetDueCards = jest.fn().mockResolvedValue([card1]);
    mockSaveReview = jest.fn().mockResolvedValue(null);
    mockGetReviewForCard = jest.fn().mockResolvedValue(null);
    mockGetDueCount = jest.fn().mockResolvedValue(1);

    setupDefaultMocks();
  });

  // 1. Shows loading indicator while cards are loading
  test('shows loading indicator while cards are loading', () => {
    mockGetDueCards.mockReturnValue(new Promise(() => {}));
    (useReviews as jest.Mock).mockReturnValue({
      getDueCards: mockGetDueCards,
      saveReview: mockSaveReview,
      getReviewForCard: mockGetReviewForCard,
      getDueCount: mockGetDueCount,
    });

    const { UNSAFE_getByType } = render(
      <MultipleChoiceScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  // 2. Renders card front (question) after loading
  test('renders card front (question) after loading', async () => {
    const { getByText } = render(
      <MultipleChoiceScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('Qc1')).toBeTruthy();
    });
  });

  // 3. Renders 4 answer options
  test('renders 4 answer options', async () => {
    const { getAllByText, getByText } = render(
      <MultipleChoiceScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    // Wait for question to appear
    await waitFor(() => {
      expect(getByText('Qc1')).toBeTruthy();
    });

    // All option texts come from allFourCards.back values
    const optionTexts = allFourCards.map(c => c.back);
    let count = 0;
    for (const text of optionTexts) {
      try {
        getByText(text);
        count++;
      } catch {
        // not rendered
      }
    }
    expect(count).toBe(4);
  });

  // 4. Correct option calls saveReview with rating 4
  test('correct option calls saveReview with rating 4', async () => {
    const { getByText } = render(
      <MultipleChoiceScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('Qc1')).toBeTruthy();
    });

    // Press the correct answer (card1.back = 'Paris')
    await act(async () => {
      fireEvent.press(getByText('Paris'));
    });

    await waitFor(() => {
      expect(mockSaveReview).toHaveBeenCalledWith(card1, 4, null);
    });
  });

  // 5. Wrong option calls saveReview with rating 1
  test('wrong option calls saveReview with rating 1', async () => {
    const { getByText } = render(
      <MultipleChoiceScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('Qc1')).toBeTruthy();
    });

    // Press a wrong answer (Berlin is card2.back, not card1.back)
    await act(async () => {
      fireEvent.press(getByText('Berlin'));
    });

    await waitFor(() => {
      expect(mockSaveReview).toHaveBeenCalledWith(card1, 1, null);
    });
  });

  // 6. Options are disabled after selection
  test('options are disabled after selection', async () => {
    const { getByText } = render(
      <MultipleChoiceScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('Qc1')).toBeTruthy();
    });

    // Press one option
    await act(async () => {
      fireEvent.press(getByText('Paris'));
    });

    // saveReview should have been called exactly once even if we try again
    const callCountBefore = mockSaveReview.mock.calls.length;
    await act(async () => {
      fireEvent.press(getByText('Berlin'));
    });
    expect(mockSaveReview.mock.calls.length).toBe(callCountBefore);
  });

  // 7. Advances to next card after 1 second timeout
  test('advances to next card after 1 second timeout', async () => {
    jest.useFakeTimers();

    mockGetDueCards.mockResolvedValue([card1, card2]);
    (useReviews as jest.Mock).mockReturnValue({
      getDueCards: mockGetDueCards,
      saveReview: mockSaveReview,
      getReviewForCard: mockGetReviewForCard,
      getDueCount: mockGetDueCount,
    });

    const { getByText } = render(
      <MultipleChoiceScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('Qc1')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('Paris'));
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(getByText('Qc2')).toBeTruthy();
    });

    jest.useRealTimers();
  });

  // 8. Navigates to SessionSummary after last card with correct answer
  test('navigates to SessionSummary after last card with correct answer', async () => {
    jest.useFakeTimers();

    const { getByText } = render(
      <MultipleChoiceScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('Qc1')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('Paris'));
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith(
        'SessionSummary',
        expect.objectContaining({
          result: expect.objectContaining({ correct: 1 }),
        }),
      );
    });

    jest.useRealTimers();
  });

  // 9. Navigates with correct: 0 after wrong answer on last card
  test('navigates with correct: 0 after wrong answer on last card', async () => {
    jest.useFakeTimers();

    const { getByText } = render(
      <MultipleChoiceScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('Qc1')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('Berlin'));
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith(
        'SessionSummary',
        expect.objectContaining({
          result: expect.objectContaining({ correct: 0 }),
        }),
      );
    });

    jest.useRealTimers();
  });

  // 10. Shows Toast on saveReview error
  test('shows Toast on saveReview error', async () => {
    mockSaveReview.mockResolvedValue('Network error');
    (useReviews as jest.Mock).mockReturnValue({
      getDueCards: mockGetDueCards,
      saveReview: mockSaveReview,
      getReviewForCard: mockGetReviewForCard,
      getDueCount: mockGetDueCount,
    });

    const { getByText } = render(
      <MultipleChoiceScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(getByText('Qc1')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('Paris'));
    });

    await waitFor(() => {
      expect(getByText("Couldn't save review. Will retry next session.")).toBeTruthy();
    });
  });
});
