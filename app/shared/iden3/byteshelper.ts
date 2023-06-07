import { fromLittleEndian, toLittleEndian } from "./utils";

export class BytesHelper {
  static intToBytes(int: bigint): Uint8Array {
    return this.intToNBytes(int, 32);
  }

  static intToNBytes(int: bigint, n: number): Uint8Array {
    return Uint8Array.from(toLittleEndian(int, n));
  }

  static checkChecksum(bytes: Uint8Array): boolean {
    const { typ, genesis, checksum } = BytesHelper.decomposeBytes(bytes);
    if (!checksum.length || JSON.stringify(Uint8Array.from([0, 0])) === JSON.stringify(checksum)) {
      return false;
    }

    const c = BytesHelper.calculateChecksum(typ, genesis);
    return JSON.stringify(c) === JSON.stringify(checksum);
  }

  static decomposeBytes(b: Uint8Array): {
    typ: Uint8Array;
    genesis: Uint8Array;
    checksum: Uint8Array;
  } {
    const offset = 2;
    const len = b.length - offset;
    return {
      typ: b.slice(0, offset),
      genesis: b.slice(offset, len),
      checksum: b.slice(-offset)
    };
  }

  static calculateChecksum(typ: Uint8Array, genesis: Uint8Array): Uint8Array {
    const toChecksum = [...typ, ...genesis];
    const s: number = toChecksum.reduce((acc, cur) => acc + cur, 0);
    const checksum = [s >> 8, s & 0xff];
    return Uint8Array.from(checksum.reverse());
  }

  static bytesToInt(bytes: Uint8Array): bigint {
    return fromLittleEndian(bytes);
  }
}
