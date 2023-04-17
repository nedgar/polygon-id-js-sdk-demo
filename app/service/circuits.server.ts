import {
  CircuitData,
  CircuitId,
  CircuitStorage,
  FSKeyLoader,
  ICircuitStorage,
  InMemoryDataSource,
} from "@0xpolygonid/js-sdk";
import path from "path";

declare global {
  var __circuitStorage__: ICircuitStorage;
}

export async function getCircuitStorage(): Promise<ICircuitStorage> {
  if (!global.__circuitStorage__) {
    const circuitStorage = new CircuitStorage(new InMemoryDataSource<CircuitData>());
    const circuitIds = [
      CircuitId.AuthV2,
      CircuitId.AtomicQuerySigV2,
      CircuitId.StateTransition,
      // CircuitId.AtomicQueryMTPV2
    ];
    for (let circuitId of circuitIds) {
      console.log("Loading circuit:", circuitId);
      const t = Date.now();
      const loader = new FSKeyLoader(path.join(process.cwd(), "app/circuits", circuitId));
      await circuitStorage.saveCircuitData(circuitId, {
        circuitId: circuitId,
        wasm: await loader.load("circuit.wasm"),
        provingKey: await loader.load("circuit_final.zkey"),
        verificationKey: await loader.load("verification_key.json"),
      });
      console.log(`Loading circuit ${circuitId} took ${Date.now() - t} ms`);
    }
    global.__circuitStorage__ = circuitStorage;
  }
  return global.__circuitStorage__;
}
