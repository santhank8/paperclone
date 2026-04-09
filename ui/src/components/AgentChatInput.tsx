import { useState, useRef, type KeyboardEvent } from "react";
import { SendHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";

interface AgentChatInputProps {
  disabled?: boolean;
  isLoading?: boolean;
  onSend: (message: string) => void;
}

export function AgentChatInput({ disabled, isLoading, onSend }: AgentChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isLoading) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-border p-3 bg-background">
      <textarea
        ref={textareaRef}
        className={cn(
          "flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[38px] max-h-[160px] overflow-y-auto",
          (disabled || isLoading) && "opacity-50 cursor-not-allowed",
        )}
        placeholder={disabled ? "Waiting for agent…" : "Type a message…"}
        value={value}
        disabled={disabled || isLoading}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        rows={1}
      />
      <Button
        size="icon"
        variant="default"
        disabled={!value.trim() || disabled || isLoading}
        onClick={handleSend}
        className="shrink-0"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
      </Button>
    </div>
  );
}
