const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const text = await res.text();

  if (!res.ok) {
    let message = `API ${res.status}: ${res.statusText}`;
    let code: string | undefined;
    if (text) {
      try {
        const j = JSON.parse(text) as { code?: string; error?: string };
        if (typeof j.error === "string" && j.error.length > 0) message = j.error;
        if (typeof j.code === "string" && j.code.length > 0) code = j.code;
      } catch {
        /* use default message */
      }
    }
    throw new ApiError(message, res.status, code);
  }

  if (!text.trim()) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
