// `io.sockets.sockets` only holds sockets connected to *this* worker. Under PM2
// cluster mode the matchmaking queues live in shared Redis, so the opponent you
// pop is frequently attached to a different worker — the local lookup returns
// undefined and the player is silently dropped from the queue.
//
// Addressing a socket by its id as a room and going through fetchSockets() routes
// via the Redis adapter, so it resolves on any worker. The returned RemoteSocket
// supports the join/emit calls the matchmaking code needs.
export const getSocketAcrossCluster = async (io, socketId) => {
  if (!socketId) return null;
  const local = io.sockets.sockets.get(socketId);
  if (local) return local;
  try {
    const [remote] = await io.in(socketId).fetchSockets();
    return remote || null;
  } catch (err) {
    console.error('Cluster socket lookup failed:', err.message);
    return null;
  }
};
