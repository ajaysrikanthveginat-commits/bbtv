import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import { newWatchState, changeWatch, watchPosition, type WatchState } from './src/shared/watch';

interface RoomData {
  watch: WatchState;
  roomName: string;
  resumeTokens: Map<string, string>;
  roomId: string;
  hostId: string;
  participantId: string | null;
  clients: Map<string, WebSocket>;
  cleanupTimer?: NodeJS.Timeout | null;
}

interface ClientSession {
  userId: string;
  roomId: string | null;
}

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const httpServer = http.createServer(app);

// In-memory Room State for Phase 1 (1:1 WebRTC)
// NOTE (Deployment Architecture): In a single container (like development or single-instance Cloud Run),
// this in-memory Map is authoritative. In a multi-container deployment, shared pub/sub (e.g. Redis)
// or WebSocket session affinity (sticky sessions) is required so CREATE_ROOM and JOIN_ROOM reach the same instance.
const rooms = new Map<string, RoomData>();
const socketSessions = new Map<WebSocket, ClientSession>();

// Parse JSON bodies for any REST routes
app.use(express.json());

// Basic health and room status check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'bbtv',
    version: 'watch-studio-3',
    activeRooms: rooms.size,

    timestamp: new Date().toISOString(),
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const targetId = (req.params.roomId || '').toUpperCase().trim();
  const room = rooms.get(targetId);
  if (!room) {
    res.status(404).json({ exists: false, roomId: targetId });
    return;
  }
  res.json({
    exists: true,
    roomId: room.roomId,

    hasParticipant: room.participantId !== null,
    connectedClients: room.clients.size,
  });
});

// Setup WebSocket server on the same HTTP server at path /ws
const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 64 * 1024 });

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (rooms.has(result)) {
    return generateRoomId();
  }
  return result;
}

function sendTo(ws: WebSocket, message: object): void {
  if ('type' in message && message.type === 'ROOM_JOINED') {
    const session = socketSessions.get(ws);
    const room = session?.roomId ? rooms.get(session.roomId) : undefined;
    if (room && session) {
      if (!room.resumeTokens.has(session.userId)) room.resumeTokens.set(session.userId, crypto.randomBytes(32).toString('hex'));
      message = { ...message, resumeToken: room.resumeTokens.get(session.userId) };
    }
  }
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function announceReconnection(room: RoomData, userId: string): void {
  room.clients.forEach((peer, peerId) => {
    if (peerId !== userId) sendTo(peer, {
      type: 'USER_JOINED', roomId: room.roomId, senderId: 'SERVER', userId,
      role: room.hostId === userId ? 'host' : 'participant',
    });
  });
}

function logRoom(operation: string, details: { client?: string; room?: string | null; [key: string]: any }): void {
  const timestamp = new Date().toISOString();
  console.log(`[ROOM] [${timestamp}] ${operation} client=${details.client || 'anon'} room=${details.room || 'none'}`, details);
}

function removeClientFromRoom(ws: WebSocket, session: ClientSession, explicitLeave = false): void {
  const { userId, roomId } = session;
  if (!roomId || !rooms.has(roomId)) {
    session.roomId = null;
    return;
  }

  const room = rooms.get(roomId)!;
  if (room.clients.get(userId) !== ws) return;
  room.watch = { ...room.watch, position: watchPosition(room.watch, Date.now()), playing: false, ready: [], updatedAt: Date.now(), revision: room.watch.revision + 1 };
  room.clients.delete(userId);
  session.roomId = null;

  logRoom('CLIENT_REMOVED', { client: userId, room: roomId, explicitLeave, remainingClients: room.clients.size });

  // Notify other participant
  room.clients.forEach((clientWs) => {
    sendTo(clientWs, {
      type: 'USER_LEFT',
      roomId,
      senderId: 'SERVER',
      userId,
    });
  });

  if (room.hostId === userId) {
    if (room.participantId && room.clients.has(room.participantId)) {
      // Promote participant to host
      room.hostId = room.participantId;
      room.participantId = null;
      logRoom('HOST_PROMOTED', { client: room.hostId, room: roomId });
    }
  } else if (room.participantId === userId) {
    room.participantId = null;
  }

  // If no clients remain in room:
  if (room.clients.size === 0) {
    if (explicitLeave) {
      // Explicit user action: dispose immediately
      if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
      rooms.delete(roomId);
      logRoom('ROOM_DISPOSED', { room: roomId, reason: 'explicit_leave_empty' });
    } else {
      // Temporary disconnect (refresh / network blip): give 60s grace period
      if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
      logRoom('GRACE_PERIOD_STARTED', { room: roomId, graceSeconds: 60 });
      room.cleanupTimer = setTimeout(() => {
        if (rooms.get(roomId) === room && room.clients.size === 0) {
          rooms.delete(roomId);
          logRoom('ROOM_DISPOSED', { room: roomId, reason: 'grace_period_expired' });
        }
      }, 60000);
    }
  }
}

wss.on('connection', (ws: WebSocket) => {
  const userId = crypto.randomUUID();
  const session: ClientSession = { userId, roomId: null };
  socketSessions.set(ws, session);
  logRoom('CLIENT_CONNECTED', { client: userId });

  ws.on('message', (rawMessage: string) => {
    let msg: any;
    try {
      msg = JSON.parse(rawMessage.toString());
    } catch (err) {
      console.warn(`[WS] Invalid JSON from ${userId}`);
      return;
    }

    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'PING') {
      sendTo(ws, { type: 'PONG' });
      return;
    }

    // Rejoining an existing identity requires the secret issued to that browser.
    if (msg.type === 'JOIN_ROOM' || msg.type === 'RECONNECT_ROOM') {
      const target = typeof msg.roomId === 'string' ? rooms.get(msg.roomId.toUpperCase().trim()) : undefined;
      const expected = target?.resumeTokens.get(msg.senderId);
      if (expected && target?.clients.get(msg.senderId) !== ws && msg.resumeToken !== expected) {
        sendTo(ws, { type: 'ROOM_ERROR', roomId: target?.roomId, senderId: 'SERVER', message: 'This session belongs to another browser. Open a fresh tab to join as a guest.' });
        return;
      }
    }
    if (msg.senderId !== undefined && (typeof msg.senderId !== 'string' || msg.senderId.length > 100)) return;
    if (msg.roomId !== undefined && typeof msg.roomId !== 'string') return;
    // Allow client to supply a persistent client identifier if provided
    const clientSpecifiedId = msg.senderId || userId;
    if (session.roomId && session.userId !== clientSpecifiedId) return;
    session.userId = clientSpecifiedId;

    switch (msg.type) {
      case 'CREATE_ROOM': {
        logRoom('CREATE_REQUEST', { client: clientSpecifiedId, requestedRoom: null });

        // If client was previously associated with another room, leave it cleanly first
        if (session.roomId) {
          removeClientFromRoom(ws, session, true);
        }

        const roomId = generateRoomId();
        const room: RoomData = {
          roomId,
          hostId: clientSpecifiedId,
          participantId: null,
          clients: new Map([[clientSpecifiedId, ws]]),
          cleanupTimer: null,
          resumeTokens: new Map(),
          roomName: typeof msg.roomName === 'string' ? msg.roomName.trim().slice(0,60) || 'Movie night' : 'Movie night',
          watch: newWatchState(msg.allowControl !== false),
        };
        rooms.set(roomId, room);
        session.roomId = roomId;

        logRoom('ROOM_CREATED', { client: clientSpecifiedId, room: roomId });
        logRoom('CLIENT_STATE', { client: clientSpecifiedId, room: roomId, role: 'host' });

        sendTo(ws, {
          type: 'ROOM_JOINED',
          roomId,
          senderId: 'SERVER',
          role: 'host',
          remoteUserId: null,
        });
        break;
      }

      case 'JOIN_ROOM': {
        const targetRoomId = (msg.roomId || '').toUpperCase().trim();
        logRoom('JOIN_REQUEST', { client: clientSpecifiedId, room: targetRoomId });

        if (!targetRoomId) {
          sendTo(ws, {
            type: 'ROOM_ERROR',
            roomId: '',
            senderId: 'SERVER',
            message: 'Room code cannot be empty.',
          });
          return;
        }

        // If client is already in a different room, leave it
        if (session.roomId && session.roomId !== targetRoomId) {
          removeClientFromRoom(ws, session, true);
        }

        const room = rooms.get(targetRoomId);

        if (!room) {
          logRoom('ROOM_ERROR', { client: clientSpecifiedId, room: targetRoomId, error: 'NOT_FOUND' });
          sendTo(ws, {
            type: 'ROOM_ERROR',
            roomId: targetRoomId,
            senderId: 'SERVER',
            message: `Room "${targetRoomId}" was not found. Please verify the code.`,
          });
          return;
        }

        // Cancel any pending grace period disposal timer since a client is active
        if (room.cleanupTimer) {
          clearTimeout(room.cleanupTimer);
          room.cleanupTimer = null;
          logRoom('GRACE_PERIOD_CANCELLED', { room: targetRoomId, client: clientSpecifiedId });
        }

        // Case A: The host is re-joining / refreshing into their own room
        if (room.hostId === clientSpecifiedId) {
          room.clients.set(clientSpecifiedId, ws);
          session.roomId = targetRoomId;
          logRoom('HOST_REJOINED', { client: clientSpecifiedId, room: targetRoomId });
          announceReconnection(room, clientSpecifiedId);

          sendTo(ws, {
            type: 'ROOM_JOINED',
            roomId: targetRoomId,
            senderId: 'SERVER',
            role: 'host',
            remoteUserId: room.participantId,
          });
          return;
        }

        // Case B: Existing participant re-joining
        if (room.participantId === clientSpecifiedId) {
          room.clients.set(clientSpecifiedId, ws);
          session.roomId = targetRoomId;
          logRoom('PARTICIPANT_REJOINED', { client: clientSpecifiedId, room: targetRoomId });
          announceReconnection(room, clientSpecifiedId);

          sendTo(ws, {
            type: 'ROOM_JOINED',
            roomId: targetRoomId,
            senderId: 'SERVER',
            role: 'participant',
            remoteUserId: room.hostId,
          });
          return;
        }

        // Case C: New participant joining 1:1 room
        if (room.participantId && room.participantId !== clientSpecifiedId && room.clients.size >= 2) {
          logRoom('ROOM_ERROR', { client: clientSpecifiedId, room: targetRoomId, error: 'ROOM_FULL' });
          sendTo(ws, {
            type: 'ROOM_ERROR',
            roomId: targetRoomId,
            senderId: 'SERVER',
            message: `Room "${targetRoomId}" is already full (1:1 testing mode).`,
          });
          return;
        }

        room.watch = { ...room.watch, position: watchPosition(room.watch, Date.now()), playing: false, ready: [], updatedAt: Date.now(), revision: room.watch.revision + 1 };
        // Accept as participant
        room.participantId = clientSpecifiedId;
        room.clients.set(clientSpecifiedId, ws);
        session.roomId = targetRoomId;

        logRoom('JOIN_SUCCESS', { client: clientSpecifiedId, room: targetRoomId, role: 'participant' });
        logRoom('CLIENT_STATE', { client: clientSpecifiedId, room: targetRoomId, role: 'participant' });

        // Notify the joining participant
        sendTo(ws, {
          type: 'ROOM_JOINED',
          roomId: targetRoomId,
          senderId: 'SERVER',
          role: 'participant',
          remoteUserId: room.hostId,
        });

        // Notify the host that participant joined
        const hostSocket = room.clients.get(room.hostId);
        if (hostSocket) {
          sendTo(hostSocket, {
            type: 'USER_JOINED',
            roomId: targetRoomId,
            senderId: 'SERVER',
            userId: clientSpecifiedId,
            role: 'participant',
          });
        }
        break;
      }

      case 'RECONNECT_ROOM': {
        const targetRoomId = (msg.roomId || '').toUpperCase().trim();
        logRoom('RECONNECT_REQUEST', { client: clientSpecifiedId, room: targetRoomId });

        const room = rooms.get(targetRoomId);
        if (!room) {
          logRoom('RECONNECT_FAILED', { client: clientSpecifiedId, room: targetRoomId, error: 'NOT_FOUND' });
          sendTo(ws, {
            type: 'ROOM_ERROR',
            roomId: targetRoomId,
            senderId: 'SERVER',
            message: `Active room "${targetRoomId}" is no longer active.`,
          });
          return;
        }

        if (room.cleanupTimer) {
          clearTimeout(room.cleanupTimer);
          room.cleanupTimer = null;
        }

        if (room.resumeTokens.has(clientSpecifiedId) && room.hostId !== clientSpecifiedId && !room.participantId && room.clients.size < 2) {
          room.participantId = clientSpecifiedId;
        }
        if (room.hostId !== clientSpecifiedId && room.participantId !== clientSpecifiedId) {
          sendTo(ws, { type: 'ROOM_ERROR', roomId: targetRoomId, senderId: 'SERVER', message: 'Please leave and rejoin this room using its code.' });
          return;
        }
        const role = room.hostId === clientSpecifiedId ? 'host' : 'participant';
        if (role === 'host') {
          room.hostId = clientSpecifiedId;
        } else {
          room.participantId = clientSpecifiedId;
        }

        room.clients.set(clientSpecifiedId, ws);
        session.roomId = targetRoomId;

        const remoteId = role === 'host' ? room.participantId : room.hostId;

        logRoom('RECONNECT_SUCCESS', { client: clientSpecifiedId, room: targetRoomId, role, remoteId });
        announceReconnection(room, clientSpecifiedId);
        sendTo(ws, {
          type: 'ROOM_JOINED',
          roomId: targetRoomId,
          senderId: 'SERVER',
          role,
          remoteUserId: remoteId,
        });
        break;
      }

      case 'LEAVE_ROOM':
      case 'USER_LEFT': {
        logRoom('LEAVE_ROOM', { client: clientSpecifiedId, room: session.roomId });
        removeClientFromRoom(ws, session, true);
        break;
      }

      case 'WATCH_GET':
      case 'WATCH_ACTION': {
        const room = session.roomId ? rooms.get(session.roomId) : undefined;
        if (!room || room.clients.get(session.userId) !== ws) return;
        if (msg.type === 'WATCH_ACTION') {
          try { room.watch = changeWatch(room.watch, msg.action, session.userId, room.hostId, [...room.clients.keys()], Date.now()); }
          catch (error) { sendTo(ws, { type: 'WATCH_ERROR', roomId: room.roomId, senderId: 'SERVER', requestId: msg.requestId, message: error instanceof Error ? error.message : 'Invalid watch action.' }); return; }
        }
        const payload = { type: 'WATCH_STATE', roomId: room.roomId, senderId: 'SERVER', requestId: typeof msg.requestId === 'string' ? msg.requestId.slice(0,100) : undefined, state: room.watch, roomName: room.roomName, hostId: room.hostId, members: [...room.clients.keys()], serverTime: Date.now(), requestTime: msg.type === 'WATCH_GET' ? msg.requestTime : undefined };
        if (msg.type === 'WATCH_GET') sendTo(ws, payload);
        else room.clients.forEach(client => sendTo(client, payload));
        break;
      }

      case 'CHAT_MESSAGE': {
        const targetRoomId = (msg.roomId || session.roomId || '').toUpperCase().trim();
        const chatText = typeof msg.message === 'string' ? msg.message.trim() : '';

        console.log(`[CHAT RECEIVED]\nroom=${targetRoomId}\nsender=${clientSpecifiedId}`);

        // 1. Validate room exists
        const room = rooms.get(targetRoomId);
        if (!room) {
          console.warn(`[CHAT REJECTED] Room "${targetRoomId}" does not exist`);
          sendTo(ws, {
            type: 'ROOM_ERROR',
            roomId: targetRoomId,
            senderId: 'SERVER',
            message: `Cannot send chat: room "${targetRoomId}" does not exist.`,
          });
          return;
        }

        // 2. Validate sender belongs to room
        if (room.clients.get(clientSpecifiedId) !== ws) {
          console.warn(`[CHAT REJECTED] Sender ${clientSpecifiedId} is not in room ${targetRoomId}`);
          sendTo(ws, {
            type: 'ROOM_ERROR',
            roomId: targetRoomId,
            senderId: 'SERVER',
            message: `Cannot send chat: not registered in room "${targetRoomId}".`,
          });
          return;
        }

        // 3. Validate message is valid
        if (!chatText || chatText.length > 2000) {
          console.warn(`[CHAT REJECTED] Empty chat message from ${clientSpecifiedId}`);
          return;
        }

        const members = Array.from(room.clients.keys());
        console.log(`[CHAT ROOM MEMBERS]\nroom=${targetRoomId}\nmembers=[${members.join(', ')}]`);

        const chatPayload = {
          type: 'CHAT_MESSAGE',
          roomId: targetRoomId,
          senderId: clientSpecifiedId,
          senderName: typeof msg.senderName === 'string' ? msg.senderName.trim().slice(0, 40) || 'Friend' : (clientSpecifiedId === room.hostId ? 'Host' : 'Friend'),
          message: chatText,
          id: typeof msg.id === 'string' ? msg.id.slice(0, 100) : crypto.randomUUID(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
        };

        // Broadcast to every OTHER client in the SAME ROOM
        room.clients.forEach((clientWs, memberId) => {
          if (memberId !== clientSpecifiedId) {
            console.log(`[CHAT BROADCAST]\ntarget=${memberId}`);
            sendTo(clientWs, chatPayload);
          }
        });
        break;
      }

      case 'OFFER':
      case 'ANSWER':
      case 'ICE_CANDIDATE':
      case 'SCREEN_SHARE_STARTED':
      case 'SCREEN_SHARE_STOPPED': {
        const currentRoomId = (session.roomId || msg.roomId || '').toUpperCase().trim();
        if (!currentRoomId) {
          console.warn(`[Signaling] Unassociated client ${clientSpecifiedId} tried to signal ${msg.type}`);
          return;
        }

        const room = rooms.get(currentRoomId);
        if (!room) {
          console.warn(`[Signaling] Room ${currentRoomId} not found for signal ${msg.type} from ${clientSpecifiedId}`);
          return;
        }

        if (room.clients.get(session.userId) !== ws) return;
        if ((msg.type === 'SCREEN_SHARE_STARTED' || msg.type === 'SCREEN_SHARE_STOPPED') && room.hostId !== clientSpecifiedId) return;
        if (msg.type === 'SCREEN_SHARE_STARTED') {
          room.watch = { ...room.watch, position: watchPosition(room.watch, Date.now()), playing: false, ready: [], updatedAt: Date.now(), revision: room.watch.revision + 1 };
        }
        const targetId = msg.targetId;
        console.log(`[WEBRTC SIGNAL] type=${msg.type} room=${currentRoomId} from=${clientSpecifiedId} target=${targetId || 'broadcast'}`);

        if (targetId && room.clients.has(targetId)) {
          const targetWs = room.clients.get(targetId)!;
          sendTo(targetWs, {
            ...msg,
            senderId: clientSpecifiedId,
            roomId: currentRoomId,
          });
        } else {
          room.clients.forEach((clientWs, cid) => {
            if (cid !== clientSpecifiedId) {
              sendTo(clientWs, {
                ...msg,
                senderId: clientSpecifiedId,
                roomId: currentRoomId,
              });
            }
          });
        }
        break;
      }

      default:
        console.warn(`[Signaling] Unhandled message type: ${msg.type}`);
    }
  });

  ws.on('close', () => {
    logRoom('SOCKET_CLOSE', { client: userId, room: session.roomId });
    removeClientFromRoom(ws, session, false);
    socketSessions.delete(ws);
  });
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

start();
