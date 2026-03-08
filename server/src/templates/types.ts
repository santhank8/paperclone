import type {
  CompanyPortabilityManifest,
  CompanyTemplateCatalogEntry,
} from "@paperclipai/shared";

export interface BuiltInTemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: string | null;
  tags: string[];
  recommended: boolean;
  icon: string | null;
}

export interface TemplateRegistryOptions {
  templatesRoot?: string;
}

export interface BuiltInTemplateBundle {
  template: CompanyTemplateCatalogEntry;
  manifest: CompanyPortabilityManifest;
  files: Record<string, string>;
  warnings: string[];
}
