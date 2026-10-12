const cluster = require('node:cluster');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const { createAdapter, setupPrimary } = require('@socket.io/cluster-adapter');

// Permet activar o desactivar l'adaptador fàcilment per poder provar ambdós escenaris de la pràctica:
// 1) Sense adaptador: node server.js --no-adapter (o USE_ADAPTER=false)
// 2) Amb adaptador:    node server.js (per defecte)
const isNoAdapterFlag = process.argv.includes('--no-adapter');
const isEnvDisabled = process.env.USE_ADAPTER === 'false' || process.env.USE_ADAPTER === '0';
const useAdapter = !isNoAdapterFlag && !isEnvDisabled;

if (cluster.isPrimary) {
    console.log('================================================================');
    console.log(`[PRIMARY - PID ${process.pid}] Procés clúster principal iniciat`);
    console.log(`[PRIMARY] Adaptador Socket.IO: ${useAdapter ? 'ACTIVAT (@socket.io/cluster-adapter)' : 'DESACTIVAT (Sense adaptador)'}`);
    console.log('================================================================');

    // Creem dos processos treballadors: un per al port 3000 i l'altre per al 3001
    const ports = [3000, 3001];

    ports.forEach((port) => {
        const worker = cluster.fork({
            PORT: port.toString(),
            USE_ADAPTER: useAdapter ? 'true' : 'false'
        });
        console.log(`[PRIMARY] Worker bifurcat (PID: ${worker.process.pid}) per al port ${port}`);
    });

    if (useAdapter) {
        // Configura el canal IPC al procés primari per encaminar els missatges entre workers
        setupPrimary();
        console.log('[PRIMARY] setupPrimary() executat correctament: missatgeria IPC entre workers activada.');
    } else {
        console.log('[PRIMARY] AVÍS: Sense adaptador. Els processos treballadors tindran memòria i canals aïllats.');
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`[PRIMARY] El treballador (PID: ${worker.process.pid}) ha mort (codi: ${code}, senyal: ${signal}).`);
    });
} else {
    // Codi que executa cada procés treballador (Worker)
    const PORT = parseInt(process.env.PORT, 10) || 3000;
    const workerUseAdapter = process.env.USE_ADAPTER !== 'false' && process.env.USE_ADAPTER !== '0';

    const app = express();
    const server = http.createServer(app);

    // Opcions de Socket.IO per al worker
    // Nota de la pràctica: @socket.io/cluster-adapter no suporta connectionStateRecovery,
    // per tant no s'habilita aquí.
    const ioOptions = {};
    if (workerUseAdapter) {
        ioOptions.adapter = createAdapter();
    }

    const io = new Server(server, ioOptions);

    app.use(express.static(__dirname));

    function isValidName(value) {
        return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 20;
    }

    function isValidText(value) {
        return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 500;
    }

    io.on('connection', (socket) => {
        console.log(`[Worker PID: ${process.pid} | Port: ${PORT}] Nova connexió: ${socket.id}`);

        // Enviem al client la informació de la instància a la qual està connectat
        socket.emit('server:instance', {
            pid: process.pid,
            port: PORT,
            useAdapter: workerUseAdapter
        });

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
            console.log(`[Worker PID: ${process.pid} | Port: ${PORT}] Usuari registrat: "${cleanName}" (Socket ID: ${socket.id})`);

            socket.emit('join-success', {
                username: cleanName,
                serverPort: PORT,
                serverPid: process.pid,
                useAdapter: workerUseAdapter
            });
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
                senderPort: PORT,
                senderPid: process.pid,
                time: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                })
            };

            console.log(`[Worker PID: ${process.pid} | Port: ${PORT}] [Missatge rebut] [${message.time}] ${cleanUsername}: "${cleanText}"`);
            console.log(`[Worker PID: ${process.pid} | Port: ${PORT}] Emetent io.emit('chat:message') -> ${workerUseAdapter ? 'Broadcasting via IPC cluster adapter a tots els workers' : 'Només clients locals de port ' + PORT}...`);

            // io.emit transmet el missatge a tots els clients.
            // Si l'adaptador està actiu, @socket.io/cluster-adapter transmet el missatge als altres workers via IPC.
            // Si l'adaptador està desactivat, només els clients connectats a aquest worker el reben.
            io.emit('chat:message', message);
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Worker PID: ${process.pid} | Port: ${PORT}] Desconnectat: ${socket.id} (Raó: ${reason})`);
        });
    });

    server.listen(PORT, () => {
        console.log(`[Worker PID: ${process.pid}] Servidor escoltant a http://localhost:${PORT} (${workerUseAdapter ? 'amb @socket.io/cluster-adapter' : 'SENSE adaptador'})`);
    });
}
