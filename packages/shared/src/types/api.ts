export interface Message {
  id: string;
  text: string;
  createdAt: string;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
}

export interface ReadyResponse {
  ok: boolean;
  db: "up" | "down";
}
