# Smart Flashcard System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform flashcard app with SM-2 spaced repetition and three study modes, running on web and mobile from a single Expo codebase, with Supabase for auth and data.

**Architecture:** Expo (React Native + Web) for the frontend. Supabase handles auth, PostgreSQL database, REST API, and row-level security — no custom backend code. SM-2 algorithm runs client-side as a pure TypeScript function; review results sync to Supabase after each card.

**Tech Stack:** Expo SDK 51+, React Native, TypeScript, Supabase JS client v2, React Navigation v6, jest-expo

---

## File Map

All files live under `D:/projects/smart_flashcard_system/app/` (the Expo project root), except the migration SQL.

**Create:**
- `app/` — Expo project (via create-expo-app)
- `app/src/types.ts` — shared TypeScript types (Deck, Card, CardReview, navigation params)
- `app/src/lib/supabase.ts` — Supabase client singleton
- `app/src/lib/sm2.ts` — SM-2 algorithm (pure function, no side effects)
- `app/src/contexts/AuthContext.tsx` — auth session + signIn/signUp/signOut
- `app/src/navigation/AppNavigator.tsx` — root navigator (auth vs main stack)
- `app/src/screens/LoginScreen.tsx`
- `app/src/screens/SignUpScreen.tsx`
- `app/src/screens/DeckListScreen.tsx`
- `app/src/screens/DeckDetailScreen.tsx`
- `app/src/screens/StudyModePickerScreen.tsx`
- `app/src/screens/FlipCardScreen.tsx`
- `app/src/screens/MultipleChoiceScreen.tsx`
- `app/src/screens/TypeAnswerScreen.tsx`
- `app/src/screens/SessionSummaryScreen.tsx`
- `app/src/screens/SettingsScreen.tsx`
- `app/src/hooks/useDecks.ts` — deck CRUD
- `app/src/hooks/useCards.ts` — card CRUD
- `app/src/hooks/useReviews.ts` — due cards query + save review
- `app/src/components/DeckModal.tsx` — create/edit deck modal
- `app/src/components/CardModal.tsx` — add/edit card modal
- `app/src/components/Toast.tsx` — error/info toast
- `app/__tests__/sm2.test.ts` — SM-2 unit tests
- `app/.env` — Supabase URL + anon key
- `supabase/migrations/001_initial_schema.sql` — all tables, RLS, indexes, trigger

---

## Task 1: Initialize Expo App

**Files:**
- Create: `app/` (via create-expo-app)

- [ ] **Step 1: Create the Expo project**

```bash
cd D:/projects/smart_flashcard_system
npx create-expo-app@latest app --template blank-typescript
```

- [ ] **Step 2: Install all dependencies**

```bash
cd D:/projects/smart_flashcard_system/app
npx expo install @supabase/supabase-js @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context expo-secure-store @react-native-async-storage/async-storage react-native-url-polyfill
npm install --save-dev jest-expo @types/jest
```

- [ ] **Step 3: Add jest config to package.json**

Open `app/package.json` and add this field:
```json
"jest": {
  "preset": "jest-expo"
}
```

Also add a test script if not present:
```json
"scripts": {
  "test": "jest"
}
```

- [ ] **Step 4: Verify app starts**

```bash
cd D:/projects/smart_flashcard_system/app
npx expo start --web
```

Expected: browser opens with a blank Expo app. Press `Ctrl+C` to stop.

- [ ] **Step 5: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/
git commit -m "feat: initialize Expo app with dependencies"
```

---

## Task 2: Supabase Schema Migration

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Prerequisites:** Create a free Supabase project at https://supabase.com. Note your Project URL and anon key from Project Settings → API.

- [ ] **Step 1: Create the migration file**

Create `D:/projects/smart_flashcard_system/supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- profiles: one per user, auto-created on signup
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- decks: each deck belongs to one user
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- cards: each card belongs to one deck
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- card_reviews: SM-2 state per card per user
CREATE TABLE card_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ease_factor FLOAT NOT NULL DEFAULT 2.5,
  interval INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, user_id)
);

-- Index for the "due cards" query (runs on every study session)
CREATE INDEX idx_card_reviews_due ON card_reviews(user_id, next_review_date);

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable Row-Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_reviews ENABLE ROW LEVEL SECURITY;

-- profiles: users can only read/update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (id = auth.uid());

-- decks: users can only manage their own decks
CREATE POLICY "Users can manage own decks"
  ON decks FOR ALL USING (user_id = auth.uid());

-- cards: users can manage cards belonging to their own decks
CREATE POLICY "Users can manage cards in own decks"
  ON cards FOR ALL
  USING (deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid()));

-- card_reviews: users can manage their own reviews
CREATE POLICY "Users can manage own reviews"
  ON card_reviews FOR ALL USING (user_id = auth.uid());
```

- [ ] **Step 2: Run the migration in Supabase**

1. Go to your Supabase project → SQL Editor
2. Paste the entire contents of `001_initial_schema.sql`
3. Click "Run"

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify tables were created**

In Supabase → Table Editor, confirm these tables exist: `profiles`, `decks`, `cards`, `card_reviews`.

- [ ] **Step 4: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add supabase/
git commit -m "feat: add Supabase schema migration (tables, RLS, indexes)"
```

---

## Task 3: Supabase Client + Environment Variables

**Files:**
- Create: `app/.env`
- Create: `app/src/lib/supabase.ts`

- [ ] **Step 1: Create .env file**

Create `D:/projects/smart_flashcard_system/app/.env` (replace values with your Supabase project's URL and anon key from Project Settings → API):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 2: Add .env to .gitignore**

Open `app/.gitignore` and add:
```
.env
```

- [ ] **Step 3: Create the Supabase client**

Create `app/src/lib/supabase.ts`:

```typescript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 4: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/ app/.gitignore
git commit -m "feat: add Supabase client configuration"
```

---

## Task 4: TypeScript Types

**Files:**
- Create: `app/src/types.ts`

- [ ] **Step 1: Create shared types**

Create `app/src/types.ts`:

```typescript
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
  FlipCards: { deckId: string; deckName: string };
  MultipleChoice: { deckId: string; deckName: string };
  TypeAnswer: { deckId: string; deckName: string };
  SessionSummary: { result: SessionResult; deckId: string; deckName: string };
  Settings: undefined;
};
```

- [ ] **Step 2: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 5: SM-2 Algorithm (TDD)

**Files:**
- Create: `app/__tests__/sm2.test.ts`
- Create: `app/src/lib/sm2.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/sm2.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd D:/projects/smart_flashcard_system/app
npm test -- --testPathPattern=sm2
```

Expected: FAIL — `Cannot find module '../src/lib/sm2'`

- [ ] **Step 3: Implement the SM-2 algorithm**

Create `app/src/lib/sm2.ts`:

```typescript
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
  const next_review_date = nextDate.toISOString().split('T')[0];

  return { ease_factor, interval, repetitions, next_review_date };
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd D:/projects/smart_flashcard_system/app
npm test -- --testPathPattern=sm2
```

Expected: PASS — all 9 tests green

- [ ] **Step 5: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/lib/sm2.ts app/__tests__/sm2.test.ts
git commit -m "feat: implement SM-2 spaced repetition algorithm (TDD)"
```

---

## Task 6: AuthContext

**Files:**
- Create: `app/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Create AuthContext**

Create `app/src/contexts/AuthContext.tsx`:

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, displayName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
  ): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return error?.message ?? null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/contexts/
git commit -m "feat: add AuthContext with Supabase session management"
```

---

## Task 7: App Navigator + App.tsx

**Files:**
- Create: `app/src/navigation/AppNavigator.tsx`
- Modify: `app/App.tsx`

- [ ] **Step 1: Create AppNavigator**

Create `app/src/navigation/AppNavigator.tsx`:

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { AuthStackParamList, MainStackParamList } from '../types';

import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import DeckListScreen from '../screens/DeckListScreen';
import DeckDetailScreen from '../screens/DeckDetailScreen';
import StudyModePickerScreen from '../screens/StudyModePickerScreen';
import FlipCardScreen from '../screens/FlipCardScreen';
import MultipleChoiceScreen from '../screens/MultipleChoiceScreen';
import TypeAnswerScreen from '../screens/TypeAnswerScreen';
import SessionSummaryScreen from '../screens/SessionSummaryScreen';
import SettingsScreen from '../screens/SettingsScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerTintColor: '#6366f1' }}>
      <MainStack.Screen name="DeckList" component={DeckListScreen} options={{ title: 'My Decks' }} />
      <MainStack.Screen name="DeckDetail" component={DeckDetailScreen} />
      <MainStack.Screen name="StudyModePicker" component={StudyModePickerScreen} options={{ title: 'Study Mode' }} />
      <MainStack.Screen name="FlipCards" component={FlipCardScreen} options={{ title: 'Flip Cards' }} />
      <MainStack.Screen name="MultipleChoice" component={MultipleChoiceScreen} options={{ title: 'Multiple Choice' }} />
      <MainStack.Screen name="TypeAnswer" component={TypeAnswerScreen} options={{ title: 'Type Answer' }} />
      <MainStack.Screen name="SessionSummary" component={SessionSummaryScreen} options={{ title: 'Session Complete', headerLeft: () => null }} />
      <MainStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
```

- [ ] **Step 2: Update App.tsx**

Replace the contents of `app/App.tsx` with:

```typescript
import 'react-native-url-polyfill/auto';
import React from 'react';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Create placeholder screens (so the app compiles)**

The navigator imports all screens. Create empty placeholder files for each so TypeScript doesn't error. Run this from `app/`:

```bash
mkdir -p src/screens src/hooks src/components
for screen in LoginScreen SignUpScreen DeckListScreen DeckDetailScreen StudyModePickerScreen FlipCardScreen MultipleChoiceScreen TypeAnswerScreen SessionSummaryScreen SettingsScreen; do
  echo "import React from 'react'; import { View, Text } from 'react-native'; export default function ${screen}() { return <View><Text>${screen}</Text></View>; }" > src/screens/${screen}.tsx
done
```

- [ ] **Step 4: Verify the app compiles**

```bash
cd D:/projects/smart_flashcard_system/app
npx expo start --web
```

Expected: App launches. Browser shows a loading spinner briefly then a blank/placeholder screen. No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/ app/App.tsx
git commit -m "feat: add navigation structure and App.tsx"
```

---

## Task 8: Login + Sign Up Screens

**Files:**
- Modify: `app/src/screens/LoginScreen.tsx`
- Modify: `app/src/screens/SignUpScreen.tsx`

- [ ] **Step 1: Implement LoginScreen**

Replace `app/src/screens/LoginScreen.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';
import { useAuth } from '../contexts/AuthContext';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    const err = await signIn(email.trim(), password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Smart Flashcards</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Log In</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.link}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  error: { color: '#ef4444', marginBottom: 12, fontSize: 14 },
  button: { backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { textAlign: 'center', color: '#6366f1', fontSize: 14 },
});
```

- [ ] **Step 2: Implement SignUpScreen**

Replace `app/src/screens/SignUpScreen.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';
import { useAuth } from '../contexts/AuthContext';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'SignUp'> };

export default function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError(null);
    setLoading(true);
    const err = await signUp(email.trim(), password, displayName.trim());
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Create Account</Text>
      <TextInput style={styles.input} placeholder="Display Name" value={displayName} onChangeText={setDisplayName} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Sign Up</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  error: { color: '#ef4444', marginBottom: 12, fontSize: 14 },
  button: { backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { textAlign: 'center', color: '#6366f1', fontSize: 14 },
});
```

- [ ] **Step 3: Test auth flow manually**

```bash
cd D:/projects/smart_flashcard_system/app
npx expo start --web
```

1. Open browser, click "Sign Up"
2. Create a test account with your email
3. You should land on the (placeholder) DeckList screen
4. Reload the page — you should stay logged in (session persisted)

- [ ] **Step 4: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/screens/LoginScreen.tsx app/src/screens/SignUpScreen.tsx
git commit -m "feat: implement Login and SignUp screens"
```

---

## Task 9: useDecks Hook

**Files:**
- Create: `app/src/hooks/useDecks.ts`

- [ ] **Step 1: Implement useDecks**

Create `app/src/hooks/useDecks.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Deck } from '../types';

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDecks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('decks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setDecks(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDecks(); }, [fetchDecks]);

  const createDeck = async (name: string, description: string): Promise<string | null> => {
    const { error } = await supabase.from('decks').insert({ name, description: description || null });
    if (error) return error.message;
    await fetchDecks();
    return null;
  };

  const updateDeck = async (id: string, name: string, description: string): Promise<string | null> => {
    const { error } = await supabase.from('decks').update({ name, description: description || null }).eq('id', id);
    if (error) return error.message;
    await fetchDecks();
    return null;
  };

  const deleteDeck = async (id: string): Promise<string | null> => {
    const { error } = await supabase.from('decks').delete().eq('id', id);
    if (error) return error.message;
    await fetchDecks();
    return null;
  };

  return { decks, loading, error, createDeck, updateDeck, deleteDeck, refetch: fetchDecks };
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/hooks/useDecks.ts
git commit -m "feat: add useDecks hook for deck CRUD"
```

---

## Task 10: DeckListScreen + DeckModal

**Files:**
- Modify: `app/src/screens/DeckListScreen.tsx`
- Create: `app/src/components/DeckModal.tsx`

- [ ] **Step 1: Create DeckModal**

Create `app/src/components/DeckModal.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Deck } from '../types';

type Props = {
  visible: boolean;
  deck: Deck | null;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
};

export default function DeckModal({ visible, deck, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(deck?.name ?? '');
      setDescription(deck?.description ?? '');
    }
  }, [visible, deck]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await onSave(name.trim(), description.trim());
    setLoading(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{deck ? 'Edit Deck' : 'New Deck'}</Text>
          <TextInput style={styles.input} placeholder="Deck name *" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Description (optional)" value={description} onChangeText={setDescription} multiline />
          <TouchableOpacity
            style={[styles.save, (!name.trim() || loading) && styles.saveDisabled]}
            onPress={handleSave}
            disabled={!name.trim() || loading}
          >
            <Text style={styles.saveText}>{loading ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  save: { backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancel: { padding: 16, alignItems: 'center' },
  cancelText: { color: '#6b7280', fontSize: 16 },
});
```

- [ ] **Step 2: Implement DeckListScreen**

Replace `app/src/screens/DeckListScreen.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, Deck } from '../types';
import { useDecks } from '../hooks/useDecks';
import DeckModal from '../components/DeckModal';

type Props = { navigation: NativeStackNavigationProp<MainStackParamList, 'DeckList'> };

export default function DeckListScreen({ navigation }: Props) {
  const { decks, loading, createDeck, updateDeck, deleteDeck } = useDecks();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);

  const filtered = decks.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => { setEditingDeck(null); setModalVisible(true); }}>
          <Text style={{ color: '#6366f1', fontSize: 16, marginRight: 8 }}>+ New</Text>
        </TouchableOpacity>
      ),
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={{ fontSize: 20, marginLeft: 8 }}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search decks..."
        value={search}
        onChangeText={setSearch}
      />
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{search ? 'No results' : 'No decks yet'}</Text>
          <Text style={styles.emptySubtitle}>
            {search ? 'Try a different search' : 'Tap "+ New" to create your first deck'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('DeckDetail', { deckId: item.id, deckName: item.name })}
              onLongPress={() =>
                Alert.alert(item.name, undefined, [
                  { text: 'Edit', onPress: () => { setEditingDeck(item); setModalVisible(true); } },
                  { text: 'Delete', style: 'destructive', onPress: () =>
                    Alert.alert('Delete Deck', `Delete "${item.name}"? All cards will be deleted.`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteDeck(item.id) },
                    ])
                  },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            >
              <Text style={styles.deckName}>{item.name}</Text>
              {item.description ? <Text style={styles.deckDesc}>{item.description}</Text> : null}
            </TouchableOpacity>
          )}
        />
      )}
      <DeckModal
        visible={modalVisible}
        deck={editingDeck}
        onClose={() => setModalVisible(false)}
        onSave={async (name, description) => {
          if (editingDeck) await updateDeck(editingDeck.id, name, description);
          else await createDeck(name, description);
          setModalVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  search: { margin: 16, padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 16 },
  card: { marginHorizontal: 16, marginBottom: 8, padding: 16, backgroundColor: '#fff', borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  deckName: { fontSize: 18, fontWeight: '600' },
  deckDesc: { color: '#6b7280', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#374151' },
  emptySubtitle: { color: '#6b7280', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
```

- [ ] **Step 3: Test deck management manually**

```bash
npx expo start --web
```

1. Log in
2. Tap "+ New" → create a deck
3. Tap deck to navigate to (placeholder) DeckDetail
4. Long-press a deck → Edit / Delete options appear

- [ ] **Step 4: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/screens/DeckListScreen.tsx app/src/components/DeckModal.tsx
git commit -m "feat: implement DeckListScreen with search and DeckModal"
```

---

## Task 11: useCards Hook

**Files:**
- Create: `app/src/hooks/useCards.ts`

- [ ] **Step 1: Implement useCards**

Create `app/src/hooks/useCards.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../types';

export function useCards(deckId: string) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: true });
    if (error) setError(error.message);
    else setCards(data ?? []);
    setLoading(false);
  }, [deckId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const createCard = async (front: string, back: string): Promise<string | null> => {
    const { error } = await supabase.from('cards').insert({ deck_id: deckId, front, back });
    if (error) return error.message;
    await fetchCards();
    return null;
  };

  const updateCard = async (id: string, front: string, back: string): Promise<string | null> => {
    const { error } = await supabase.from('cards').update({ front, back }).eq('id', id);
    if (error) return error.message;
    await fetchCards();
    return null;
  };

  const deleteCard = async (id: string): Promise<string | null> => {
    const { error } = await supabase.from('cards').delete().eq('id', id);
    if (error) return error.message;
    await fetchCards();
    return null;
  };

  return { cards, loading, error, createCard, updateCard, deleteCard, refetch: fetchCards };
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/hooks/useCards.ts
git commit -m "feat: add useCards hook for card CRUD"
```

---

## Task 12: DeckDetailScreen + CardModal

**Files:**
- Modify: `app/src/screens/DeckDetailScreen.tsx`
- Create: `app/src/components/CardModal.tsx`

- [ ] **Step 1: Create CardModal**

Create `app/src/components/CardModal.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Card } from '../types';

type Props = {
  visible: boolean;
  card: Card | null;
  onClose: () => void;
  onSave: (front: string, back: string) => Promise<void>;
};

export default function CardModal({ visible, card, onClose, onSave }: Props) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setFront(card?.front ?? '');
      setBack(card?.back ?? '');
    }
  }, [visible, card]);

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) return;
    setLoading(true);
    await onSave(front.trim(), back.trim());
    setLoading(false);
  };

  const canSave = front.trim().length > 0 && back.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{card ? 'Edit Card' : 'New Card'}</Text>
          <TextInput style={styles.input} placeholder="Front (question) *" value={front} onChangeText={setFront} multiline />
          <TextInput style={styles.input} placeholder="Back (answer) *" value={back} onChangeText={setBack} multiline />
          <TouchableOpacity
            style={[styles.save, (!canSave || loading) && styles.saveDisabled]}
            onPress={handleSave}
            disabled={!canSave || loading}
          >
            <Text style={styles.saveText}>{loading ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, minHeight: 60, textAlignVertical: 'top' },
  save: { backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancel: { padding: 16, alignItems: 'center' },
  cancelText: { color: '#6b7280', fontSize: 16 },
});
```

- [ ] **Step 2: Implement DeckDetailScreen**

Replace `app/src/screens/DeckDetailScreen.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList, Card } from '../types';
import { useCards } from '../hooks/useCards';
import { useReviews } from '../hooks/useReviews';
import CardModal from '../components/CardModal';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'DeckDetail'>;
  route: RouteProp<MainStackParamList, 'DeckDetail'>;
};

export default function DeckDetailScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { cards, loading, createCard, updateCard, deleteCard } = useCards(deckId);
  const { getDueCount } = useReviews(deckId);
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: deckName,
      headerRight: () => (
        <TouchableOpacity onPress={() => { setEditingCard(null); setModalVisible(true); }}>
          <Text style={{ color: '#6366f1', fontSize: 16, marginRight: 8 }}>+ Card</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, deckName]);

  useEffect(() => {
    getDueCount().then(setDueCount);
  }, [cards]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.meta}>{cards.length} cards</Text>
        {dueCount !== null && (
          <Text style={styles.due}>{dueCount} due today</Text>
        )}
        <TouchableOpacity
          style={[styles.studyBtn, cards.length === 0 && styles.studyBtnDisabled]}
          disabled={cards.length === 0}
          onPress={() => navigation.navigate('StudyModePicker', { deckId, deckName })}
        >
          <Text style={styles.studyBtnText}>Study →</Text>
        </TouchableOpacity>
      </View>

      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptySubtitle}>Tap "+ Card" to add your first card</Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => { setEditingCard(item); setModalVisible(true); }}
              onLongPress={() =>
                Alert.alert('Delete Card', 'Delete this card?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteCard(item.id) },
                ])
              }
            >
              <Text style={styles.front}>{item.front}</Text>
              <Text style={styles.back}>{item.back}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <CardModal
        visible={modalVisible}
        card={editingCard}
        onClose={() => setModalVisible(false)}
        onSave={async (front, back) => {
          if (editingCard) await updateCard(editingCard.id, front, back);
          else await createCard(front, back);
          setModalVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', gap: 12 },
  meta: { color: '#6b7280', fontSize: 15 },
  due: { color: '#f59e0b', fontWeight: '600', fontSize: 15 },
  studyBtn: { marginLeft: 'auto', backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  studyBtnDisabled: { backgroundColor: '#d1d5db' },
  studyBtnText: { color: '#fff', fontWeight: 'bold' },
  card: { marginHorizontal: 16, marginTop: 8, padding: 16, backgroundColor: '#fff', borderRadius: 8, elevation: 2 },
  front: { fontSize: 16, fontWeight: '600' },
  back: { color: '#6b7280', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#374151' },
  emptySubtitle: { color: '#6b7280', marginTop: 8 },
});
```

Note: `useReviews` is imported above but doesn't exist yet. The next task creates it. To avoid compile errors, create a temporary stub first:

```bash
echo "export function useReviews(_: string) { return { getDueCount: async () => 0, getDueCards: async () => [], saveReview: async () => null, getReviewForCard: async () => null }; }" > D:/projects/smart_flashcard_system/app/src/hooks/useReviews.ts
```

- [ ] **Step 3: Test card management manually**

1. Navigate to a deck
2. Tap "+ Card" → add front and back → save
3. Tap a card → edit it
4. Long-press a card → delete it

- [ ] **Step 4: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/screens/DeckDetailScreen.tsx app/src/components/CardModal.tsx app/src/hooks/useReviews.ts
git commit -m "feat: implement DeckDetailScreen with card CRUD and CardModal"
```

---

## Task 13: useReviews Hook

**Files:**
- Modify: `app/src/hooks/useReviews.ts` (replace stub)

- [ ] **Step 1: Implement useReviews**

Replace `app/src/hooks/useReviews.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/hooks/useReviews.ts
git commit -m "feat: implement useReviews hook with SM-2 sync"
```

---

## Task 14: StudyModePickerScreen

**Files:**
- Modify: `app/src/screens/StudyModePickerScreen.tsx`

- [ ] **Step 1: Implement StudyModePickerScreen**

Replace `app/src/screens/StudyModePickerScreen.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../types';
import { useReviews } from '../hooks/useReviews';
import { useCards } from '../hooks/useCards';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'StudyModePicker'>;
  route: RouteProp<MainStackParamList, 'StudyModePicker'>;
};

export default function StudyModePickerScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { getDueCount } = useReviews(deckId);
  const { cards } = useCards(deckId);
  const [dueCount, setDueCount] = useState<number | null>(null);

  useEffect(() => {
    getDueCount().then(setDueCount);
  }, []);

  if (dueCount === null) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  if (dueCount === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.trophy}>🎉</Text>
        <Text style={styles.allCaughtUp}>All caught up!</Text>
        <Text style={styles.subtitle}>No cards due today. Come back tomorrow.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canMultipleChoice = cards.length >= 4;

  return (
    <View style={styles.container}>
      <Text style={styles.deckName}>{deckName}</Text>
      <Text style={styles.dueText}>{dueCount} cards due today</Text>

      <TouchableOpacity
        style={styles.modeBtn}
        onPress={() => navigation.navigate('FlipCards', { deckId, deckName })}
      >
        <Text style={styles.modeIcon}>🃏</Text>
        <View style={styles.modeInfo}>
          <Text style={styles.modeName}>Flip Cards</Text>
          <Text style={styles.modeDesc}>Tap to reveal, then rate your recall</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.modeBtn, !canMultipleChoice && styles.modeBtnDisabled]}
        disabled={!canMultipleChoice}
        onPress={() => navigation.navigate('MultipleChoice', { deckId, deckName })}
      >
        <Text style={styles.modeIcon}>🔘</Text>
        <View style={styles.modeInfo}>
          <Text style={styles.modeName}>Multiple Choice</Text>
          <Text style={styles.modeDesc}>
            {canMultipleChoice ? '4 options, pick the correct one' : 'Need at least 4 cards in deck'}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.modeBtn}
        onPress={() => navigation.navigate('TypeAnswer', { deckId, deckName })}
      >
        <Text style={styles.modeIcon}>⌨️</Text>
        <View style={styles.modeInfo}>
          <Text style={styles.modeName}>Type Answer</Text>
          <Text style={styles.modeDesc}>Type the answer from memory</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  trophy: { fontSize: 56, marginBottom: 16 },
  allCaughtUp: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#6b7280', fontSize: 16, marginBottom: 32, textAlign: 'center' },
  backBtn: { backgroundColor: '#6366f1', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  deckName: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  dueText: { color: '#f59e0b', fontSize: 16, fontWeight: '600', marginBottom: 32 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 16, gap: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  modeBtnDisabled: { opacity: 0.4 },
  modeIcon: { fontSize: 32 },
  modeInfo: { flex: 1 },
  modeName: { fontSize: 18, fontWeight: '600' },
  modeDesc: { color: '#6b7280', marginTop: 2, fontSize: 14 },
});
```

- [ ] **Step 2: Test manually**

1. Add at least 5 cards to a deck
2. Tap "Study →" from DeckDetail
3. StudyModePickerScreen appears with the 3 study mode options
4. "Multiple Choice" is enabled (5 cards ≥ 4)

- [ ] **Step 3: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/screens/StudyModePickerScreen.tsx
git commit -m "feat: implement StudyModePickerScreen"
```

---

## Task 15: FlipCardScreen

**Files:**
- Modify: `app/src/screens/FlipCardScreen.tsx`

- [ ] **Step 1: Implement FlipCardScreen**

Replace `app/src/screens/FlipCardScreen.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList, Card } from '../types';
import { useReviews } from '../hooks/useReviews';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'FlipCards'>;
  route: RouteProp<MainStackParamList, 'FlipCards'>;
};

export default function FlipCardScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { getDueCards, saveReview, getReviewForCard } = useReviews(deckId);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    getDueCards().then(c => { setCards(c); setLoading(false); });
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  const card = cards[index];

  const handleRate = async (rating: number) => {
    const existing = await getReviewForCard(card.id);
    await saveReview(card, rating, existing);
    const newCorrect = rating >= 3 ? correctCount + 1 : correctCount;
    const nextIndex = index + 1;
    if (nextIndex >= cards.length) {
      navigation.replace('SessionSummary', {
        result: { total: cards.length, correct: newCorrect },
        deckId,
        deckName,
      });
    } else {
      if (rating >= 3) setCorrectCount(c => c + 1);
      setFlipped(false);
      setIndex(nextIndex);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>{index + 1} / {cards.length}</Text>

      <TouchableOpacity style={styles.card} onPress={() => setFlipped(f => !f)} activeOpacity={0.9}>
        <Text style={styles.cardLabel}>{flipped ? 'Answer' : 'Question'}</Text>
        <Text style={styles.cardText}>{flipped ? card.back : card.front}</Text>
        {!flipped && <Text style={styles.tapHint}>Tap to reveal answer</Text>}
      </TouchableOpacity>

      {flipped && (
        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>How well did you know this?</Text>
          <View style={styles.ratingRow}>
            {([0, 1, 2, 3, 4, 5] as const).map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.ratingBtn, r < 3 && styles.ratingBtnFail]}
                onPress={() => handleRate(r)}
              >
                <Text style={styles.ratingNum}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.ratingLegend}>
            <Text style={styles.legendText}>0–2: Forgot</Text>
            <Text style={styles.legendText}>3–5: Remembered</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb', alignItems: 'center' },
  progress: { alignSelf: 'flex-end', color: '#6b7280', marginBottom: 16 },
  card: { width: '100%', minHeight: 220, backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, marginBottom: 32, position: 'relative' },
  cardLabel: { position: 'absolute', top: 14, left: 16, color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardText: { fontSize: 22, fontWeight: '500', textAlign: 'center', lineHeight: 32 },
  tapHint: { position: 'absolute', bottom: 14, color: '#9ca3af', fontSize: 12 },
  ratingSection: { width: '100%' },
  ratingLabel: { textAlign: 'center', color: '#374151', marginBottom: 16, fontSize: 16, fontWeight: '500' },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  ratingBtn: { flex: 1, margin: 4, paddingVertical: 14, backgroundColor: '#10b981', borderRadius: 8, alignItems: 'center' },
  ratingBtnFail: { backgroundColor: '#ef4444' },
  ratingNum: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  ratingLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendText: { color: '#9ca3af', fontSize: 12 },
});
```

- [ ] **Step 2: Test flip card flow manually**

1. Start a Flip Cards session
2. Tap the card to flip it
3. Rate 0–5 — card advances
4. After last card — SessionSummary screen appears (placeholder for now)

- [ ] **Step 3: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/screens/FlipCardScreen.tsx
git commit -m "feat: implement FlipCardScreen with SM-2 rating"
```

---

## Task 16: MultipleChoiceScreen

**Files:**
- Modify: `app/src/screens/MultipleChoiceScreen.tsx`

- [ ] **Step 1: Implement MultipleChoiceScreen**

Replace `app/src/screens/MultipleChoiceScreen.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList, Card } from '../types';
import { useReviews } from '../hooks/useReviews';
import { useCards } from '../hooks/useCards';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'MultipleChoice'>;
  route: RouteProp<MainStackParamList, 'MultipleChoice'>;
};

function buildOptions(correct: Card, allCards: Card[]): string[] {
  const distractors = allCards
    .filter(c => c.id !== correct.id)
    .map(c => c.back)
    .filter(v => v !== correct.back)          // exclude correct answer
    .filter((v, i, arr) => arr.indexOf(v) === i) // deduplicate
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  return [...distractors, correct.back].sort(() => Math.random() - 0.5);
}

export default function MultipleChoiceScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { getDueCards, saveReview, getReviewForCard } = useReviews(deckId);
  const { cards: allCards } = useCards(deckId);
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    getDueCards().then(c => { setDueCards(c); setLoading(false); });
  }, []);

  useEffect(() => {
    if (dueCards.length > 0 && allCards.length >= 4 && index < dueCards.length) {
      setOptions(buildOptions(dueCards[index], allCards));
      setSelected(null);
    }
  }, [index, dueCards, allCards]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  const card = dueCards[index];

  const handleSelect = async (option: string) => {
    if (selected !== null) return; // already answered
    setSelected(option);
    const isCorrect = option === card.back;
    const rating = isCorrect ? 4 : 1;
    const newCorrect = isCorrect ? correctCount + 1 : correctCount;
    const existing = await getReviewForCard(card.id);
    await saveReview(card, rating, existing);
    setTimeout(() => {
      const nextIndex = index + 1;
      if (nextIndex >= dueCards.length) {
        navigation.replace('SessionSummary', {
          result: { total: dueCards.length, correct: newCorrect },
          deckId,
          deckName,
        });
      } else {
        if (isCorrect) setCorrectCount(c => c + 1);
        setIndex(nextIndex);
      }
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>{index + 1} / {dueCards.length}</Text>
      <View style={styles.questionCard}>
        <Text style={styles.question}>{card.front}</Text>
      </View>
      <View style={styles.options}>
        {options.map((opt, i) => {
          let bg = '#fff';
          let border = '#e5e7eb';
          if (selected !== null) {
            if (opt === card.back) { bg = '#dcfce7'; border = '#16a34a'; }
            else if (opt === selected) { bg = '#fee2e2'; border = '#dc2626'; }
          }
          return (
            <TouchableOpacity
              key={i}
              style={[styles.option, { backgroundColor: bg, borderColor: border }]}
              onPress={() => handleSelect(opt)}
              disabled={selected !== null}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  progress: { textAlign: 'right', color: '#6b7280', marginBottom: 16 },
  questionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 28, marginBottom: 24, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  question: { fontSize: 20, fontWeight: '500', textAlign: 'center', lineHeight: 28 },
  options: { gap: 12 },
  option: { borderWidth: 2, borderRadius: 12, padding: 16 },
  optionText: { fontSize: 16 },
});
```

- [ ] **Step 2: Test multiple choice flow manually**

1. Start a Multiple Choice session (requires ≥ 4 cards)
2. Correct answer turns green, wrong turns red
3. Auto-advances after 1 second

- [ ] **Step 3: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/screens/MultipleChoiceScreen.tsx
git commit -m "feat: implement MultipleChoiceScreen with deduplication"
```

---

## Task 17: TypeAnswerScreen

**Files:**
- Modify: `app/src/screens/TypeAnswerScreen.tsx`

- [ ] **Step 1: Implement TypeAnswerScreen**

Replace `app/src/screens/TypeAnswerScreen.tsx`:

```typescript
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList, Card } from '../types';
import { useReviews } from '../hooks/useReviews';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'TypeAnswer'>;
  route: RouteProp<MainStackParamList, 'TypeAnswer'>;
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export default function TypeAnswerScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { getDueCards, saveReview, getReviewForCard } = useReviews(deckId);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    getDueCards().then(c => { setCards(c); setLoading(false); });
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  const card = cards[index];
  const isCorrect = submitted && normalize(input) === normalize(card.back);

  const handleSubmit = async () => {
    if (!input.trim() || submitted) return;
    setSubmitted(true);
    const correct = normalize(input) === normalize(card.back);
    const rating = correct ? 4 : 1;
    if (correct) setCorrectCount(c => c + 1);
    const existing = await getReviewForCard(card.id);
    await saveReview(card, rating, existing);
  };

  const handleNext = () => {
    const nextIndex = index + 1;
    if (nextIndex >= cards.length) {
      navigation.replace('SessionSummary', {
        result: { total: cards.length, correct: isCorrect ? correctCount : correctCount },
        deckId,
        deckName,
      });
    } else {
      setInput('');
      setSubmitted(false);
      setIndex(nextIndex);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.progress}>{index + 1} / {cards.length}</Text>
      <View style={styles.questionCard}>
        <Text style={styles.question}>{card.front}</Text>
      </View>
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          submitted && (isCorrect ? styles.inputCorrect : styles.inputWrong),
        ]}
        placeholder="Type your answer..."
        value={input}
        onChangeText={setInput}
        editable={!submitted}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
        autoCorrect={false}
      />
      {submitted && (
        <View style={styles.feedback}>
          <Text style={[styles.feedbackResult, isCorrect ? styles.correct : styles.wrong]}>
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </Text>
          {!isCorrect && (
            <Text style={styles.correctAnswer}>Correct answer: {card.back}</Text>
          )}
        </View>
      )}
      {!submitted ? (
        <TouchableOpacity
          style={[styles.btn, !input.trim() && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!input.trim()}
        >
          <Text style={styles.btnText}>Submit</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.btn} onPress={handleNext}>
          <Text style={styles.btnText}>Next →</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  progress: { textAlign: 'right', color: '#6b7280', marginBottom: 16 },
  questionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 28, marginBottom: 24, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  question: { fontSize: 20, fontWeight: '500', textAlign: 'center', lineHeight: 28 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 16, fontSize: 16, backgroundColor: '#fff', marginBottom: 12 },
  inputCorrect: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  inputWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  feedback: { marginBottom: 16 },
  feedbackResult: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  correct: { color: '#16a34a' },
  wrong: { color: '#dc2626' },
  correctAnswer: { color: '#374151', fontSize: 16 },
  btn: { backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
```

- [ ] **Step 2: Test type answer flow manually**

1. Start a Type Answer session
2. Type the correct answer (with extra spaces/caps) → shows green ✓
3. Type wrong answer → shows red ✗ + correct answer
4. Tap "Next →" to advance

- [ ] **Step 3: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/screens/TypeAnswerScreen.tsx
git commit -m "feat: implement TypeAnswerScreen with normalized matching"
```

---

## Task 18: SessionSummaryScreen

**Files:**
- Modify: `app/src/screens/SessionSummaryScreen.tsx`

- [ ] **Step 1: Implement SessionSummaryScreen**

Replace `app/src/screens/SessionSummaryScreen.tsx`:

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'SessionSummary'>;
  route: RouteProp<MainStackParamList, 'SessionSummary'>;
};

export default function SessionSummaryScreen({ navigation, route }: Props) {
  const { result, deckId, deckName } = route.params;
  const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;

  const emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪';

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>Session Complete!</Text>

      <View style={styles.scoreCard}>
        <Text style={styles.pct}>{pct}%</Text>
        <Text style={styles.detail}>{result.correct} / {result.total} correct</Text>
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => navigation.navigate('DeckDetail', { deckId, deckName })}
      >
        <Text style={styles.btnText}>Back to Deck</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnSecondary]}
        onPress={() => navigation.navigate('StudyModePicker', { deckId, deckName })}
      >
        <Text style={[styles.btnText, styles.btnTextSecondary]}>Study Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 60, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32 },
  scoreCard: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 40, alignItems: 'center', marginBottom: 40, elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8 },
  pct: { fontSize: 64, fontWeight: 'bold', color: '#6366f1' },
  detail: { fontSize: 18, color: '#6b7280', marginTop: 8 },
  btn: { width: '100%', backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnSecondary: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#6366f1' },
  btnTextSecondary: { color: '#6366f1' },
});
```

- [ ] **Step 2: Test the full study loop**

1. Complete a flip card session (rate all cards)
2. Session summary appears with score
3. "Back to Deck" returns to DeckDetail
4. "Study Again" returns to StudyModePicker

- [ ] **Step 3: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/screens/SessionSummaryScreen.tsx
git commit -m "feat: implement SessionSummaryScreen"
```

---

## Task 19: SettingsScreen + Toast

**Files:**
- Modify: `app/src/screens/SettingsScreen.tsx`
- Create: `app/src/components/Toast.tsx`

- [ ] **Step 1: Implement SettingsScreen**

Replace `app/src/screens/SettingsScreen.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword.trim()) return;
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setMessage(error.message); setIsError(true); }
    else { setMessage('Password updated successfully.'); setIsError(false); setNewPassword(''); }
    setLoading(false);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.section}>Change Password</Text>
      <TextInput
        style={styles.input}
        placeholder="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
      />
      {message && (
        <Text style={[styles.message, isError && styles.messageError]}>{message}</Text>
      )}
      <TouchableOpacity
        style={[styles.btn, (!newPassword.trim() || loading) && styles.btnDisabled]}
        onPress={handleChangePassword}
        disabled={!newPassword.trim() || loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Update Password</Text>}
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleLogout}>
        <Text style={styles.btnText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  section: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff', marginBottom: 12 },
  message: { color: '#16a34a', marginBottom: 12, fontSize: 14 },
  messageError: { color: '#dc2626' },
  btn: { backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnDanger: { backgroundColor: '#ef4444' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 24 },
});
```

- [ ] **Step 2: Create Toast component**

Create `app/src/components/Toast.tsx`:

```typescript
import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

type Props = { message: string | null; onHide: () => void };

export default function Toast({ message, onHide }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onHide());
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 80,
    left: 24,
    right: 24,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 16,
    zIndex: 999,
  },
  text: { color: '#fff', textAlign: 'center', fontSize: 14 },
});
```

- [ ] **Step 3: Test settings**

1. Open Settings via ⚙️ on DeckListScreen
2. Change password → success message appears
3. Log Out → confirmation dialog → tapping "Log Out" returns to Login screen

- [ ] **Step 4: Run all tests one final time**

```bash
cd D:/projects/smart_flashcard_system/app
npm test
```

Expected: all SM-2 tests pass.

- [ ] **Step 5: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/screens/SettingsScreen.tsx app/src/components/Toast.tsx
git commit -m "feat: implement SettingsScreen and Toast component"
```

---

## Task 20: Network Error Toasts in Study Screens + Bug Fix

**Files:**
- Modify: `app/src/screens/FlipCardScreen.tsx`
- Modify: `app/src/screens/MultipleChoiceScreen.tsx`
- Modify: `app/src/screens/TypeAnswerScreen.tsx`

This task fixes two issues found in self-review:
1. Network errors from `saveReview` are silently ignored — spec requires showing a toast
2. `TypeAnswerScreen` has a bug: `isCorrect ? correctCount : correctCount` always evaluates to `correctCount` (identical branches)

- [ ] **Step 1: Update FlipCardScreen to show save errors as a toast**

At the top of `FlipCardScreen.tsx`, add `toastMessage` state and import `Toast`. Replace the component with:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList, Card } from '../types';
import { useReviews } from '../hooks/useReviews';
import Toast from '../components/Toast';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'FlipCards'>;
  route: RouteProp<MainStackParamList, 'FlipCards'>;
};

export default function FlipCardScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { getDueCards, saveReview, getReviewForCard } = useReviews(deckId);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    getDueCards().then(c => { setCards(c); setLoading(false); });
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  const card = cards[index];

  const handleRate = async (rating: number) => {
    const existing = await getReviewForCard(card.id);
    const saveError = await saveReview(card, rating, existing);
    if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
    const newCorrect = rating >= 3 ? correctCount + 1 : correctCount;
    const nextIndex = index + 1;
    if (nextIndex >= cards.length) {
      navigation.replace('SessionSummary', {
        result: { total: cards.length, correct: newCorrect },
        deckId,
        deckName,
      });
    } else {
      if (rating >= 3) setCorrectCount(c => c + 1);
      setFlipped(false);
      setIndex(nextIndex);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>{index + 1} / {cards.length}</Text>

      <TouchableOpacity style={styles.card} onPress={() => setFlipped(f => !f)} activeOpacity={0.9}>
        <Text style={styles.cardLabel}>{flipped ? 'Answer' : 'Question'}</Text>
        <Text style={styles.cardText}>{flipped ? card.back : card.front}</Text>
        {!flipped && <Text style={styles.tapHint}>Tap to reveal answer</Text>}
      </TouchableOpacity>

      {flipped && (
        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>How well did you know this?</Text>
          <View style={styles.ratingRow}>
            {([0, 1, 2, 3, 4, 5] as const).map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.ratingBtn, r < 3 && styles.ratingBtnFail]}
                onPress={() => handleRate(r)}
              >
                <Text style={styles.ratingNum}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.ratingLegend}>
            <Text style={styles.legendText}>0–2: Forgot</Text>
            <Text style={styles.legendText}>3–5: Remembered</Text>
          </View>
        </View>
      )}

      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb', alignItems: 'center' },
  progress: { alignSelf: 'flex-end', color: '#6b7280', marginBottom: 16 },
  card: { width: '100%', minHeight: 220, backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, marginBottom: 32, position: 'relative' },
  cardLabel: { position: 'absolute', top: 14, left: 16, color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardText: { fontSize: 22, fontWeight: '500', textAlign: 'center', lineHeight: 32 },
  tapHint: { position: 'absolute', bottom: 14, color: '#9ca3af', fontSize: 12 },
  ratingSection: { width: '100%' },
  ratingLabel: { textAlign: 'center', color: '#374151', marginBottom: 16, fontSize: 16, fontWeight: '500' },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  ratingBtn: { flex: 1, margin: 4, paddingVertical: 14, backgroundColor: '#10b981', borderRadius: 8, alignItems: 'center' },
  ratingBtnFail: { backgroundColor: '#ef4444' },
  ratingNum: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  ratingLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendText: { color: '#9ca3af', fontSize: 12 },
});
```

- [ ] **Step 2: Update MultipleChoiceScreen to show save errors as a toast**

Replace `app/src/screens/MultipleChoiceScreen.tsx` with:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList, Card } from '../types';
import { useReviews } from '../hooks/useReviews';
import { useCards } from '../hooks/useCards';
import Toast from '../components/Toast';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'MultipleChoice'>;
  route: RouteProp<MainStackParamList, 'MultipleChoice'>;
};

function buildOptions(correct: Card, allCards: Card[]): string[] {
  const distractors = allCards
    .filter(c => c.id !== correct.id)
    .map(c => c.back)
    .filter(v => v !== correct.back)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  return [...distractors, correct.back].sort(() => Math.random() - 0.5);
}

export default function MultipleChoiceScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { getDueCards, saveReview, getReviewForCard } = useReviews(deckId);
  const { cards: allCards } = useCards(deckId);
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    getDueCards().then(c => { setDueCards(c); setLoading(false); });
  }, []);

  useEffect(() => {
    if (dueCards.length > 0 && allCards.length >= 4 && index < dueCards.length) {
      setOptions(buildOptions(dueCards[index], allCards));
      setSelected(null);
    }
  }, [index, dueCards, allCards]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  const card = dueCards[index];

  const handleSelect = async (option: string) => {
    if (selected !== null) return;
    setSelected(option);
    const isCorrect = option === card.back;
    const rating = isCorrect ? 4 : 1;
    const newCorrect = isCorrect ? correctCount + 1 : correctCount;
    const existing = await getReviewForCard(card.id);
    const saveError = await saveReview(card, rating, existing);
    if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
    setTimeout(() => {
      const nextIndex = index + 1;
      if (nextIndex >= dueCards.length) {
        navigation.replace('SessionSummary', {
          result: { total: dueCards.length, correct: newCorrect },
          deckId,
          deckName,
        });
      } else {
        if (isCorrect) setCorrectCount(c => c + 1);
        setIndex(nextIndex);
      }
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>{index + 1} / {dueCards.length}</Text>
      <View style={styles.questionCard}>
        <Text style={styles.question}>{card.front}</Text>
      </View>
      <View style={styles.options}>
        {options.map((opt, i) => {
          let bg = '#fff';
          let border = '#e5e7eb';
          if (selected !== null) {
            if (opt === card.back) { bg = '#dcfce7'; border = '#16a34a'; }
            else if (opt === selected) { bg = '#fee2e2'; border = '#dc2626'; }
          }
          return (
            <TouchableOpacity
              key={i}
              style={[styles.option, { backgroundColor: bg, borderColor: border }]}
              onPress={() => handleSelect(opt)}
              disabled={selected !== null}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  progress: { textAlign: 'right', color: '#6b7280', marginBottom: 16 },
  questionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 28, marginBottom: 24, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  question: { fontSize: 20, fontWeight: '500', textAlign: 'center', lineHeight: 28 },
  options: { gap: 12 },
  option: { borderWidth: 2, borderRadius: 12, padding: 16 },
  optionText: { fontSize: 16 },
});
```

- [ ] **Step 3: Update TypeAnswerScreen — fix bug + add toast**

Replace `app/src/screens/TypeAnswerScreen.tsx` with:

```typescript
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList, Card } from '../types';
import { useReviews } from '../hooks/useReviews';
import Toast from '../components/Toast';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'TypeAnswer'>;
  route: RouteProp<MainStackParamList, 'TypeAnswer'>;
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export default function TypeAnswerScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { getDueCards, saveReview, getReviewForCard } = useReviews(deckId);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    getDueCards().then(c => { setCards(c); setLoading(false); });
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  const card = cards[index];
  const isCorrect = submitted && normalize(input) === normalize(card.back);

  const handleSubmit = async () => {
    if (!input.trim() || submitted) return;
    setSubmitted(true);
    const correct = normalize(input) === normalize(card.back);
    const rating = correct ? 4 : 1;
    if (correct) setCorrectCount(c => c + 1);
    const existing = await getReviewForCard(card.id);
    const saveError = await saveReview(card, rating, existing);
    if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
  };

  const handleNext = () => {
    const nextIndex = index + 1;
    if (nextIndex >= cards.length) {
      // correctCount is already updated by handleSubmit (state update + re-render happened)
      navigation.replace('SessionSummary', {
        result: { total: cards.length, correct: correctCount },
        deckId,
        deckName,
      });
    } else {
      setInput('');
      setSubmitted(false);
      setIndex(nextIndex);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.progress}>{index + 1} / {cards.length}</Text>
      <View style={styles.questionCard}>
        <Text style={styles.question}>{card.front}</Text>
      </View>
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          submitted && (isCorrect ? styles.inputCorrect : styles.inputWrong),
        ]}
        placeholder="Type your answer..."
        value={input}
        onChangeText={setInput}
        editable={!submitted}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
        autoCorrect={false}
      />
      {submitted && (
        <View style={styles.feedback}>
          <Text style={[styles.feedbackResult, isCorrect ? styles.correct : styles.wrong]}>
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </Text>
          {!isCorrect && (
            <Text style={styles.correctAnswer}>Correct answer: {card.back}</Text>
          )}
        </View>
      )}
      {!submitted ? (
        <TouchableOpacity
          style={[styles.btn, !input.trim() && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!input.trim()}
        >
          <Text style={styles.btnText}>Submit</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.btn} onPress={handleNext}>
          <Text style={styles.btnText}>Next →</Text>
        </TouchableOpacity>
      )}
      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  progress: { textAlign: 'right', color: '#6b7280', marginBottom: 16 },
  questionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 28, marginBottom: 24, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  question: { fontSize: 20, fontWeight: '500', textAlign: 'center', lineHeight: 28 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 16, fontSize: 16, backgroundColor: '#fff', marginBottom: 12 },
  inputCorrect: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  inputWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  feedback: { marginBottom: 16 },
  feedbackResult: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  correct: { color: '#16a34a' },
  wrong: { color: '#dc2626' },
  correctAnswer: { color: '#374151', fontSize: 16 },
  btn: { backgroundColor: '#6366f1', padding: 16, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
```

- [ ] **Step 4: Run all tests**

```bash
cd D:/projects/smart_flashcard_system/app
npm test
```

Expected: all SM-2 tests pass.

- [ ] **Step 5: Commit**

```bash
cd D:/projects/smart_flashcard_system
git add app/src/screens/FlipCardScreen.tsx app/src/screens/MultipleChoiceScreen.tsx app/src/screens/TypeAnswerScreen.tsx
git commit -m "fix: add network error toasts to study screens, fix TypeAnswerScreen correct count"
```

---

## Done

The app is complete. Test the full flow:

1. Sign up → create a deck → add 5+ cards
2. Study via Flip Cards — rate each card
3. Study via Multiple Choice — pick options
4. Study via Type Answer — type answers
5. Session summary appears after each session
6. Revisit the deck the next day — fewer cards are due (SM-2 working)
7. Test on web (`npx expo start --web`) and mobile (`npx expo start` → scan QR in Expo Go)
