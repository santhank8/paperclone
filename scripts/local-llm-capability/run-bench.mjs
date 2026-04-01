#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const modelsPath = path.join(root, "docs/local-llm-capability/models.json");
const tasksPath = path.join(root, "docs/local-llm-capability/tasks.json");
const outPath = path.join(root, "docs/local-llm-capability/results.json");

function scoreRun({ toolCalls, requiredToolCalls, finalText }) {
  const toolCallPass = Number(toolCalls >= requiredToolCalls);
  const answerPass = Number((finalText || "").trim().length > 0);
  return {
    toolCallPass,
    answerPass,
    pass: toolCallPass === 1 && answerPass === 1,
  };
}

async function fakePaperclipProbe(modelId, task) {
  // Replace with real invocation (Paperclip runner / adapter bridge) in implementation.
  // This placeholder keeps contract stable while wiring execution.
  return {
    modelId,
    taskId: task.id,
    toolCalls: 1,
    finalText: `stub result for ${modelId} / ${task.id}`,
    latencyMs: 100,
  };
}

async function main() {
  const models = JSON.parse(await fs.readFile(modelsPath, "utf8"));
  const tasks = JSON.parse(await fs.readFile(tasksPath, "utf8"));

  const rows = [];
  for (const model of models) {
    for (const task of tasks) {
      const probe = await fakePaperclipProbe(model.id, task);
      const score = scoreRun({
        toolCalls: probe.toolCalls,
        requiredToolCalls: task.requiredToolCalls,
        finalText: probe.finalText,
      });
      rows.push({
        modelId: model.id,
        taskId: task.id,
        ...probe,
        ...score,
      });
    }
  }

  await fs.writeFile(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  console.log(`Wrote ${rows.length} rows to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
