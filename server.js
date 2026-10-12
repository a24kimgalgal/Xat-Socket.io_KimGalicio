const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000
    }
});

const PORT = 6969;
const activeRooms = new Map();

function getTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getRoomParticipants(roomId) {
    const sids = io.sockets.adapter.rooms.get(roomId);
    if (!sids) return [];
    const list = [];
    for (const sid of sids) {
        const s = io.sockets.sockets.get(sid);
        if (s && s.data.username) list.push(s.data.username);
    }
    return list;
}

function updateParticipants(roomId) {
    io.to(roomId).emit('room:participants', getRoomParticipants(roomId));
}

function leaveRoom(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const username = socket.data.username;
    socket.leave(roomId);
    socket.data.roomId = null;

    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || room.size === 0) {
        activeRooms.delete(roomId);
    } else {
        io.to(roomId).emit('chat:message', {
            type: 'system',
            text: `${username} ha sortit de la sala.`,
            time: getTime()
        });
        updateParticipants(roomId);
    }
}

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.on('room:create', ({ username }) => {
        const cleanName = (username || '').trim();
        if (!cleanName || cleanName.length > 20) {
            return socket.emit('room:error', 'El nom no és vàlid.');
        }

        if (socket.data.roomId) leaveRoom(socket);

        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        activeRooms.set(roomId, true);

        socket.data.username = cleanName;
        socket.data.roomId = roomId;
        socket.join(roomId);

        socket.emit('room:joined', { roomId, username: cleanName });
        io.to(roomId).emit('chat:message', {
            type: 'system',
            text: `Sala creada. Codi: ${roomId}`,
            time: getTime()
        });
        updateParticipants(roomId);
    });

    socket.on('room:join', ({ username, roomId }) => {
        const cleanName = (username || '').trim();
        const cleanRoom = (roomId || '').trim().toUpperCase();

        if (!cleanName || cleanName.length > 20) {
            return socket.emit('room:error', 'El nom no és vàlid.');
        }

        if (!activeRooms.has(cleanRoom)) {
            return socket.emit('room:error', `La sala "${cleanRoom}" no existeix.`);
        }

        if (socket.data.roomId) leaveRoom(socket);

        socket.data.username = cleanName;
        socket.data.roomId = cleanRoom;
        socket.join(cleanRoom);

        socket.emit('room:joined', { roomId: cleanRoom, username: cleanName });
        io.to(cleanRoom).emit('chat:message', {
            type: 'system',
            text: `${cleanName} s'ha unit a la sala.`,
            time: getTime()
        });
        updateParticipants(cleanRoom);
    });

    socket.on('room:leave', () => {
        leaveRoom(socket);
        socket.emit('room:left');
    });

    socket.on('chat:send', ({ text }) => {
        const roomId = socket.data.roomId;
        const cleanText = (text || '').trim();

        if (!roomId || !cleanText) return;

        io.to(roomId).emit('chat:message', {
            type: 'user',
            username: socket.data.username,
            text: cleanText,
            time: getTime()
        });
    });

    socket.on('disconnecting', () => {
        leaveRoom(socket);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor actiu a http://localhost:${PORT}`);
});
