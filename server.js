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

function isValidName(value) {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 20;
}

function isValidText(value) {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 500;
}

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    if (socket.recovered) {
        console.log(`[Connexió recuperada] Socket ID: ${socket.id} (Usuari: ${socket.data.username || 'Anònim'})`);
    } else {
        console.log(`[Nova connexió] Socket ID: ${socket.id}`);
    }

    socket.on('join-chat', (payload = {}) => {
        const name = typeof payload?.name === 'string' ? payload.name : '';
        const cleanName = name.trim();

        if (!isValidName(cleanName)) {
            socket.emit('join-error', {
                message: 'El nom no és vàlid. Ha de tenir entre 1 i 20 caràcters.'
            });
            return;
        }

        socket.data.username = cleanName;
        console.log(`Usuari registrat: ${cleanName} (${socket.id})`);
        socket.emit('join-success', { username: cleanName });
    });

    socket.on('chat:send', (payload = {}) => {
        const username = typeof payload?.username === 'string' && payload.username.trim()
            ? payload.username.trim()
            : (typeof socket.data.username === 'string' ? socket.data.username : '');
        const text = typeof payload?.text === 'string' ? payload.text : '';
        const cleanUsername = username.trim();
        const cleanText = text.trim();

        if (!isValidName(cleanUsername)) {
            socket.emit('chat:error', {
                message: 'Nom d’usuari invàlid o no registrat.'
            });
            return;
        }

        if (!isValidText(cleanText)) {
            socket.emit('chat:error', {
                message: 'El missatge no pot estar buit ni superar els 500 caràcters.'
            });
            return;
        }

        const message = {
            id: Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            username: cleanUsername,
            text: cleanText,
            time: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            })
        };

        console.log(`[Missatge] [${message.time}] ${cleanUsername}: ${cleanText}`);

        io.emit('chat:message', message);
    });

    socket.on('disconnect', (reason) => {
        console.log(`[Desconnectat] Socket ID: ${socket.id} - Raó: ${reason}`);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor del xat actiu a http://localhost:${PORT}`);
});
