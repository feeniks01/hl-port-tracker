import type {
  HyperliquidAllMidsMessage,
  HyperliquidSubscriptionResponseMessage,
} from "../types/api";

const WS_ENDPOINT = "wss://api.hyperliquid.xyz/ws";
const ALL_MIDS_SUBSCRIPTION = {
  method: "subscribe",
  subscription: { type: "allMids" },
};

interface PriceStreamCallbacks {
  onMids: (mids: Record<string, string>) => void;
  onStatusChange: (status: "connecting" | "connected" | "reconnecting" | "disconnected") => void;
  onError: (message: string) => void;
}

export function createPriceStream(callbacks: PriceStreamCallbacks) {
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let staleTimer: number | null = null;
  let reconnectAttempt = 0;
  let closedByClient = false;
  let lastMessageAt = 0;

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const clearStaleTimer = () => {
    if (staleTimer !== null) {
      window.clearTimeout(staleTimer);
      staleTimer = null;
    }
  };

  const scheduleStaleCheck = (currentSocket: WebSocket) => {
    clearStaleTimer();

    staleTimer = window.setTimeout(() => {
      if (closedByClient || socket !== currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
        return;
      }

      if (Date.now() - lastMessageAt < 30_000) {
        scheduleStaleCheck(currentSocket);
        return;
      }

      callbacks.onError("The Hyperliquid price stream went stale. Reconnecting.");
      currentSocket.close();
    }, 30_000);
  };

  const connect = () => {
    callbacks.onStatusChange(reconnectAttempt === 0 ? "connecting" : "reconnecting");
    const currentSocket = new WebSocket(WS_ENDPOINT);
    socket = currentSocket;

    currentSocket.addEventListener("open", () => {
      if (closedByClient) {
        currentSocket.close();
        return;
      }

      reconnectAttempt = 0;
      lastMessageAt = Date.now();
      callbacks.onStatusChange("connected");
      currentSocket.send(JSON.stringify(ALL_MIDS_SUBSCRIPTION));
      scheduleStaleCheck(currentSocket);
    });

    currentSocket.addEventListener("message", (event) => {
      if (closedByClient) {
        return;
      }

      lastMessageAt = Date.now();
      scheduleStaleCheck(currentSocket);

      const message = JSON.parse(event.data) as
        | HyperliquidAllMidsMessage
        | HyperliquidSubscriptionResponseMessage;

      if (message.channel === "allMids") {
        callbacks.onMids(message.data.mids);
      }
    });

    currentSocket.addEventListener("error", () => {
      if (closedByClient) {
        return;
      }

      callbacks.onError("The Hyperliquid price stream encountered an error.");
    });

    currentSocket.addEventListener("close", () => {
      clearStaleTimer();

      if (socket === currentSocket) {
        socket = null;
      }

      if (closedByClient) {
        callbacks.onStatusChange("disconnected");
        return;
      }

      reconnectAttempt += 1;
      callbacks.onStatusChange("reconnecting");

      // Hyperliquid's websocket docs call out periodic disconnects, so reconnect
      // deterministically with capped backoff and let the snapshot refill state.
      const timeout = Math.min(1000 * 2 ** (reconnectAttempt - 1), 8000);
      clearReconnectTimer();
      reconnectTimer = window.setTimeout(connect, timeout);
    });
  };

  connect();

  return {
    disconnect() {
      closedByClient = true;
      clearReconnectTimer();
      clearStaleTimer();

      if (!socket) {
        return;
      }

      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
        return;
      }

      if (socket.readyState === WebSocket.CONNECTING) {
        return;
      }

      socket = null;
    },
  };
}
