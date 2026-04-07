export const getDocument = jest.fn().mockReturnValue({ promise: Promise.resolve({ numPages: 0, getPage: jest.fn() }) });
export const GlobalWorkerOptions = { workerSrc: '' };
