import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EntityRow } from "../components/EntityRow";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate, projectUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Hexagon, Plus, MoreHorizontal, Trash2 } from "lucide-react";

export function Projects() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { openNewProject, openDeleteProject } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Projects" }]);
  }, [setBreadcrumbs]);

  const {
    data: projects,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return (
      <EmptyState icon={Hexagon} message="Select a company to view projects." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={openNewProject}>
          <Plus className="h-4 w-4 mr-1" />
          Add Project
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {projects && projects.length === 0 && (
        <EmptyState
          icon={Hexagon}
          message="No projects yet."
          action="Add Project"
          onAction={openNewProject}
        />
      )}

      {projects && projects.length > 0 && (
        <div className="border border-border">
          {projects.map((project) => (
            <EntityRow
              key={project.id}
              title={project.name}
              subtitle={project.description ?? undefined}
              to={projectUrl(project)}
              trailing={
                <div className="flex items-center gap-3">
                  {project.targetDate && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(project.targetDate)}
                    </span>
                  )}
                  <StatusBadge status={project.status} />
                  <Popover
                    open={openMenuId === project.id}
                    onOpenChange={(open) =>
                      setOpenMenuId(open ? project.id : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-1" align="end">
                      <button
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openDeleteProject({
                            projectId: project.id,
                            projectName: project.name,
                            companyName: selectedCompany?.name ?? "",
                          });
                          setOpenMenuId(null);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </PopoverContent>
                  </Popover>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
