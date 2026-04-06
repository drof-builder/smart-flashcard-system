export type Deck = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type Card = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  created_at: string;
};

export type CardReview = {
  id: string;
  card_id: string;
  user_id: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review_date: string;
  last_reviewed_at: string;
};

export type SessionResult = {
  total: number;
  correct: number;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

export type MainStackParamList = {
  DeckList: undefined;
  DeckDetail: { deckId: string; deckName: string };
  StudyModePicker: { deckId: string; deckName: string };
  PracticeModePicker: { deckId: string; deckName: string };
  FlipCards: { deckId: string; deckName: string; practiceMode?: boolean; filterMode?: 'all' | 'due' };
  MultipleChoice: { deckId: string; deckName: string; practiceMode?: boolean; filterMode?: 'all' | 'due' };
  TypeAnswer: { deckId: string; deckName: string; practiceMode?: boolean; filterMode?: 'all' | 'due' };
  SessionSummary: { result: SessionResult; deckId: string; deckName: string };
  Settings: undefined;
};
