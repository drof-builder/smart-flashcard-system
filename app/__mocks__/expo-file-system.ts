export const readAsStringAsync = jest.fn().mockResolvedValue('');
export const EncodingType = { Base64: 'base64', UTF8: 'utf8' };

export class File {
  uri: string;
  constructor(...uris: string[]) {
    this.uri = uris.join('/');
  }
  base64 = jest.fn().mockResolvedValue('');
}
