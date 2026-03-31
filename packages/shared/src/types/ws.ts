export type WsClientEvent = {
  type: "message:create";
  payload: { text: string };
};

export type WsServerEvent =
  | { type: "connected"; payload: { ok: boolean } }
  | { type: "message:created"; payload: { id: string; text: string; createdAt: string } }
  | { type: "error"; payload: { message: string } };
