import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWorkloadRecap, saveWorkloadRecap } from "./workloadRecap";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => Array.from(values.keys())[index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("workload recap", () => {
  it("carries the requested duration to the purchase recap", () => {
    vi.stubGlobal("sessionStorage", memoryStorage());

    saveWorkloadRecap(7, {
      chips: ["GPU H100"],
      requestedDuration: "6 mois",
    });

    expect(loadWorkloadRecap(7)).toEqual({
      chips: ["GPU H100"],
      requestedDuration: "6 mois",
    });
  });
});
