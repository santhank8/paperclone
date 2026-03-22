# 记忆系统全景

日期：2026-03-17

本文档总结了任务 `PAP-530` 中引用的记忆系统，并提取了对 Paperclip 重要的设计模式。

## Paperclip 从此调查中需要什么

Paperclip 不是要成为一个单一的预设记忆引擎。更有用的目标是一个控制面板记忆层，它：

- 保持公司范围
- 让每个公司选择默认记忆提供者
- 让特定智能体覆盖该默认值
- 保持溯源回 Paperclip 运行、任务、评论和文档
- 像控制面板记录工作一样记录与记忆相关的成本和延迟
- 与插件提供的提供者一起工作，不仅仅是内置的

问题不是"哪个记忆项目胜出？"问题是"能够位于多个非常不同的记忆系统之上而不抹平有用差异的最小 Paperclip 合约是什么？"

## 快速分组

### 托管记忆 API

- `mem0`
- `supermemory`
- `Memori`

这些优化了简单的应用集成：发送对话/内容加上身份，然后稍后查询相关记忆或用户上下文。

### 以智能体为中心的记忆框架/记忆操作系统

- `MemOS`
- `memU`
- `EverMemOS`
- `OpenViking`

这些将记忆视为智能体运行时子系统，不仅仅是搜索索引。它们通常添加任务记忆、配置文件、文件系统风格的组织、异步摄取或技能/资源管理。

### 本地优先记忆存储/索引

- `nuggets`
- `memsearch`

这些强调本地持久化、可检查性和低运营开销。它们很有用，因为 Paperclip 今天是本地优先的，至少需要一个零配置路径。

## 每个项目的备注

| 项目 | 形态 | 值得注意的 API/模型 | 对 Paperclip 的强适配性 | 主要不匹配 |
|---|---|---|---|---|
| [nuggets](https://github.com/NeoVertex1/nuggets) | 本地记忆引擎 + 消息网关 | 主题范围 HRR 记忆，含 `remember`、`recall`、`forget`，事实提升到 `MEMORY.md` | 轻量级本地记忆和自动提升的好例子 | 架构非常特定；不是通用多租户服务 |
| [mem0](https://github.com/mem0ai/mem0) | 托管 + 开源 SDK | `add`、`search`、`getAll`、`get`、`update`、`delete`、`deleteAll`；通过 `user_id`、`agent_id`、`run_id`、`app_id` 实体分区 | 最接近带身份和元数据过滤器的干净提供者 API | 提供者大量拥有提取逻辑；Paperclip 不应假设每个后端都像 mem0 一样工作 |
| [MemOS](https://github.com/MemTensor/MemOS) | 记忆操作系统/框架 | 统一的增删改查、记忆块、多模态记忆、工具记忆、异步调度器、反馈/纠正 | 超越普通搜索的可选能力的强来源 | 比 Paperclip 应首先标准化的最小合约宽泛得多 |
| [supermemory](https://github.com/supermemoryai/supermemory) | 托管记忆 + 上下文 API | `add`、`profile`、`search.memories`、`search.documents`、文档上传、设置；自动配置文件构建和遗忘 | "上下文包"而非原始搜索结果的强例子 | 围绕自己的本体和托管流程高度产品化 |
| [memU](https://github.com/NevaMind-AI/memU) | 主动智能体记忆框架 | 文件系统隐喻、主动循环、意图预测、始终在线的伴随模型 | 记忆应何时触发智能体行为而非仅检索的好来源 | 主动助手框架比 Paperclip 以任务为中心的控制面板更广泛 |
| [Memori](https://github.com/MemoriLabs/Memori) | 托管记忆织物 + SDK 封装 | 注册到 LLM SDK、通过 `entity_id` + `process_id` 归因、会话、云 + BYODB | 围绕模型客户端自动捕获的强例子 | 封装式设计不与 Paperclip 的运行/任务/评论生命周期一一映射 |
| [EverMemOS](https://github.com/EverMind-AI/EverMemOS) | 对话式长期记忆系统 | MemCell 提取、结构化叙述、用户配置文件、混合检索/重排序 | 溯源丰富的结构化记忆和演化配置文件的有用模型 | 聚焦于对话记忆而非通用控制面板事件 |
| [memsearch](https://github.com/zilliztech/memsearch) | markdown 优先本地记忆索引 | markdown 作为真相来源、`index`、`search`、`watch`、转录解析、插件钩子 | 本地内置提供者和可检查溯源的优秀基线 | 刻意简单；无托管服务语义或丰富的纠正工作流 |
| [OpenViking](https://github.com/volcengine/OpenViking) | 上下文数据库 | 记忆/资源/技能的文件系统风格组织、分层加载、可视化检索轨迹 | 浏览/检查 UX 和上下文溯源的强来源 | 将"上下文数据库"视为比 Paperclip 应拥有的更大的产品表面 |

## 全景中的共同原语

尽管系统在架构上不一致，它们在几个原语上趋于一致：

- `摄取`：从文本、消息、文档或转录添加记忆
- `查询`：给定任务、问题或范围搜索或检索记忆
- `范围`：按用户、智能体、项目、进程或会话分区记忆
- `溯源`：携带足够的元数据来解释记忆来自哪里
- `维护`：随时间更新、遗忘、去重、压缩或纠正记忆
- `上下文组装`：将原始记忆转换为准备好给智能体的提示包

如果 Paperclip 不暴露这些，它将无法很好地适应上述系统。

## 系统差异所在

这些差异正是 Paperclip 需要分层合约而非单一硬编码引擎的原因。

### 1. 谁拥有提取？

- `mem0`、`supermemory` 和 `Memori` 期望提供者从对话中推断记忆。
- `memsearch` 期望宿主决定写什么 markdown，然后索引它。
- `MemOS`、`memU`、`EverMemOS` 和 `OpenViking` 介于两者之间，通常暴露更丰富的记忆构建管道。

Paperclip 应支持两者：

- 提供者管理的提取
- Paperclip 管理的提取，配合提供者管理的存储/检索

### 2. 什么是真相来源？

- `memsearch` 和 `nuggets` 使来源在磁盘上可检查。
- 托管 API 通常使提供者存储成为规范。
- 文件系统风格的系统如 `OpenViking` 和 `memU` 将层级本身作为记忆模型的一部分。

Paperclip 不应要求单一存储形状。它应要求回到 Paperclip 实体的规范化引用。

### 3. 记忆仅仅是搜索，还是也包括配置文件和规划状态？

- `mem0` 和 `memsearch` 以搜索和 CRUD 为中心。
- `supermemory` 添加了用户配置文件作为一等输出。
- `MemOS`、`memU`、`EverMemOS` 和 `OpenViking` 扩展到工具追踪、任务记忆、资源和技能。

Paperclip 应将普通搜索作为最低合约，更丰富的输出作为可选能力。

### 4. 记忆是同步还是异步？

- 本地工具通常在进程内同步工作。
- 较大的系统添加调度器、后台索引、压缩或同步作业。

Paperclip 需要直接的请求/响应操作和后台维护钩子。

## Paperclip 特定的要点

### Paperclip 应拥有的关注点

- 将提供者绑定到公司并可选地按智能体覆盖
- 将 Paperclip 实体映射到提供者范围
- 溯源回任务评论、文档、运行和活动
- 记忆工作的成本/token/延迟报告
- Paperclip UI 中的浏览和检查界面
- 破坏性操作的治理

### 提供者应拥有的关注点

- 提取启发式
- 嵌入/索引策略
- 排序和重排序
- 配置文件合成
- 矛盾解决和遗忘逻辑
- 存储引擎细节

### 控制面板合约应保持精简

Paperclip 不需要标准化每个提供者的每个功能。它需要：

- 必需的可移植核心
- 更丰富提供者的可选能力标志
- 记录提供者原生 ID 和元数据的方式，而不假装所有提供者在内部是等价的

## 推荐方向

Paperclip 应采用两层记忆模型：

1. `记忆绑定 + 控制面板层`
   Paperclip 决定哪个提供者密钥对公司、智能体或项目生效，并记录每个记忆操作的溯源和使用情况。

2. `提供者适配器层`
   内置或插件提供的适配器将 Paperclip 记忆请求转换为提供者特定的调用。

可移植核心应涵盖：

- 摄取/写入
- 搜索/回忆
- 浏览/检查
- 通过提供者记录句柄获取
- 遗忘/纠正
- 使用量报告

可选能力可涵盖：

- 配置文件合成
- 异步摄取
- 多模态内容
- 工具/资源/技能记忆
- 提供者原生图浏览

这足以支持：

- 类似 `memsearch` 的本地 markdown 优先基线
- 类似 `mem0`、`supermemory` 或 `Memori` 的托管服务
- 类似 `MemOS` 或 `OpenViking` 的更丰富的智能体记忆系统

而不强迫 Paperclip 本身成为一个单体记忆引擎。
