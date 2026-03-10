import { createDb } from "./client.js";
import { companies, agents, goals, projects, issues } from "./schema/index.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const db = createDb(url);

console.log("Seeding database...");

const [company] = await db
  .insert(companies)
  .values({
    name: "Writers Room Demo",
    description: "A demo writers room production",
    status: "active",
    budgetMonthlyCents: 50000,
  })
  .returning();

const [showrunner] = await db
  .insert(agents)
  .values({
    companyId: company!.id,
    name: "Showrunner",
    role: "showrunner",
    title: "Head of the Room",
    status: "idle",
    adapterType: "process",
    adapterConfig: { command: "echo", args: ["hello from showrunner"] },
    budgetMonthlyCents: 15000,
  })
  .returning();

const [staffWriter] = await db
  .insert(agents)
  .values({
    companyId: company!.id,
    name: "Staff Writer",
    role: "staff_writer",
    title: "Staff Writer",
    status: "idle",
    reportsTo: showrunner!.id,
    adapterType: "process",
    adapterConfig: { command: "echo", args: ["hello from staff writer"] },
    budgetMonthlyCents: 10000,
  })
  .returning();

const [goal] = await db
  .insert(goals)
  .values({
    companyId: company!.id,
    title: "Season 1 Pilot",
    description: "Write and deliver the pilot episode",
    level: "production",
    status: "active",
    ownerAgentId: showrunner!.id,
  })
  .returning();

const [project] = await db
  .insert(projects)
  .values({
    companyId: company!.id,
    goalId: goal!.id,
    name: "Episode 1: Pilot",
    description: "Draft and polish the pilot episode script",
    status: "in_progress",
    leadAgentId: showrunner!.id,
  })
  .returning();

await db.insert(issues).values([
  {
    companyId: company!.id,
    projectId: project!.id,
    goalId: goal!.id,
    title: "Write cold open for pilot",
    description: "Draft the teaser/cold open scene for episode 1",
    status: "todo",
    priority: "high",
    assigneeAgentId: staffWriter!.id,
    createdByAgentId: showrunner!.id,
  },
  {
    companyId: company!.id,
    projectId: project!.id,
    goalId: goal!.id,
    title: "Develop character bibles",
    description: "Create detailed backstories for the main cast",
    status: "backlog",
    priority: "medium",
    createdByAgentId: showrunner!.id,
  },
]);

console.log("Seed complete");
process.exit(0);
