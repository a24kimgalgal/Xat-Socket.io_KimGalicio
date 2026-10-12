const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cluster = require('node:cluster');
const { createAdapter, setupPrimary } = require('@socket.io/cluster-adapter');

if (cluster.isPrimary) {
    cluster.fork({ PORT: 3000 });
    cluster.fork({ PORT: 3001 });
    return setupPrimary();
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    adapter: createAdapter()
});

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log(`[PID ${process.pid} | Port ${process.env.PORT}] Connexió: ${socket.id}`);

    socket.on('join-chat', (payload = {}) => {
        const name = (payload.name || '').trim();
        if (!name || name.length > 20) {
            return socket.emit('join-error', { message: 'Nom no vàlid.' });
        }
        socket.data.username = name;
        socket.emit('join-success', { username: name });
    });

    socket.on('chat:send', (payload = {}) => {
        const username = socket.data.username || (payload.username || '').trim();
        const text = (payload.text || '').trim();

        if (!username || !text || text.length > 500) {
            return socket.emit('chat:error', { message: 'Missatge no vàlid.' });
        }

        const message = {
            username,
            text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        console.log(`[PID ${process.pid} | Port ${process.env.PORT}] ${username}: ${text}`);
        io.emit('chat:message', message);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor escoltant a http://localhost:${PORT} (PID ${process.pid})`);
});
