const JSZip = jest.fn().mockImplementation(() => ({
  loadAsync: jest.fn().mockResolvedValue({}),
  files: {},
}));
(JSZip as any).loadAsync = jest.fn().mockResolvedValue({ files: {} });
export default JSZip;
