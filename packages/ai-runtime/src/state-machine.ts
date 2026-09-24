import { ExecutionState } from "./types";

export class ExecutionStateMachine {
  private static VALID_TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
    RECEIVED: ["PLANNING", "FAILED", "CANCELLED"],
    PLANNING: ["WAITING_FOR_TOOL", "WAITING_FOR_APPROVAL", "DELEGATING", "COMPLETED", "FAILED", "CANCELLED"],
    WAITING_FOR_TOOL: ["EXECUTING", "FAILED", "CANCELLED"],
    EXECUTING: ["PLANNING", "WAITING_FOR_APPROVAL", "VERIFYING", "COMPLETED", "FAILED", "CANCELLED"],
    WAITING_FOR_APPROVAL: ["EXECUTING", "FAILED", "CANCELLED"],
    DELEGATING: ["PLANNING", "WAITING_FOR_TOOL", "FAILED", "CANCELLED"],
    VERIFYING: ["COMPLETED", "PLANNING", "FAILED", "CANCELLED"],
    COMPLETED: [],
    FAILED: [],
    CANCELLED: [],
  };

  public static canTransition(from: ExecutionState, to: ExecutionState): boolean {
    return ExecutionStateMachine.VALID_TRANSITIONS[from]?.includes(to) || false;
  }

  public static transition(currentState: ExecutionState, nextState: ExecutionState): ExecutionState {
    if (!ExecutionStateMachine.canTransition(currentState, nextState)) {
      throw new Error(`Invalid state transition from ${currentState} to ${nextState}`);
    }
    return nextState;
  }
}
