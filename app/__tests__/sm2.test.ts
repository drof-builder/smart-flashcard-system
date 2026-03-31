import { applyReview, ReviewCard } from '../src/lib/sm2';

const defaultCard: ReviewCard = { ease_factor: 2.5, interval: 0, repetitions: 0 };

describe('applyReview — failed review (rating < 3)', () => {
  test('resets repetitions to 0', () => {
    const result = applyReview({ ease_factor: 2.5, interval: 10, repetitions: 5 }, 2);
    expect(result.repetitions).toBe(0);
  });

  test('sets interval to 1', () => {
    const result = applyReview({ ease_factor: 2.5, interval: 10, repetitions: 5 }, 2);
    expect(result.interval).toBe(1);
  });

  test('still updates ease_factor downward', () => {
    const result = applyReview(defaultCard, 0);
    expect(result.ease_factor).toBeLessThan(2.5);
  });
});

describe('applyReview — successful review (rating >= 3)', () => {
  test('first review: repetitions=1, interval=1', () => {
    const result = applyReview(defaultCard, 4);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
  });

  test('second review: repetitions=2, interval=6', () => {
    const result = applyReview({ ease_factor: 2.5, interval: 1, repetitions: 1 }, 4);
    expect(result.repetitions).toBe(2);
    expect(result.interval).toBe(6);
  });

  test('third review: interval = round(prev * ease_factor)', () => {
    const result = applyReview({ ease_factor: 2.5, interval: 6, repetitions: 2 }, 4);
    expect(result.repetitions).toBe(3);
    expect(result.interval).toBe(15); // round(6 * 2.5) = 15
  });
});

describe('applyReview — ease_factor', () => {
  test('hard rating (3) decreases ease_factor', () => {
    const result = applyReview(defaultCard, 3);
    expect(result.ease_factor).toBeLessThan(2.5);
  });

  test('easy rating (5) increases ease_factor', () => {
    const result = applyReview(defaultCard, 5);
    expect(result.ease_factor).toBeGreaterThan(2.5);
  });

  test('ease_factor never drops below 1.3', () => {
    let card = { ...defaultCard };
    for (let i = 0; i < 30; i++) {
      card = { ...card, ...applyReview(card, 0) };
    }
    expect(card.ease_factor).toBeGreaterThanOrEqual(1.3);
  });
});

describe('applyReview — next_review_date', () => {
  test('returns a YYYY-MM-DD date string', () => {
    const result = applyReview(defaultCard, 4);
    expect(result.next_review_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('next_review_date is today + interval days', () => {
    const result = applyReview(defaultCard, 4); // interval will be 1
    const expected = new Date();
    expected.setDate(expected.getDate() + 1);
    expect(result.next_review_date).toBe(expected.toISOString().split('T')[0]);
  });
});
