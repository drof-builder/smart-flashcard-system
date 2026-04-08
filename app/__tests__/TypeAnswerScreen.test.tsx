import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import TypeAnswerScreen from '../src/screens/TypeAnswerScreen';

jest.mock('../src/lib/supabase');
jest.mock('../src/hooks/useReviews');

import { useReviews } from '../src/hooks/useReviews';
import { mockQueryResult, mockGetSession } from '../src/lib/supabase';

const card1 = {
  id: 'c1',
  deck_id: 'deck-1',
  front: 'Capital of France?',
  back: 'Paris',
  created_at: '2024-01-01T00:00:00Z',
};
const card2 = {
  id: 'c2',
  deck_id: 'deck-1',
  front: 'Capital of Spain?',
  back: 'Madrid',
  created_at: '2024-01-01T00:00:00Z',
};

const makeNavigation = () => ({
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
  setParams: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  canGoBack: jest.fn(),
  getId: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  isFocused: jest.fn(),
} as any);

const makeRoute = () => ({
  params: { deckId: 'deck-1', deckName: 'Test Deck' },
  key: 'TypeAnswer',
  name: 'TypeAnswer' as const,
} as any);

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

describe('TypeAnswerScreen', () => {
  test('1. shows loading indicator while cards are loading', () => {
    mockGetDueCards.mockReturnValue(new Promise(() => {})); // never resolves

    const { getByTestId, UNSAFE_getByType } = render(
      <TypeAnswerScreen navigation={makeNavigation()} route={makeRoute()} />
    );

    // ActivityIndicator is shown while loading
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  test('2. shows "No cards due" message when getDueCards returns []', async () => {
    mockGetDueCards.mockResolvedValue([]);

    const { getByText } = render(
      <TypeAnswerScreen navigation={makeNavigation()} route={makeRoute()} />
    );

    await waitFor(() => {
      expect(getByText('No cards due for review.')).toBeTruthy();
    });
  });

  test('3. renders card front question after loading', async () => {
    const { getByText } = render(
      <TypeAnswerScreen navigation={makeNavigation()} route={makeRoute()} />
    );

    await waitFor(() => {
      expect(getByText('Capital of France?')).toBeTruthy();
    });
  });

  test('4. Submit button is disabled when input is empty', async () => {
    const { getByText } = render(
      <TypeAnswerScreen navigation={makeNavigation()} route={makeRoute()} />
    );

    // Wait for the card to load and Submit to appear
    await waitFor(() => getByText('Submit'));

    // TouchableOpacity with disabled=true renders with accessibilityState.disabled=true
    // Walk up the tree to find the node with accessibilityState
    const submitTextNode = getByText('Submit');
    let node: any = submitTextNode;
    let found = false;
    while (node) {
      if (node.props?.accessibilityState?.disabled === true) {
        found = true;
        break;
      }
      node = node.parent;
    }
    expect(found).toBe(true);
  });

  test('5. Submit button is enabled when input has content', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TypeAnswerScreen navigation={makeNavigation()} route={makeRoute()} />
    );

    await waitFor(() => getByText('Submit'));

    fireEvent.changeText(getByPlaceholderText('Type your answer...'), 'Paris');

    const submitTextNode = getByText('Submit');
    const submitBtn = submitTextNode.parent;
    expect(submitBtn?.props.accessibilityState?.disabled).toBeFalsy();
  });

  test('6. correct answer (exact match) shows correct feedback', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TypeAnswerScreen navigation={makeNavigation()} route={makeRoute()} />
    );

    await waitFor(() => getByText('Submit'));

    fireEvent.changeText(getByPlaceholderText('Type your answer...'), 'Paris');
    fireEvent.press(getByText('Submit'));

    await waitFor(() => {
      expect(getByText(/Correct/i)).toBeTruthy();
    });
  });

  test('7. correct answer is case-insensitive', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TypeAnswerScreen navigation={makeNavigation()} route={makeRoute()} />
    );

    await waitFor(() => getByText('Submit'));

    fireEvent.changeText(getByPlaceholderText('Type your answer...'), 'paris');
    fireEvent.press(getByText('Submit'));

    await waitFor(() => {
      expect(getByText(/Correct/i)).toBeTruthy();
    });
  });

  test('8. correct answer ignores leading/trailing whitespace', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TypeAnswerScreen navigation={makeNavigation()} route={makeRoute()} />
    );

    await waitFor(() => getByText('Submit'));

    fireEvent.changeText(getByPlaceholderText('Type your answer...'), '  Paris  ');
    fireEvent.press(getByText('Submit'));

    await waitFor(() => {
      expect(getByText(/Correct/i)).toBeTruthy();
    });
  });

  test('9. wrong answer shows incorrect feedback', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TypeAnswerScreen navigation={makeNavigation()} route={makeRoute()} />
    );

    await waitFor(() => getByText('Submit'));

    fireEvent.changeText(getByPlaceholderText('Type your answer...'), 'London');
    fireEvent.press(getByText('Submit'));

    await waitFor(() => {
      expect(getByText(/Incorrect/i)).toBeTruthy();
    });
  });

  test('10. saveReview called with rating 4 for correct answer', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TypeAnswerScreen navigation={makeNavigation()} route={makeRoute()} />
    );

    await waitFor(() => getByText('Submit'));

    fireEvent.changeText(getByPlaceholderText('Type your answer...'), 'Paris');
    fireEvent.press(getByText('Submit'));

    await waitFor(() => {
      expect(mockSaveReview).toHaveBeenCalledWith(card1, 4, null);
    });
  });

  test('11. saveReview called with rating 1 for wrong answer', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TypeAnswerScreen navigation={makeNavigation()} route={makeRoute()} />
    );

    await waitFor(() => getByText('Submit'));

    fireEvent.changeText(getByPlaceholderText('Type your answer...'), 'London');
    fireEvent.press(getByText('Submit'));

    await waitFor(() => {
      expect(mockSaveReview).toHaveBeenCalledWith(card1, 1, null);
    });
  });

  test('12. Next button appears after submission', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TypeAnswerScreen navigation={makeNavigation()} route={makeRoute()} />
    );

    await waitFor(() => getByText('Submit'));

    fireEvent.changeText(getByPlaceholderText('Type your answer...'), 'Paris');
    fireEvent.press(getByText('Submit'));

    await waitFor(() => {
      expect(getByText('Next →')).toBeTruthy();
    });
  });
});
