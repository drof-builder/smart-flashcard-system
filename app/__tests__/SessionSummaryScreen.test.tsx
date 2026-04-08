import React from 'react';
import { render } from '@testing-library/react-native';
import SessionSummaryScreen from '../src/screens/SessionSummaryScreen';

// Minimal mock for navigation and route props
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

const makeRoute = (correct: number, total: number) => ({
  params: { result: { correct, total }, deckId: 'd1', deckName: 'Test' },
  key: 'SessionSummary',
  name: 'SessionSummary' as const,
} as any);

describe('SessionSummaryScreen', () => {
  test('shows 🎉 emoji when score is exactly 80%', () => {
    const { getByText } = render(
      <SessionSummaryScreen navigation={makeNavigation()} route={makeRoute(8, 10)} />
    );
    expect(getByText('🎉')).toBeTruthy();
  });

  test('shows 🎉 emoji when score is above 80%', () => {
    const { getByText } = render(
      <SessionSummaryScreen navigation={makeNavigation()} route={makeRoute(9, 10)} />
    );
    expect(getByText('🎉')).toBeTruthy();
  });

  test('shows 👍 emoji when score is exactly 50%', () => {
    const { getByText } = render(
      <SessionSummaryScreen navigation={makeNavigation()} route={makeRoute(5, 10)} />
    );
    expect(getByText('👍')).toBeTruthy();
  });

  test('shows 👍 emoji when score is between 50-80%', () => {
    const { getByText } = render(
      <SessionSummaryScreen navigation={makeNavigation()} route={makeRoute(6, 10)} />
    );
    expect(getByText('👍')).toBeTruthy();
  });

  test('shows 💪 emoji when score is below 50%', () => {
    const { getByText } = render(
      <SessionSummaryScreen navigation={makeNavigation()} route={makeRoute(3, 10)} />
    );
    expect(getByText('💪')).toBeTruthy();
  });

  test('shows 💪 emoji when score is 0%', () => {
    const { getByText } = render(
      <SessionSummaryScreen navigation={makeNavigation()} route={makeRoute(0, 5)} />
    );
    expect(getByText('💪')).toBeTruthy();
  });

  test('displays correct count: "7 / 10 correct"', () => {
    const { getByText } = render(
      <SessionSummaryScreen navigation={makeNavigation()} route={makeRoute(7, 10)} />
    );
    expect(getByText('7 / 10 correct')).toBeTruthy();
  });

  test('displays percentage: "70%"', () => {
    const { getByText } = render(
      <SessionSummaryScreen navigation={makeNavigation()} route={makeRoute(7, 10)} />
    );
    expect(getByText('70%')).toBeTruthy();
  });

  test('does not crash when total is 0', () => {
    const { getByText } = render(
      <SessionSummaryScreen navigation={makeNavigation()} route={makeRoute(0, 0)} />
    );
    // pct = 0, so emoji is 💪
    expect(getByText('💪')).toBeTruthy();
    expect(getByText('0%')).toBeTruthy();
  });

  test('renders "Back to Deck" button', () => {
    const { getByText } = render(
      <SessionSummaryScreen navigation={makeNavigation()} route={makeRoute(8, 10)} />
    );
    expect(getByText('Back to Deck')).toBeTruthy();
  });
});
