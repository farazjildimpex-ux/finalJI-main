declare module 'pizzip' {
  interface ZipFile {
    asText(): string;
    asUint8Array(): Uint8Array;
    asBinary(): string;
    name: string;
  }
  class PizZip {
    constructor(data?: ArrayBuffer | Uint8Array | string | null);
    file(name: string): ZipFile | null;
    file(name: string, data: string | Uint8Array | ArrayBuffer): this;
    generate(options: { type: 'arraybuffer' }): ArrayBuffer;
    generate(options: { type: 'uint8array' }): Uint8Array;
    generate(options: { type: 'binarystring' | 'base64' }): string;
    files: { [key: string]: ZipFile };
  }
  export = PizZip;
}
