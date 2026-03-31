export interface ReviewCard {
  ease_factor: number;
  interval: number;
  repetitions: number;
}

export interface ReviewResult {
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review_date: string; // YYYY-MM-DD
}

export function applyReview(card: ReviewCard, rating: number): ReviewResult {
  let { ease_factor, interval, repetitions } = card;

  if (rating < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * ease_factor);
    }
  }

  ease_factor = ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  if (ease_factor < 1.3) ease_factor = 1.3;

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);
  const pad = (n: number) => String(n).padStart(2, '0');
  const next_review_date = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDate.getDate())}`;

  return { ease_factor, interval, repetitions, next_review_date };
}
