import { AIEmployeeOrchestrator } from "./orchestrator";

console.log("🚀 Starting Clone AI OS Background Worker Engine...");
const orchestrator = new AIEmployeeOrchestrator();

setInterval(() => {
  console.log(`[${new Date().toISOString()}] Background worker polling queue for pending AI Employee executions...`);
}, 30000);
