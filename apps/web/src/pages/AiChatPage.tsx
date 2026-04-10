import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useThemeStore } from "@/store/themeStore";
import { getPalette, buildStyles } from "./dashboard/theme";
import { apiFetch, ApiError } from "@/lib/api";
import { getSessionId } from "@/lib/session";
import type {
  AiConversation,
  AiConversationsListResponse,
  AiQueryResponse,
  AiChatHistoryResponse,
} from "@repo/shared";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  data?: Array<Record<string, unknown>> | null;
  /** Assistant-only: Anthropic overloaded — show Retry */
  aiOverloaded?: boolean;
  retryQuestion?: string;
}

const SUGGESTIONS = [
  "Which endpoint was called most often in the last 24 hours?",
  "How many 500 errors happened this week?",
  "What is the average response time for /api/sales?",
  "Show me the slowest endpoints",
];

let nextLocalId = 0;
function localId() {
  return `local-${nextLocalId++}`;
}

export default function AiChatPage() {
  const theme = useThemeStore((s) => s.theme);
  const palette = useMemo(() => getPalette(theme), [theme]);
  const s = useMemo(() => buildStyles(palette), [palette]);
  const sessionId = useMemo(() => getSessionId(), []);

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createConversation = useCallback(async () => {
    const conv = await apiFetch<AiConversation>("/api/ai/conversations", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setMessages([]);
    return conv;
  }, [sessionId]);

  useEffect(() => {
    async function init() {
      try {
        const res = await apiFetch<AiConversationsListResponse>(
          `/api/ai/conversations?sessionId=${sessionId}`,
        );
        if (res.conversations.length > 0) {
          setConversations(res.conversations);
          setActiveId(res.conversations[0].id);
        } else {
          await createConversation();
        }
      } catch {
        /* non-critical */
      } finally {
        setHydrating(false);
      }
    }
    void init();
  }, [sessionId, createConversation]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;

    async function loadMessages() {
      try {
        const res = await apiFetch<AiChatHistoryResponse>(
          `/api/ai/conversations/${activeId}/messages`,
        );
        if (!cancelled) {
          setMessages(
            res.messages.map((m) => ({
              id: m.id,
              role: m.role,
              text: m.content,
              data: m.data,
            })),
          );
        }
      } catch {
        if (!cancelled) setMessages([]);
      }
    }

    void loadMessages();
    return () => { cancelled = true; };
  }, [activeId]);

  async function send(question: string, options?: { skipUserMessage?: boolean }) {
    const q = question.trim();
    if (!q || loading || !activeId) return;

    if (!options?.skipUserMessage) {
      const userMsg: ChatMessage = { id: localId(), role: "user", text: q };
      setMessages((prev) => [...prev, userMsg]);
    }
    setInput("");
    setLoading(true);

    try {
      const res = await apiFetch<AiQueryResponse>("/api/ai/query", {
        method: "POST",
        body: JSON.stringify({ conversationId: activeId, question: q }),
      });

      const assistantMsg: ChatMessage = {
        id: localId(),
        role: "assistant",
        text: res.answer,
        data: res.data,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const refreshed = await apiFetch<AiConversationsListResponse>(
        `/api/ai/conversations?sessionId=${sessionId}`,
      );
      setConversations(refreshed.conversations);
    } catch (err) {
      if (err instanceof ApiError && err.code === "AI_OVERLOADED") {
        const errorMsg: ChatMessage = {
          id: localId(),
          role: "assistant",
          text: err.message,
          aiOverloaded: true,
          retryQuestion: q,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: localId(),
          role: "assistant",
          text: err instanceof Error ? err.message : "Something went wrong",
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleRetryOverload(messageId: string, question: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    void send(question, { skipUserMessage: true });
  }

  async function handleNewChat() {
    try {
      await createConversation();
    } catch {
      /* best-effort */
    }
  }

  async function handleArchive(convId: string) {
    try {
      await apiFetch(`/api/ai/conversations/${convId}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeId === convId) {
        const remaining = conversations.filter((c) => c.id !== convId);
        if (remaining.length > 0) {
          setActiveId(remaining[0].id);
        } else {
          await createConversation();
        }
      }
    } catch {
      /* best-effort */
    }
  }

  function selectConversation(convId: string) {
    if (convId === activeId) return;
    setActiveId(convId);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const bubbleUser: React.CSSProperties = {
    background: "var(--bs-primary)",
    color: "#fff",
    borderRadius: "16px 16px 4px 16px",
    padding: "10px 16px",
    maxWidth: "75%",
    alignSelf: "flex-end",
    fontSize: "0.9rem",
    lineHeight: 1.5,
  };

  const bubbleAssistant: React.CSSProperties = {
    background: palette.card,
    border: `1px solid ${palette.border}`,
    color: palette.text,
    borderRadius: "16px 16px 16px 4px",
    padding: "10px 16px",
    maxWidth: "75%",
    alignSelf: "flex-start",
    fontSize: "0.9rem",
    lineHeight: 1.5,
  };

  const sidebarStyle: React.CSSProperties = {
    width: 260,
    minWidth: 260,
    borderRight: `1px solid ${palette.border}`,
    background: palette.bg,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const sidebarItemBase: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 6,
    fontSize: "0.82rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    transition: "background 0.15s",
  };

  if (hydrating) {
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...s.page, display: "flex", padding: 0 }}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={{ padding: "16px 12px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: palette.text }}>Chats</span>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            style={{ fontSize: "0.75rem", padding: "3px 10px" }}
            onClick={() => void handleNewChat()}
          >
            + New
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
          {conversations.map((conv) => {
            const isActive = conv.id === activeId;
            return (
              <div
                key={conv.id}
                style={{
                  ...sidebarItemBase,
                  background: isActive ? palette.card : "transparent",
                  border: isActive ? `1px solid ${palette.border}` : "1px solid transparent",
                  marginBottom: 2,
                }}
                onClick={() => selectConversation(conv.id)}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: palette.text,
                    fontWeight: isActive ? 600 : 400,
                  }}
                  title={conv.title}
                >
                  {conv.title}
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    fontSize: "0.7rem",
                    padding: "1px 5px",
                    color: palette.muted,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  title="Delete chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleArchive(conv.id);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "16px 28px 0" }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 600, marginBottom: 2 }}>AI Analytics Chat</h1>
          <p style={{ color: palette.muted, fontSize: "0.82rem", margin: 0 }}>
            Ask questions about your HTTP request logs in natural language
          </p>
        </div>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {messages.length === 0 && !loading && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
              }}
            >
              <div style={{ color: palette.muted, fontSize: "0.9rem", fontWeight: 500 }}>
                Try one of these questions:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 600 }}>
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="btn btn-sm"
                    style={{
                      background: palette.card,
                      border: `1px solid ${palette.border}`,
                      color: palette.text,
                      borderRadius: 20,
                      fontSize: "0.82rem",
                      padding: "6px 14px",
                    }}
                    onClick={() => void send(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column" }}>
              <div style={msg.role === "user" ? bubbleUser : bubbleAssistant}>
                {msg.text}
                {msg.aiOverloaded && msg.retryQuestion && (
                  <div className="mt-3 pt-2 border-top border-secondary-subtle">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      disabled={loading}
                      onClick={() => handleRetryOverload(msg.id, msg.retryQuestion!)}
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>

              {msg.data && msg.data.length > 0 && (
                <div
                  style={{
                    ...s.panel,
                    marginTop: 8,
                    alignSelf: "flex-start",
                    maxWidth: "85%",
                    overflow: "auto",
                  }}
                >
                  <table
                    className="table table-sm table-hover mb-0"
                    style={{ fontSize: "0.82rem" }}
                  >
                    <thead>
                      <tr>
                        {Object.keys(msg.data[0]).map((key) => (
                          <th key={key} className="text-muted fw-semibold text-nowrap">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {msg.data.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="text-nowrap">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ alignSelf: "flex-start", padding: "10px 16px" }}>
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Thinking…</span>
              </div>
              <span style={{ color: palette.muted, fontSize: "0.85rem", marginLeft: 8 }}>
                Analyzing logs…
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            padding: "16px 28px",
            borderTop: `1px solid ${palette.border}`,
            background: palette.card,
            display: "flex",
            gap: 10,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="form-control"
            placeholder="Ask about your request logs…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            autoFocus
            style={{ fontSize: "0.9rem" }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !input.trim()}
            style={{ whiteSpace: "nowrap" }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
