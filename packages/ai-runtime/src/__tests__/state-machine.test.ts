import { describe, it, expect } from "vitest";
import { ExecutionStateMachine } from "../state-machine";
import { ExecutionState } from "../types";

describe("ExecutionStateMachine", () => {
  it("should validate valid transitions", () => {
    expect(ExecutionStateMachine.canTransition("RECEIVED", "PLANNING")).toBe(true);
    expect(ExecutionStateMachine.canTransition("PLANNING", "EXECUTING")).toBe(false);
  });

  it("should transition from RECEIVED to PLANNING", () => {
    const nextState = ExecutionStateMachine.transition("RECEIVED", "PLANNING");
    expect(nextState).toBe("PLANNING");
  });

  it("should throw error when making illegal state transition", () => {
    expect(() => {
      ExecutionStateMachine.transition("RECEIVED", "COMPLETED");
    }).toThrow("Invalid state transition from RECEIVED to COMPLETED");
  });

  it("should handle WAITING_FOR_APPROVAL transition", () => {
    const state1 = ExecutionStateMachine.transition("PLANNING", "WAITING_FOR_APPROVAL");
    expect(state1).toBe("WAITING_FOR_APPROVAL");
    const state2 = ExecutionStateMachine.transition("WAITING_FOR_APPROVAL", "EXECUTING");
    expect(state2).toBe("EXECUTING");
  });
});
