import { ExecutionState } from "./types";
export declare class ExecutionStateMachine {
    private static VALID_TRANSITIONS;
    static canTransition(from: ExecutionState, to: ExecutionState): boolean;
    static transition(currentState: ExecutionState, nextState: ExecutionState): ExecutionState;
}
//# sourceMappingURL=state-machine.d.ts.map