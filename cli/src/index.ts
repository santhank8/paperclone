import { Command } from "commander";
import { onboard } from "./commands/onboard.js";
import { doctor } from "./commands/doctor.js";
import { envCommand } from "./commands/env.js";
import { configure } from "./commands/configure.js";
import { addAllowedHostname } from "./commands/allowed-hostname.js";
import { heartbeatRun } from "./commands/heartbeat-run.js";
import { runCommand } from "./commands/run.js";
import { bootstrapCeoInvite } from "./commands/auth-bootstrap-ceo.js";
import { dbBackupCommand } from "./commands/db-backup.js";
import { registerContextCommands } from "./commands/client/context.js";
import { registerCompanyCommands } from "./commands/client/company.js";
import { registerIssueCommands } from "./commands/client/issue.js";
import { registerAgentCommands } from "./commands/client/agent.js";
import { registerApprovalCommands } from "./commands/client/approval.js";
import { registerActivityCommands } from "./commands/client/activity.js";
import { registerDashboardCommands } from "./commands/client/dashboard.js";
import { applyDataDirOverride, type DataDirOptionLike } from "./config/data-dir.js";
import { loadPaperclipEnvFile } from "./config/env.js";
import { registerWorktreeCommands } from "./commands/worktree.js";
import { registerPluginCommands } from "./commands/client/plugin.js";

const program = new Command();
const DATA_DIR_OPTION_HELP =
  "Paperclip 数据目录根路径（与 ~/.paperclip 隔离状态）";

program
  .name("paperclipai")
  .description("Paperclip CLI — 设置、诊断和配置你的实例")
  .version("0.2.7");

program.hook("preAction", (_thisCommand, actionCommand) => {
  const options = actionCommand.optsWithGlobals() as DataDirOptionLike;
  const optionNames = new Set(actionCommand.options.map((option) => option.attributeName()));
  applyDataDirOverride(options, {
    hasConfigOption: optionNames.has("config"),
    hasContextOption: optionNames.has("context"),
  });
  loadPaperclipEnvFile(options.config);
});

program
  .command("onboard")
  .description("交互式首次运行设置向导")
  .option("-c, --config <path>", "配置文件路径")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("-y, --yes", "接受默认值（快速启动 + 立即运行）", false)
  .option("--run", "保存配置后立即启动 Paperclip", false)
  .action(onboard);

program
  .command("doctor")
  .description("运行 Paperclip 设置诊断检查")
  .option("-c, --config <path>", "配置文件路径")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("--repair", "尝试自动修复问题")
  .alias("--fix")
  .option("-y, --yes", "跳过修复确认提示")
  .action(async (opts) => {
    await doctor(opts);
  });

program
  .command("env")
  .description("打印部署环境变量")
  .option("-c, --config <path>", "配置文件路径")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .action(envCommand);

program
  .command("configure")
  .description("更新配置部分")
  .option("-c, --config <path>", "配置文件路径")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("-s, --section <section>", "要配置的部分（llm、database、logging、server、storage、secrets）")
  .action(configure);

program
  .command("db:backup")
  .description("使用当前配置创建一次性数据库备份")
  .option("-c, --config <path>", "配置文件路径")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("--dir <path>", "备份输出目录（覆盖配置）")
  .option("--retention-days <days>", "用于清理的保留时间窗口", (value) => Number(value))
  .option("--filename-prefix <prefix>", "备份文件名前缀", "paperclip")
  .option("--json", "以 JSON 格式打印备份元数据")
  .action(async (opts) => {
    await dbBackupCommand(opts);
  });

program
  .command("allowed-hostname")
  .description("允许主机名用于认证/私有模式访问")
  .argument("<host>", "要允许的主机名（例如 dotta-macbook-pro）")
  .option("-c, --config <path>", "配置文件路径")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .action(addAllowedHostname);

program
  .command("run")
  .description("引导本地设置（onboard + doctor）并运行 Paperclip")
  .option("-c, --config <path>", "配置文件路径")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("-i, --instance <id>", "本地实例 ID（默认：default）")
  .option("--repair", "在 doctor 期间尝试自动修复", true)
  .option("--no-repair", "禁用 doctor 期间的自动修复")
  .action(runCommand);

const heartbeat = program.command("heartbeat").description("心跳检测工具");

heartbeat
  .command("run")
  .description("运行一次智能体心跳检测并流式输出实时日志")
  .requiredOption("-a, --agent-id <agentId>", "要调用的智能体 ID")
  .option("-c, --config <path>", "配置文件路径")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("--context <path>", "CLI 上下文文件路径")
  .option("--profile <name>", "CLI 上下文配置文件名")
  .option("--api-base <url>", "Paperclip 服务器 API 基础 URL")
  .option("--api-key <token>", "用于智能体认证调用的 Bearer 令牌")
  .option(
    "--source <source>",
    "调用来源（timer | assignment | on_demand | automation）",
    "on_demand",
  )
  .option("--trigger <trigger>", "触发详情（manual | ping | callback | system）", "manual")
  .option("--timeout-ms <ms>", "放弃前的最大等待时间", "0")
  .option("--json", "在适用时输出原始 JSON")
  .option("--debug", "显示原始适配器 stdout/stderr JSON 数据块")
  .action(heartbeatRun);

registerContextCommands(program);
registerCompanyCommands(program);
registerIssueCommands(program);
registerAgentCommands(program);
registerApprovalCommands(program);
registerActivityCommands(program);
registerDashboardCommands(program);
registerWorktreeCommands(program);
registerPluginCommands(program);

const auth = program.command("auth").description("认证和引导工具");

auth
  .command("bootstrap-ceo")
  .description("为首位实例管理员创建一次性引导邀请 URL")
  .option("-c, --config <path>", "配置文件路径")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("--force", "即使管理员已存在也创建新邀请", false)
  .option("--expires-hours <hours>", "邀请过期时间（小时）", (value) => Number(value))
  .option("--base-url <url>", "用于打印邀请链接的公共基础 URL")
  .action(bootstrapCeoInvite);

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
