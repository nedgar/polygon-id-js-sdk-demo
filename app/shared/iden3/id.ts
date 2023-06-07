const base58Js = require("base58-js");
import { BytesHelper } from "./byteshelper";
import { Constants } from "./constants";
import { fromLittleEndian, toLittleEndian } from "./utils";

export class Id {
  private readonly _bytes: Uint8Array;
  private readonly _checksum: Uint8Array;

  constructor(typ: Uint8Array, genesis: Uint8Array) {
    this._checksum = BytesHelper.calculateChecksum(typ, genesis);
    this._bytes = Uint8Array.from([...typ, ...genesis, ...this._checksum]);
  }

  private static getFromBytes(bytes: Uint8Array): Id {
    const { typ, genesis }: { typ: Uint8Array; genesis: Uint8Array } =
      BytesHelper.decomposeBytes(bytes);
    return new Id(typ, genesis);
  }

  static fromBytes(b: Uint8Array): Id {
    const bytes = b ?? Uint8Array.from([]);
    if (bytes.length !== Constants.ID.ID_LENGTH) {
      throw new Error('fromBytes error: byte array incorrect length');
    }

    if (bytes.every((i: number) => i === 0)) {
      throw new Error('fromBytes error: byte array empty');
    }

    const id = Id.getFromBytes(bytes);

    if (!BytesHelper.checkChecksum(bytes)) {
      throw new Error('fromBytes error: checksum error');
    }

    return id;
  }

  static fromString(s: string): Id {
    const bytes = base58Js.base58_to_binary(s);
    return Id.fromBytes(bytes);
  }

  static fromBigInt(bigInt: bigint): Id {
    const b = BytesHelper.intToNBytes(bigInt, Constants.ID.ID_LENGTH);
    return Id.fromBytes(b);
  }

  bigInt(): bigint {
    return fromLittleEndian(this._bytes);
  }

  equal(id: Id): boolean {
    return this.bigInt() === id.bigInt();
  }

  string() {
    return base58Js.binary_to_base58(this._bytes);
  }
}
