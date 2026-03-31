const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:4000";

export function createSocket(
  onMessage: (data: unknown) => void,
  onOpen?: () => void,
  onClose?: () => void,
): WebSocket {
  const socket = new WebSocket(WS_URL);

  socket.addEventListener("message", (e) => {
    try {
      onMessage(JSON.parse(e.data as string));
    } catch {
      console.error("Failed to parse WS message");
    }
  });

  if (onOpen) socket.addEventListener("open", onOpen);
  if (onClose) socket.addEventListener("close", onClose);

  return socket;
}
