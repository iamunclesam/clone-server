import { findRuntimeEvent } from "@clone/integration-framework";
import { RuntimeCompiler } from "./compiler";
import { CompiledRuntime, RuntimeTriggerInput } from "./types";

export type RoutedWake = {
  cloneId: string;
  eventId: string;
  reason: string;
};

export class EventRouter {
  constructor(private compiler = new RuntimeCompiler()) {}

  route(event: RuntimeTriggerInput, runtimes: CompiledRuntime[]): RoutedWake[] {
    const eventId = event.eventId || "";
    const def = findRuntimeEvent(eventId);
    const wakes: RoutedWake[] = [];

    for (const runtime of runtimes) {
      if (!eventId) continue;
      if (!this.compiler.isEventRelevant(runtime, eventId)) continue;
      wakes.push({
        cloneId: runtime.cloneId,
        eventId,
        reason: def
          ? `${def.name} is relevant to this Clone's identity, assigned ${def.provider} access, and compiled runtime.`
          : "Compiled runtime listed this event as relevant.",
      });
    }

    return wakes;
  }
}
