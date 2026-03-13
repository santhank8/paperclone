import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { projectsApi } from "../api/projects";
import { queryKeys } from "../lib/queryKeys";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function DeleteProjectDialog() {
  const { deleteProjectOpen, deleteProjectDefaults, closeDeleteProject } = useDialog();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deleteProject = useMutation({
    mutationFn: (projectId: string) =>
      projectsApi.remove(projectId, selectedCompanyId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.list(selectedCompanyId!),
      });
      handleClose();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to delete project. Please try again.";
      setErrorMessage(message);
    },
  });

  const handleClose = () => {
    setConfirmText("");
    setErrorMessage(null);
    closeDeleteProject();
  };

  const expectedText = deleteProjectDefaults
    ? `${deleteProjectDefaults.companyName}/${deleteProjectDefaults.projectName}`
    : "";

  const isValid = confirmText === expectedText;

  const handleConfirm = () => {
    if (deleteProjectDefaults && isValid) {
      deleteProject.mutate(deleteProjectDefaults.projectId);
    }
  };

  return (
    <Dialog open={deleteProjectOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {deleteProjectDefaults ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <DialogTitle>Delete project</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-foreground mb-4">
                <span className="font-semibold">Are you sure you want to delete this project?</span>
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                To confirm, type{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                  {expectedText}
                </code>{" "}
                below:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => {
                  setConfirmText(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder={`Type ${expectedText} to confirm`}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                autoFocus
              />
              {errorMessage && (
                <p className="mt-2 text-sm text-destructive">{errorMessage}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!isValid || deleteProject.isPending}
                onClick={handleConfirm}
              >
                {deleteProject.isPending ? "Deleting..." : "Delete project"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div />
        )}
      </DialogContent>
    </Dialog>
  );
}
