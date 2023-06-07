export const Constants = Object.freeze({
  ID: {
    TYPE_DEFAULT: Uint8Array.from([0x00, 0x00]),
    TYPE_READONLY: Uint8Array.from([0b00000000, 0b00000001]),
    ID_LENGTH: 31,
  },
  DID: {
    DID_SCHEMA: "did",
  },
});
