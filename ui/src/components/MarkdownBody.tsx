import { isValidElement, useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseProjectMentionHref } from "@paperclipai/shared";
import { cn } from "../lib/utils";
import { useTheme } from "../context/ThemeContext";
import { useWorkspaceFile } from "../context/WorkspaceFileContext";
import { Link } from "@/lib/router";

interface MarkdownBodyProps {
  children: string;
  className?: string;
}

let mermaidLoaderPromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidLoaderPromise) {
    mermaidLoaderPromise = import("mermaid").then((module) => module.default);
  }
  return mermaidLoaderPromise;
}

function flattenText(value: ReactNode): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenText(item)).join("");
  return "";
}

function extractMermaidSource(children: ReactNode): string | null {
  if (!isValidElement(children)) return null;
  const childProps = children.props as { className?: unknown; children?: ReactNode };
  if (typeof childProps.className !== "string") return null;
  if (!/\blanguage-mermaid\b/i.test(childProps.className)) return null;
  return flattenText(childProps.children).replace(/\n$/, "");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function mentionChipStyle(color: string | null): CSSProperties | undefined {
  if (!color) return undefined;
  const rgb = hexToRgb(color);
  if (!rgb) return undefined;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return {
    borderColor: color,
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`,
    color: luminance > 0.55 ? "#111827" : "#f8fafc",
  };
}

function MermaidDiagramBlock({ source, darkMode }: { source: string; darkMode: boolean }) {
  const renderId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSvg(null);
    setError(null);

    loadMermaid()
      .then(async (mermaid) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: darkMode ? "dark" : "default",
          fontFamily: "inherit",
          suppressErrorRendering: true,
        });
        const rendered = await mermaid.render(`outpost-mermaid-${renderId}`, source);
        if (!active) return;
        setSvg(rendered.svg);
      })
      .catch((err) => {
        if (!active) return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Failed to render Mermaid diagram.";
        setError(message);
      });

    return () => {
      active = false;
    };
  }, [darkMode, renderId, source]);

  return (
    <div className="outpost-mermaid">
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <>
          <p className={cn("outpost-mermaid-status", error && "outpost-mermaid-status-error")}>
            {error ? `Unable to render Mermaid diagram: ${error}` : "Rendering Mermaid diagram..."}
          </p>
          <pre className="outpost-mermaid-source">
            <code className="language-mermaid">{source}</code>
          </pre>
        </>
      )}
    </div>
  );
}

const FILE_PATH_EXTENSIONS = /\.(?:md|mdx|txt|log|json|jsonl|yaml|yml|toml|ini|ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|sh|bash|html|htm|css|scss|svg|xml|sql|csv|env|cfg|conf|lock)$/i;

function looksLikeFilePath(text: string): boolean {
  if (!text.includes("/")) return false;
  if (/^https?:\/\//i.test(text)) return false;
  if (/^mailto:/i.test(text)) return false;
  if (text.startsWith("#")) return false;
  if (text.includes(" ") || text.includes("\n")) return false;
  if (text.length > 300 || text.length < 3) return false;
  return FILE_PATH_EXTENSIONS.test(text) || text.endsWith("/");
}

function resolveWorkspacePath(text: string, cwd: string | null): string | null {
  const cleaned = text.replace(/^\.\//, "");

  if (cwd) {
    const normalizedCwd = cwd.endsWith("/") ? cwd : cwd + "/";

    if (cleaned.startsWith(normalizedCwd)) {
      return cleaned.slice(normalizedCwd.length);
    }

    const cwdSegments = normalizedCwd.replace(/\/$/, "").split("/");
    for (let i = 1; i < cwdSegments.length; i++) {
      const suffix = cwdSegments.slice(i).join("/") + "/";
      if (cleaned.startsWith(suffix)) {
        return cleaned.slice(suffix.length);
      }
    }
  }

  return cleaned;
}

function workspaceFileHref(agentRouteId: string, filePath: string): string {
  return `/agents/${agentRouteId}/workspace?file=${encodeURIComponent(filePath)}`;
}

function WorkspaceFileLink({
  agentRouteId,
  filePath,
  children,
  inline,
}: {
  agentRouteId: string;
  filePath: string;
  children: ReactNode;
  inline?: boolean;
}) {
  return (
    <Link
      to={workspaceFileHref(agentRouteId, filePath)}
      className={cn(
        "outpost-workspace-file-link",
        inline
          ? "font-mono text-[0.85em] px-1 py-0.5 rounded bg-primary/8 text-primary hover:bg-primary/15 transition-colors no-underline border border-primary/15"
          : "text-primary hover:underline",
      )}
      title={`Open in workspace: ${filePath}`}
    >
      {children}
    </Link>
  );
}

export function MarkdownBody({ children, className }: MarkdownBodyProps) {
  const { theme } = useTheme();
  const wsCtx = useWorkspaceFile();
  return (
    <div
      className={cn(
        "outpost-markdown prose prose-sm max-w-none prose-pre:whitespace-pre-wrap prose-pre:break-words prose-code:break-all",
        theme === "dark" && "prose-invert",
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ node: _node, children: preChildren, ...preProps }) => {
            const mermaidSource = extractMermaidSource(preChildren);
            if (mermaidSource) {
              return <MermaidDiagramBlock source={mermaidSource} darkMode={theme === "dark"} />;
            }
            return <pre {...preProps}>{preChildren}</pre>;
          },
          a: ({ href, children: linkChildren }) => {
            const parsed = href ? parseProjectMentionHref(href) : null;
            if (parsed) {
              const label = linkChildren;
              return (
                <a
                  href={`/projects/${parsed.projectId}`}
                  className="outpost-project-mention-chip"
                  style={mentionChipStyle(parsed.color)}
                >
                  {label}
                </a>
              );
            }
            if (wsCtx && href && looksLikeFilePath(href)) {
              const resolved = resolveWorkspacePath(href, wsCtx.workspaceCwd);
              if (resolved) {
                return (
                  <WorkspaceFileLink agentRouteId={wsCtx.agentRouteId} filePath={resolved}>
                    {linkChildren}
                  </WorkspaceFileLink>
                );
              }
            }
            return (
              <a href={href} rel="noreferrer">
                {linkChildren}
              </a>
            );
          },
          code: ({ node: _node, className: codeClassName, children: codeChildren, ...codeProps }) => {
            const isBlock = codeClassName && /^language-/.test(codeClassName);
            if (isBlock || !wsCtx) {
              return <code className={codeClassName} {...codeProps}>{codeChildren}</code>;
            }
            const text = flattenText(codeChildren);
            if (looksLikeFilePath(text)) {
              const resolved = resolveWorkspacePath(text, wsCtx.workspaceCwd);
              if (resolved) {
                return (
                  <WorkspaceFileLink agentRouteId={wsCtx.agentRouteId} filePath={resolved} inline>
                    {text}
                  </WorkspaceFileLink>
                );
              }
            }
            return <code className={codeClassName} {...codeProps}>{codeChildren}</code>;
          },
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
