export const mockQueryResult = jest.fn().mockResolvedValue({ data: [], error: null });

const builder: any = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  then: (resolve: (v: any) => any, reject: (e: any) => any) =>
    mockQueryResult().then(resolve, reject),
};

export const mockFrom = jest.fn().mockReturnValue(builder);
export const mockGetUser = jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } });
export const mockGetSession = jest.fn().mockResolvedValue({
  data: { session: { user: { id: 'user-123' } } },
});

export const supabase = {
  from: mockFrom,
  auth: {
    getUser: mockGetUser,
    getSession: mockGetSession,
  },
};
