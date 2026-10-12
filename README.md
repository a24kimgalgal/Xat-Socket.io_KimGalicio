# Xat en Temps Real amb Socket.IO

Aquest projecte és una aplicació de xat en temps real desenvolupada amb **Node.js**, **Express**, **Socket.IO**, HTML5 i Vanilla CSS. Permet la comunicació bidireccional instantània entre múltiples usuaris sense recarregar la pàgina ni realitzar peticions periòdiques (polling).

---

## 🚀 Instruccions d'Instal·lació i Execució

### 1. Prerequisits
- Tenir instal·lat **Node.js** (v16 o superior).

### 2. Instal·lació de dependències
Executa la següent comanda a l'arrel del projecte per instal·lar les dependències registrades a `package.json`:
```bash
npm install
```

### 3. Arrencar el servidor
Per iniciar el servidor Node:
```bash
npm start
```
*(També es pot executar directament amb `node server.js`)*

### 4. Accedir a l'aplicació
Obre una o més pestanyes del navegador i accedeix a:
```
http://localhost:6969
```

---

## 📋 Respostes a les Preguntes Teòriques

### 1. Quin esdeveniment envia el client i quin rep?
* **Envia (client → servidor):**
  * `join-chat`: Envia el nom/àlies de l'usuari triat per a la sessió.
  * `chat:send`: Envia l'objecte amb el nom de l'usuari i el text del missatge.
* **Rep (servidor → client):**
  * `join-success`: Confirma que el nom és vàlid i permet entrar al xat.
  * `join-error`: Notifica que el nom no compleix els criteris de validació.
  * `chat:message`: Rep el missatge validat i difós pel servidor (amb `id`, `username`, `text` i `time`).
  * `chat:error`: Notifica un error si el missatge enviat no supera les validacions del servidor.

### 2. Quina diferència hi ha, al servidor, entre `socket.emit()` i `io.emit()`?
* **`socket.emit('event', data)`**: Envia l'esdeveniment exclusivament al client connectat a través d'aquell sòcol específic (comunicació privada 1 a 1 entre client i servidor).
* **`io.emit('event', data)`**: Realitza una difusió global (*broadcast*) a **tots** els clients connectats actualment a la instància del servidor de Socket.IO.

### 3. Per què no és suficient validar les dades només al formulari?
Perquè les validacions del costat del client (HTML5, JavaScript al navegador) s'executen en un entorn que està completament sota el control de l'usuari. Qualsevol persona pot saltar-se-les desactivant JavaScript, modificant els atributs del DOM des de les eines de desenvolupador (DevTools) o enviant esdeveniments de WebSocket directament mitjançant scripts o consoles.  
La validació al servidor és imprescindible perquè el servidor és l'únic entorn de confiança que pot garantir la seguretat, integritat i compliment de límits (longitud màxima, camps obligatoris, caràcters permesos) abans de processar les dades.

---

## ⚡ Ampliacions Realitzades

### Ampliació 1: Desconnexions i recuperació d'estat (`connectionStateRecovery`)
S'ha configurat Socket.IO al servidor amb l'opció `connectionStateRecovery` amb una finestra temporal de recuperació de 2 minuts (120.000 ms):
```javascript
const io = new Server(server, {
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000
    }
});
```

Al client:
* S'ha configurat `reconnectionDelay: 10000`, `reconnectionDelayMax: 10000` i `randomizationFactor: 0`.
* S'ha afegit un botó **"Simular tall transport"** que crida exactament a `socket.io.engine.close()`, simulant una caiguda de transport sense desconnexió voluntària.
* Es verifica estrictament el valor booleà de **`socket.recovered`** en reconnectar:
  * Si `socket.recovered === true`: Mostra clarament que la sessió i l'estat s'han recuperat amb èxit.
  * Si `socket.recovered === false`: Mostra que es tracta d'una sessió nova o que no s'ha pogut recuperar l'estat.

### Taula comparativa de recuperació de connexió

| Escenari de prova | Comportament dels missatges durant el tall | Valor de `socket.recovered` | Explicació tècnica |
|---|---|---|---|
| **Sense recuperació activada** | Els missatges enviats per altres clients mentre la pestanya estava desconnectada **es perden** per a aquest client. | `undefined` / `false` | El servidor no reté un buffer de paquets per a aquesta connexió; en tornar, comença una sessió neta sense historial intermedi. |
| **Amb `connectionStateRecovery` activat** | Els missatges enviats durant la caiguda **es recuperen automàticament** en restablir el transport. | `true` | L'adaptador de Socket.IO emmagatzema a la memòria temporal els esdeveniments pendents de la sessió durant la finestra de 2 minuts i els reenvia al restablir el transport. |
| **Després de reiniciar el servidor Node** | Els missatges enviats abans o durant el reinici **es perden** i no es reben. | `false` | Com que s'utilitza l'adaptador en memòria per defecte (*InMemoryAdapter*), la memòria RAM del procés Node s'esborra en reiniciar-se. Es crea una nova instància i es descarten les sessions prèvies. |

---

### Ampliació 3: Escalat horitzontal (`node:cluster` i `@socket.io/cluster-adapter`)

Aquesta branca (`escalat-horitzontal`) implementa l'escalat horitzontal utilitzant el mòdul natiu `node:cluster` de Node.js i l'adaptador de Socket.IO `@socket.io/cluster-adapter`, tal com s'especifica al Pas 9 del tutorial oficial de Socket.IO.

#### 1. Configuració de processos treballadors
El procés primari (`cluster.isPrimary`) bifurca dos processos treballadors (*workers*):
- **Treballador 1**: Escolta al port `3000` (PID independent).
- **Treballador 2**: Escolta al port `3001` (PID independent).

Cada pestanya del navegador es connecta directament a un port (`http://localhost:3000` o `http://localhost:3001`), sense requerir cap balancejador de càrrega intermedi.

#### 2. Com provar els dos escenaris

##### A. Fase 1: Prova SENSE adaptador (processos aïllats)
Si a `server.js` es treu la configuració de `@socket.io/cluster-adapter` (sense cridar `setupPrimary()` ni passar `adapter: createAdapter()`):
1. Executa:
   ```bash
   node server.js
   ```
2. Obre una pestanya a `http://localhost:3000` i una altra a `http://localhost:3001`.
3. Envia un missatge des del port 3000.
4. **Resultat**: El missatge **no arriba** a la pestanya del port 3001. Al terminal es veu que només el worker del port 3000 processa el missatge, demostrant que cada procés té la memòria aïllada.

##### B. Fase 2: Prova AMB adaptador (`@socket.io/cluster-adapter`)
Amb el codi del pas 9 configurat amb `setupPrimary()` i `adapter: createAdapter()`:
1. Executa:
   ```bash
   node server.js
   ```
2. Obre les dues pestanyes (`http://localhost:3000` i `http://localhost:3001`).
3. Envia un missatge des del port 3000.
4. **Resultat**: El missatge **arriba immediatament** a la pestanya del port 3001. Al terminal es pot veure com cada pestanya està gestionada per un PID i port diferent, però `@socket.io/cluster-adapter` difon l'esdeveniment entre tots dos processos via IPC.

---

#### 3. Preguntes Teòriques de l'Ampliació 3

##### Per què dos processos Node.js no comparteixen automàticament la memòria?
Node.js s'executa sobre el motor JavaScript V8 en un model d'un sol fil d'execució (*single thread*) per procés. Quan utilitzem `node:cluster`, es creen processos fills independents mitjançant crides al sistema operatiu (`fork`). Cada procés té el seu propi espai d'adreçament de memòria virtual totalment protegit i aïllat pel kernel del sistema operatiu. Per tant, els objectes, variables, connexions de sòcols i col·leccions en memòria (com els usuaris o les sales) que existeixen en el procés del port 3000 són completament inaccessibles per al procés del port 3001.

##### Què aporta l'adaptador (`@socket.io/cluster-adapter`)?
Per defecte, Socket.IO emmagatzema les connexions i sales a la memòria del procés (`InMemoryAdapter`). En un entorn de clúster, un missatge emès amb `io.emit()` o `io.to().emit()` només arribaria als clients connectats a aquell procés concret.  
`@socket.io/cluster-adapter` resol aquest problema aprofitant el canal de comunicació entre processos (**IPC** - *Inter-Process Communication*) natiu de Node.js:
1. Al procés primari s'inicialitza `setupPrimary()`.
2. A cada procés fill s'assigna `createAdapter()`.
3. Quan qualsevol treballador fa un `io.emit()`, l'adaptador intercepta el paquet i l'envia via IPC al procés primari, el qual el retransmet immediatament a tots els altres treballadors. Cada treballador rep el paquet i el transmet als seus respectius clients connectats.

##### Per què no cal desplegar un balancejador en aquesta pràctica?
Un balancejador de càrrega (com Nginx o HAProxy) és necessari quan hi ha múltiples servidors escoltant darrere d'una única adreça pública/port (per exemple el port 80 o 443), requerint *sticky sessions* perquè les peticions d'un mateix client vagin sempre al mateix procés.  
En aquesta pràctica, assignem manualment ports diferents a cada procés (`3000` i `3001`). Com que cada pestanya del navegador s'obre directament contra el port del procés desitjat (`http://localhost:3000` o `http://localhost:3001`), la connexió ja està dirigida manualment i no es requereix cap encaminament intermedi.

##### Quina és la relació entre `@socket.io/cluster-adapter` i `connectionStateRecovery`?
Tal com s'indica a la documentació oficial de Socket.IO, `@socket.io/cluster-adapter` **no té suport actualment per a `connectionStateRecovery`**. Aquesta funcionalitat requereix un magatzem compartit capaç de guardar un buffer persistent dels missatges transmesos durant la desconnexió (com ara l'adaptador basat en Redis Streams o MongoDB). Per aquesta raó, l'ampliació de recuperació de connexió i l'ampliació de difusió multi-procés s'han avaluat de manera independent.

