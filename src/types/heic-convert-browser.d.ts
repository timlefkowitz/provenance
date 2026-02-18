declare module 'heic-convert/browser' {
  function convert(options: {
    buffer: ArrayBuffer | Uint8Array;
    format: 'JPEG' | 'PNG';
    quality?: number;
  }): Promise<Uint8Array>;
  export default convert;
}
