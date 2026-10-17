import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Send,
  Copy,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  History,
  Bot,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateStandupDigestAction } from "@/lib/coordinator.functions";

interface StandupDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  digests: Array<{
    id: string;
    workspace_id: string;
    summary_markdown: string;
    blocker_count: number;
    completed_count: number;
    in_progress_count: number;
    broadcast_telegram: boolean;
    created_at: string;
  }>;
  onRefresh: () => void;
}

export function StandupDigestModal({
  isOpen,
  onClose,
  digests,
  onRefresh,
}: StandupDigestModalProps) {
  const generateFn = useServerFn(generateStandupDigestAction);
  const [generating, setGenerating] = useState(false);
  const [activeDigestText, setActiveDigestText] = useState<string | null>(
    digests[0]?.summary_markdown ?? null,
  );
  const [copied, setCopied] = useState(false);
  const [broadcasted, setBroadcasted] = useState(false);

  async function handleGenerate(broadcastTelegram = false) {
    setGenerating(true);
    try {
      const res = await generateFn({ data: { workspaceId: "ws_default", broadcastTelegram } });
      setActiveDigestText(res.summaryMarkdown);
      if (broadcastTelegram) {
        setBroadcasted(true);
        toast.success(`Executive Digest generated and broadcast to ${res.telegramBroadcastCount} Telegram chats! 🚀`);
      } else {
        toast.success("Executive Daily Standup Digest compiled successfully!");
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate standup digest");
    } finally {
      setGenerating(false);
    }
  }

  function handleCopy() {
    if (!activeDigestText) return;
    navigator.clipboard.writeText(activeDigestText);
    setCopied(true);
    toast.success("Markdown copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!activeDigestText) return;
    const blob = new Blob([activeDigestText], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenants-standup-digest-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Standup digest downloaded as Markdown file!");
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl bg-white border-slate-200 text-slate-900 p-6 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400">
              <Bot className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                AI Standup Digest Generator
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-xs">
                Autonomous daily standup synthesis • Markdown export • Telegram broadcast
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-1 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={generating}
              onClick={() => handleGenerate(false)}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs shadow-md shadow-cyan-950/40"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 animate-spin" style={{ animationDuration: generating ? "1s" : "0s" }} />
              {generating ? "Synthesizing..." : "Generate New Digest"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={generating}
              onClick={() => handleGenerate(true)}
              className="border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-medium"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Generate & Broadcast to Telegram
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!activeDigestText}
              onClick={handleCopy}
              className="border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs"
            >
              <Copy className="w-3.5 h-3.5 mr-1" />
              {copied ? "Copied!" : "Copy MD"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!activeDigestText}
              onClick={handleDownload}
              className="border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Download .md
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
          {activeDigestText ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 font-mono text-xs text-slate-700 leading-relaxed whitespace-pre-wrap select-text">
              {activeDigestText}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-slate-500 text-xs">No digest generated yet for this session.</p>
              <Button
                type="button"
                size="sm"
                onClick={() => handleGenerate(false)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
              >
                Compile First Standup Digest
              </Button>
            </div>
          )}

          {/* Historical Digests List */}
          {digests.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <span className="text-xs font-semibold text-slate-500 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                <History className="w-3.5 h-3.5 text-cyan-400" />
                Previous Standup Records ({digests.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {digests.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setActiveDigestText(d.summary_markdown)}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-all flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        {new Date(d.created_at).toLocaleDateString([], { month: "short", day: "numeric" })} •{" "}
                        {new Date(d.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        🚨 {d.blocker_count} blockers • ✅ {d.completed_count} done
                      </span>
                    </div>
                    {d.broadcast_telegram && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                        Telegram
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
