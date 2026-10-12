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
