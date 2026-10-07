const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 6969;

function isValidName(value) {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 20;
}

function isValidText(value) {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 500;
}

app.use(express.static(__dirname));

io.on('connection', (socket) => {
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
        socket.emit('join-success', { username: cleanName });
    });

    socket.on('chat:send', (payload = {}) => {
        const username = typeof payload?.username === 'string' ? payload.username : typeof socket.data.username === 'string' ? socket.data.username : '';
        const text = typeof payload?.text === 'string' ? payload.text : '';
        const cleanUsername = username.trim();
        const cleanText = text.trim();

        if (!isValidName(cleanUsername) || !isValidText(cleanText)) {
            socket.emit('chat:error', {
                message: 'El nom o el missatge no són vàlids.'
            });
            return;
        }

        const message = {
            username: cleanUsername,
            text: cleanText,
            time: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            })
        };

        io.emit('chat:message', message);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor del xat actiu a http://localhost:${PORT}`);
});
