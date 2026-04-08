jest.mock('../src/lib/supabase');
// Import helpers from the mocked module path (not the __mocks__ path) so we get
// the same instance that the hook uses when it imports from '../lib/supabase'.
import { mockQueryResult, mockFrom, mockGetUser } from '../src/lib/supabase';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useDecks } from '../src/hooks/useDecks';

const sampleDeck = {
  id: 'd1',
  name: 'Bio',
  description: null,
  user_id: 'user-123',
  created_at: '2024-01-01',
};

describe('useDecks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryResult.mockResolvedValue({ data: [], error: null });
  });

  // ─── fetchDecks ───────────────────────────────────────────────────────────

  describe('fetchDecks', () => {
    it('fetches decks on mount (mockFrom called with "decks")', async () => {
      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockFrom).toHaveBeenCalledWith('decks');
    });

    it('sets decks state from returned data', async () => {
      mockQueryResult.mockResolvedValueOnce({ data: [sampleDeck], error: null });

      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.decks).toHaveLength(1);
      expect(result.current.decks[0].id).toBe('d1');
    });

    it('sets loading to false after fetch completes', async () => {
      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.loading).toBe(false);
    });

    it('sets error when supabase returns an error', async () => {
      mockQueryResult.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe('DB error');
    });
  });

  // ─── createDeck ───────────────────────────────────────────────────────────

  describe('createDeck', () => {
    it('calls getUser to fetch user id', async () => {
      // initial fetchDecks
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // insert
      mockQueryResult.mockResolvedValueOnce({ data: null, error: null });
      // refetch after create
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.createDeck('Bio', 'desc');
      });

      expect(mockGetUser).toHaveBeenCalled();
    });

    it('inserts with correct payload (name, description, user_id)', async () => {
      // initial fetchDecks
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // insert
      mockQueryResult.mockResolvedValueOnce({ data: null, error: null });
      // refetch
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Grab the builder from mockFrom to spy on insert
      const builder = mockFrom.mock.results[0].value;

      await act(async () => {
        await result.current.createDeck('Bio', 'desc');
      });

      expect(builder.insert).toHaveBeenCalledWith({
        name: 'Bio',
        description: 'desc',
        user_id: 'user-123',
      });
    });

    it('returns null on success', async () => {
      // initial fetchDecks
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // insert
      mockQueryResult.mockResolvedValueOnce({ data: null, error: null });
      // refetch after create
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnValue: string | null = 'not-set';
      await act(async () => {
        returnValue = await result.current.createDeck('Bio', 'desc');
      });

      expect(returnValue).toBeNull();
    });

    it('returns error message on failure', async () => {
      // initial fetchDecks
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // insert fails
      mockQueryResult.mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });

      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnValue: string | null = null;
      await act(async () => {
        returnValue = await result.current.createDeck('Bio', 'desc');
      });

      expect(returnValue).toBe('Insert failed');
    });

    it('calls refetch after successful create (mockFrom call count increases)', async () => {
      // initial fetchDecks
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // insert
      mockQueryResult.mockResolvedValueOnce({ data: null, error: null });
      // refetch
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const callCountAfterMount = mockFrom.mock.calls.length;

      await act(async () => {
        await result.current.createDeck('Bio', 'desc');
      });

      // mockFrom should have been called at least once more for the refetch
      expect(mockFrom.mock.calls.length).toBeGreaterThan(callCountAfterMount);
    });
  });

  // ─── updateDeck ───────────────────────────────────────────────────────────

  describe('updateDeck', () => {
    it('returns null on success', async () => {
      // initial fetchDecks
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // update
      mockQueryResult.mockResolvedValueOnce({ data: null, error: null });
      // refetch
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnValue: string | null = 'not-set';
      await act(async () => {
        returnValue = await result.current.updateDeck('d1', 'Bio Updated', 'new desc');
      });

      expect(returnValue).toBeNull();
    });

    it('returns error message on failure', async () => {
      // initial fetchDecks
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // update fails
      mockQueryResult.mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } });

      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnValue: string | null = null;
      await act(async () => {
        returnValue = await result.current.updateDeck('d1', 'Bio Updated', 'new desc');
      });

      expect(returnValue).toBe('Update failed');
    });
  });

  // ─── deleteDeck ───────────────────────────────────────────────────────────

  describe('deleteDeck', () => {
    it('returns null on success', async () => {
      // initial fetchDecks
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // delete
      mockQueryResult.mockResolvedValueOnce({ data: null, error: null });
      // refetch
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnValue: string | null = 'not-set';
      await act(async () => {
        returnValue = await result.current.deleteDeck('d1');
      });

      expect(returnValue).toBeNull();
    });

    it('returns error message on failure', async () => {
      // initial fetchDecks
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // delete fails
      mockQueryResult.mockResolvedValueOnce({ data: null, error: { message: 'Delete failed' } });

      const { result } = renderHook(() => useDecks());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnValue: string | null = null;
      await act(async () => {
        returnValue = await result.current.deleteDeck('d1');
      });

      expect(returnValue).toBe('Delete failed');
    });
  });
});
