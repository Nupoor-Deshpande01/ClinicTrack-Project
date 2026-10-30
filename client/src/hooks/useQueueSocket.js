import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { TOKEN_KEY } from '../api/client';

/**
 * Live queue updates over Socket.IO.
 *
 * Returns the latest broadcast snapshot (or null before the first one) and a
 * `connected` flag, so a board can show "reconnecting…" instead of silently
 * freezing. The socket authenticates with the same JWT as the REST calls.
 */
export default function useQueueSocket() {
  const [snapshot, setSnapshot] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const origin = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(origin, {
      auth: { token: localStorage.getItem(TOKEN_KEY) },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('queue:update', data => setSnapshot(data));

    return () => socket.disconnect();
  }, []);

  return { snapshot, connected };
}
