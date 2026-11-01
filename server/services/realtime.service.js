/**
 * realtime.service.js — Socket.IO wiring for the live waiting-room queue.
 *
 * Kept in one place so both entry points (index.js and scripts/dev-memory.js)
 * get identical behaviour:
 *   const { attach, listen, emitQueue } = require('./services/realtime.service');
 *   attach(app); listen(port);            // index.js / dev-memory.js
 *   emitQueue(snapshot);                 // controllers, after a queue write
 *
 * Sockets authenticate with the same JWT as the REST API (handshake.auth.token),
 * so a waiting-room screen can only connect with a logged-in session.
 */
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

let httpServer = null;
let io = null;

/** Create the HTTP server + Socket.IO on top of the Express app. */
function attach(app) {
  httpServer = http.createServer(app);
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || true, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.user = { id: user.sub, name: user.name, role: user.role };
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  // Every authenticated screen joins the same room: a second display just
  // listens, the queue screen also mutates through REST.
  io.on('connection', socket => {
    socket.join('queue');
  });

  return { httpServer, io };
}

/** Start listening (promise resolves once the port is bound). */
function listen(port) {
  return new Promise(resolve => httpServer.listen(port, () => resolve(httpServer)));
}

/** Broadcast the current queue to every connected board. */
function emitQueue(snapshot) {
  if (io) io.to('queue').emit('queue:update', snapshot);
}

/** Broadcast new or changed appointments to connected dashboards. */
function emitAppointment(data) {
  if (io) io.to('queue').emit('appointment:update', data);
}

/** Stop Socket.IO + the HTTP server (used by tests). */
function close() {
  return new Promise(resolve => {
    if (!httpServer) return resolve();
    io?.close();
    httpServer.close(() => resolve());
    httpServer = null;
    io = null;
  });
}

module.exports = { attach, listen, emitQueue, emitAppointment, close };
