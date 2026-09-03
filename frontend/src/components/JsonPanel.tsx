import React, { useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, FileCode } from "lucide-react";

interface JsonPanelProps {
  data: any;
}

export const JsonPanel: React.FC<JsonPanelProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/90 text-xs">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 font-medium cursor-pointer"
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          )}
          <FileCode className="w-3.5 h-3.5 text-cyan-400" />
          <span>原始响应数据 (Raw HTTP JSON)</span>
          <span className="text-[11px] font-mono text-zinc-400">
            {isOpen ? "点击收起" : "默认折叠，点击展开"}
          </span>
        </button>

        {isOpen && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-zinc-400" />
                <span>复制 JSON</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="p-4 bg-zinc-950/90 border-t border-zinc-800/80 max-h-96 overflow-auto">
          <pre className="text-[11px] font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap break-all">
            {jsonString}
          </pre>
        </div>
      )}
    </div>
  );
};
