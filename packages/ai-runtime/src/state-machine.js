"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionStateMachine = void 0;
class ExecutionStateMachine {
    static VALID_TRANSITIONS = {
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
    static canTransition(from, to) {
        return ExecutionStateMachine.VALID_TRANSITIONS[from]?.includes(to) || false;
    }
    static transition(currentState, nextState) {
        if (!ExecutionStateMachine.canTransition(currentState, nextState)) {
            throw new Error(`Invalid state transition from ${currentState} to ${nextState}`);
        }
        return nextState;
    }
}
exports.ExecutionStateMachine = ExecutionStateMachine;
//# sourceMappingURL=state-machine.js.map