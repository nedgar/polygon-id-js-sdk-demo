import type { ICircuitStorage } from "@0xpolygonid/js-sdk";
import { FSCircuitStorage } from "@0xpolygonid/js-sdk";

declare global {
  var __circuitStorage__: ICircuitStorage;
}

export async function getCircuitStorage(): Promise<ICircuitStorage> {
  if (!global.__circuitStorage__) {
    const circuitStorage = new FSCircuitStorage({
      dirname: "app/circuits",
    });
    global.__circuitStorage__ = circuitStorage;
  }
  return global.__circuitStorage__;
}
