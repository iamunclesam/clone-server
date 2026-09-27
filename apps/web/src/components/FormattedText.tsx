"use client";

import React from "react";
import ReactMarkdown from "react-markdown";

interface FormattedTextProps {
  content?: string;
  text?: string;
  className?: string;
  isUser?: boolean;
}

/**
 * Rich Text / Markdown Renderer
 * Renders bold (**), italic (*), headers (#, ##, ###), lists (-/*), code (`), blockquotes (>), and links cleanly.
 */
export function FormattedText({ content, text, className = "", isUser = false }: FormattedTextProps) {
  const rawText = content || text || "";
  if (!rawText) return null;

  return (
    <div className={`formatted-text leading-relaxed break-words text-[13px] ${isUser ? "text-white" : "text-slate-800"} ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-base font-bold my-2 pb-1 border-b border-slate-200">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold my-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-bold font-mono uppercase tracking-wider my-1.5">{children}</h3>,
          p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 pl-4 list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 pl-4 list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-normal">{children}</li>,
          strong: ({ children }) => <strong className={`font-bold ${isUser ? "text-white" : "text-slate-900"}`}>{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 pl-3 py-1 border-l-2 border-slate-400 italic bg-slate-50/60 text-slate-700">
              {children}
            </blockquote>
          ),
          code: ({ children, inline }: any) =>
            inline ? (
              <code className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-rose-600 font-mono text-[11px] rounded-sm">
                {children}
              </code>
            ) : (
              <pre className="my-2 p-3 bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto border border-slate-800 rounded-sm">
                <code>{children}</code>
              </pre>
            ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
              {children}
            </a>
          ),
        }}
      >
        {rawText}
      </ReactMarkdown>
    </div>
  );
}

export default FormattedText;
