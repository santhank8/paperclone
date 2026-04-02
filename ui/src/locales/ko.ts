const ko = {
  translation: {
    // 사이드바 네비게이션
    sidebar: {
      selectCompany: "회사 선택",
      newIssue: "새 이슈",
      dashboard: "대시보드",
      inbox: "수신함",
      issues: "이슈",
      routines: "루틴",
      goals: "목표",
      work: "업무",
      company: "회사",
      org: "조직도",
      skills: "스킬",
      costs: "비용",
      activity: "활동",
      settings: "설정",
      projects: "프로젝트",
      agents: "에이전트",
    },

    // 인스턴스 설정 사이드바
    instanceSettings: {
      title: "인스턴스 설정",
      general: "일반",
      heartbeats: "하트비트",
      experimental: "실험적 기능",
      plugins: "플러그인",
    },

    // 레이아웃
    layout: {
      skipToMain: "본문으로 건너뛰기",
      closeSidebar: "사이드바 닫기",
      openSidebar: "사이드바 열기",
      documentation: "문서",
      instanceSettings: "인스턴스 설정",
      switchToLight: "라이트 모드로 전환",
      switchToDark: "다크 모드로 전환",
    },

    // 이슈 속성
    issueProperties: {
      status: "상태",
      priority: "우선순위",
      labels: "라벨",
      assignee: "담당자",
      project: "프로젝트",
      parent: "상위 이슈",
      depth: "깊이",
      createdBy: "생성자",
      started: "시작일",
      completed: "완료일",
      created: "생성일",
      updated: "수정일",
      noLabels: "라벨 없음",
      noAssignee: "담당자 없음",
      unassigned: "미할당",
      assignToMe: "나에게 할당",
      noProject: "프로젝트 없음",
      searchLabels: "라벨 검색...",
      searchAssignees: "담당자 검색...",
      searchProjects: "프로젝트 검색...",
      createLabel: "라벨 생성",
      user: "사용자",
      billingCode: "청구 코드",
      goal: "목표",
    },

    // 에이전트 속성
    agentProperties: {
      status: "상태",
      role: "역할",
      title: "직함",
      adapter: "어댑터",
      session: "세션",
      lastError: "마지막 오류",
      lastHeartbeat: "마지막 하트비트",
      reportsTo: "보고 대상",
      created: "생성일",
      capabilities: "역량",
      model: "모델",
    },

    // 프로젝트 속성
    projectProperties: {
      name: "이름",
      description: "설명",
      status: "상태",
      lead: "담당자",
      goals: "목표",
      created: "생성일",
      updated: "수정일",
      targetDate: "목표 일자",
      clearRepo: "레포 초기화",
      clearLocalFolder: "로컬 폴더 초기화",
      codebaseHelp: "코드베이스 도움말",
      executionWorkspacesHelp: "실행 워크스페이스 도움말",
    },

    // 목표 속성
    goalProperties: {
      status: "상태",
      level: "레벨",
      owner: "소유자",
      parentGoal: "상위 목표",
      created: "생성일",
      updated: "수정일",
    },

    // 페이지
    pages: {
      issues: "이슈",
      agents: "에이전트",
      projects: "프로젝트",
      goals: "목표",
      routines: "루틴",
      activity: "활동",
      inbox: "수신함",
      costs: "비용",
      org: "조직도",
      approvals: "승인",
      skills: "스킬",
      settings: "설정",
      dashboard: "대시보드",
    },

    // 빈 상태 메시지
    emptyStates: {
      selectCompanyAgents: "에이전트를 보려면 회사를 선택하세요.",
      selectCompanyProjects: "프로젝트를 보려면 회사를 선택하세요.",
      selectCompanyGoals: "목표를 보려면 회사를 선택하세요.",
      selectCompanyRoutines: "루틴을 보려면 회사를 선택하세요.",
      selectCompanyActivity: "활동을 보려면 회사를 선택하세요.",
      selectCompanyInbox: "수신함을 보려면 회사를 선택하세요.",
      selectCompanyCosts: "비용을 보려면 회사를 선택하세요.",
      selectCompanyOrg: "조직도를 보려면 회사를 선택하세요.",
      selectCompanySkills: "스킬을 관리하려면 회사를 선택하세요.",
      noProjects: "아직 프로젝트가 없습니다.",
      noGoals: "아직 목표가 없습니다.",
      noRoutines: "아직 루틴이 없습니다. 루틴 생성을 사용하여 첫 번째 반복 워크플로를 정의하세요.",
      noActivity: "아직 활동이 없습니다.",
      inboxZero: "수신함이 비어 있습니다.",
      noInboxNew: "새 수신 항목이 없습니다.",
      noInboxRecent: "최근 수신 항목이 없습니다.",
      noInboxFilter: "필터와 일치하는 수신 항목이 없습니다.",
      noPendingApprovals: "대기 중인 승인이 없습니다.",
      noApprovals: "아직 승인이 없습니다.",
      noOrgHierarchy: "정의된 조직 체계가 없습니다.",
      selectSkill: "파일을 확인하려면 스킬을 선택하세요.",
      noMonthlyCap: "월간 한도가 설정되지 않았습니다",
      noFinanceEvents: "아직 재무 이벤트가 없습니다...",
      noHeartbeats: "현재 조건에 맞는 스케줄러 하트비트가 없습니다.",
    },

    // 다이얼로그
    dialogs: {
      issueTitle: "이슈 제목",
      assignee: "담당자",
      project: "프로젝트",
      defaultModel: "기본 모델",
      addDescription: "설명 추가...",
      removeDocument: "문서 제거",
      removeAttachment: "첨부파일 제거",
      projectName: "프로젝트 이름",
      goalTitle: "목표 제목",
      create: "생성",
      cancel: "취소",
      save: "저장",
      delete: "삭제",
      close: "닫기",
      upload: "업로드",
    },

    // 에이전트 설정 폼
    agentConfig: {
      name: "이름",
      title: "직함",
      reportsTo: "보고 대상",
      capabilities: "역량",
      promptTemplate: "프롬프트 템플릿",
      adapterType: "어댑터 유형",
      workingDirectory: "작업 디렉토리 (비추천)",
      command: "명령어",
      bootstrapPrompt: "부트스트랩 프롬프트 (레거시)",
      extraArgs: "추가 인수 (쉼표 구분)",
      envVars: "환경 변수",
      timeoutSec: "타임아웃 (초)",
      gracePeriod: "인터럽트 유예 시간 (초)",
      heartbeatInterval: "하트비트 주기",
      wakeOnDemand: "요청 시 실행",
      cooldownSec: "쿨다운 (초)",
      maxConcurrentRuns: "최대 동시 실행 수",
      model: "모델",
      thinkingEffort: "추론 수준",
    },

    // 공통 액션
    actions: {
      search: "검색",
      searchIssues: "이슈, 에이전트, 프로젝트 검색...",
      searchIssuesPlaceholder: "이슈 검색...",
      leaveComment: "댓글 남기기...",
      copyAsMarkdown: "마크다운으로 복사",
      attachImage: "이미지 첨부",
      markAsRead: "읽음으로 표시",
      dismissFromInbox: "수신함에서 제거",
      expandDocument: "문서 펼치기",
      collapseDocument: "문서 접기",
      listView: "목록 보기",
      boardView: "보드 보기",
    },

    // 상태 라벨
    statuses: {
      backlog: "백로그",
      todo: "할 일",
      in_progress: "진행 중",
      in_review: "검토 중",
      done: "완료",
      blocked: "차단됨",
      cancelled: "취소됨",
    },

    // 우선순위 라벨
    priorities: {
      critical: "긴급",
      high: "높음",
      medium: "보통",
      low: "낮음",
    },

    // 에이전트 역할
    roles: {
      ceo: "CEO",
      cto: "CTO",
      manager: "매니저",
      engineer: "엔지니어",
      designer: "디자이너",
      qa: "QA",
    },

    // 온보딩 / 앱
    app: {
      instanceSetupRequired: "인스턴스 설정이 필요합니다",
      noInstanceAdmin: "아직 인스턴스 관리자가 없습니다...",
      createFirstCompany: "첫 번째 회사 만들기",
      getStarted: "회사를 만들어 시작하세요.",
      addAgent: "에이전트 추가",
      startOnboarding: "온보딩 시작",
      createAnotherCompany: "다른 회사 만들기",
      createAnotherAgent: "다른 에이전트 추가",
      loading: "로딩 중...",
    },

    // 언어
    language: {
      label: "언어",
      en: "English",
      ko: "한국어",
    },

    // 모바일 하단 네비게이션
    mobileNav: {
      dashboard: "대시보드",
      inbox: "수신함",
      issues: "이슈",
      agents: "에이전트",
      more: "더보기",
    },

    // 브레드크럼 & 기타
    beta: "베타",
  },
} as const;

export default ko;
