import { api } from "./client";

export interface RoadmapLink {
  label: string;
  path: string;
}

export interface RoadmapItemField {
  key: string;
  value: string;
}

export interface RoadmapItem {
  id: string;
  title: string;
  fields: RoadmapItemField[];
}

export interface RoadmapSection {
  title: string;
  items: RoadmapItem[];
}

export interface RoadmapDocument {
  label: string;
  path: string;
  title: string;
  status: string | null;
  owner: string | null;
  lastUpdated: string | null;
  contract: string[];
  sections: RoadmapSection[];
  markdown: string;
}

export interface RoadmapPayload {
  index: {
    path: string;
    markdown: string;
    links: RoadmapLink[];
  };
  roadmap: RoadmapDocument;
}

export interface RoadmapRenamePayload extends RoadmapPayload {
  item: RoadmapItem;
}

export const roadmapApi = {
  get: (companyId?: string | null) => {
    if (companyId && companyId.trim().length > 0) {
      return api.get<RoadmapPayload>(`/roadmap?companyId=${encodeURIComponent(companyId)}`);
    }
    return api.get<RoadmapPayload>("/roadmap");
  },
  renameItem: (roadmapId: string, title: string, companyId?: string | null) => {
    const params = companyId && companyId.trim().length > 0
      ? `?companyId=${encodeURIComponent(companyId)}`
      : "";
    return api.patch<RoadmapRenamePayload>(`/roadmap/items/${encodeURIComponent(roadmapId)}${params}`, { title });
  },
};
