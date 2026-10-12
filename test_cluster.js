const { io } = require('socket.io-client');

async function runTest() {
    console.log('====================================================');
    console.log('🧪 INICIANT PROVA DE CLÚSTER I ESCALAT HORITZONTAL');
    console.log('====================================================');

    console.log('Connectant Client A a http://localhost:3000 ...');
    const clientA = io('http://localhost:3000', {
        transports: ['websocket', 'polling'],
        reconnection: false
    });

    console.log('Connectant Client B a http://localhost:3001 ...');
    const clientB = io('http://localhost:3001', {
        transports: ['websocket', 'polling'],
        reconnection: false
    });

    let instanceA = null;
    let instanceB = null;

    clientA.on('server:instance', (info) => {
        instanceA = info;
        console.log(`[Client A] Connectat a Port ${info.port} (Procés PID: ${info.pid}, Adaptador: ${info.useAdapter})`);
    });

    clientB.on('server:instance', (info) => {
        instanceB = info;
        console.log(`[Client B] Connectat a Port ${info.port} (Procés PID: ${info.pid}, Adaptador: ${info.useAdapter})`);
    });

    await Promise.all([
        new Promise((resolve, reject) => {
            clientA.on('connect', () => {
                console.log(`✓ Client A connectat amb èxit (Socket ID: ${clientA.id})`);
                clientA.emit('join-chat', { name: 'Usuari_Port3000' });
                resolve();
            });
            clientA.on('connect_error', (err) => reject(new Error(`Error connectant a port 3000: ${err.message}`)));
        }),
        new Promise((resolve, reject) => {
            clientB.on('connect', () => {
                console.log(`✓ Client B connectat amb èxit (Socket ID: ${clientB.id})`);
                clientB.emit('join-chat', { name: 'Usuari_Port3001' });
                resolve();
            });
            clientB.on('connect_error', (err) => reject(new Error(`Error connectant a port 3001: ${err.message}`)));
        })
    ]);

    // Donem un petit marge perquè s'estableixin les instàncies
    await new Promise(r => setTimeout(r, 600));

    console.log('\n--- PROVA 1: Enviament des de Client A (Port 3000) cap a Client B (Port 3001) ---');
    const testMsgA = 'Hola des del Port 3000 - ' + Date.now();

    const receivedByB = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.log('❌ TEMPS ESGOTAT: Client B (Port 3001) NO ha rebut el missatge de Client A (Port 3000).');
            resolve(false);
        }, 3000);

        clientB.on('chat:message', (msg) => {
            if (msg.text === testMsgA) {
                clearTimeout(timeout);
                console.log(`✅ ÈXIT: Client B (Port 3001) ha rebut el missatge de Client A!`);
                console.log(`   Detalls: [De: ${msg.username} | Port: ${msg.senderPort} | PID: ${msg.senderPid}] "${msg.text}"`);
                resolve(true);
            }
        });

        console.log(`Client A (Port 3000) emetent: "${testMsgA}"...`);
        clientA.emit('chat:send', { text: testMsgA });
    });

    console.log('\n--- PROVA 2: Enviament des de Client B (Port 3001) cap a Client A (Port 3000) ---');
    const testMsgB = 'Resposta des del Port 3001 - ' + Date.now();

    const receivedByA = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.log('❌ TEMPS ESGOTAT: Client A (Port 3000) NO ha rebut el missatge de Client B (Port 3001).');
            resolve(false);
        }, 3000);

        clientA.on('chat:message', (msg) => {
            if (msg.text === testMsgB) {
                clearTimeout(timeout);
                console.log(`✅ ÈXIT: Client A (Port 3000) ha rebut el missatge de Client B!`);
                console.log(`   Detalls: [De: ${msg.username} | Port: ${msg.senderPort} | PID: ${msg.senderPid}] "${msg.text}"`);
                resolve(true);
            }
        });

        console.log(`Client B (Port 3001) emetent: "${testMsgB}"...`);
        clientB.emit('chat:send', { text: testMsgB });
    });

    console.log('\n====================================================');
    console.log('📊 RESUM DE LA PROVA:');
    if (receivedByB && receivedByA) {
        console.log('🎉 RESULTAT: @socket.io/cluster-adapter FUNCIONA CORRECTAMENT!');
        console.log('   Els missatges s\'han difós bidireccionalment entre processos treballadors independents.');
    } else {
        console.log('ℹ️ RESULTAT: Difusió inter-procés NO detectada.');
        console.log('   Això és esperat si esteu provant el mode SENSE adaptador (node server.js --no-adapter),');
        console.log('   demostrant que cada procés treballador manté la memòria i sockets completament aïllats.');
    }
    console.log('====================================================\n');

    clientA.disconnect();
    clientB.disconnect();
    process.exit(0);
}

runTest().catch((err) => {
    console.error('Error executant la prova:', err.message);
    process.exit(1);
});
