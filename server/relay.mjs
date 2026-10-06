// Relais multijoueur minimal pour Aetheria (sans dépendance).
// Chaque client publie sa "présence" (son état complet) ; le relais la diffuse aux autres.
// Usage : node server/relay.mjs [port]   puis ouvrir le jeu avec ?server=ws://hote:port
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.argv[2] || process.env.PORT || 8787);
const MAX_PRESENCE = 6000; // octets
const clients = new Map(); // id -> { socket, presence }

function frame(text) {
  const payload = Buffer.from(text);
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}

function send(c, obj) { try { c.socket.write(frame(JSON.stringify(obj))); } catch { /* client parti */ } }
function broadcast(fromId, obj) { for (const [id, c] of clients) if (id !== fromId) send(c, obj); }

function onMessage(id, text) {
  let m;
  try { m = JSON.parse(text); } catch { return; }
  if (m.t === 'p' && m.p && typeof m.p === 'object') {
    if (text.length > MAX_PRESENCE) return;
    const c = clients.get(id);
    if (!c) return;
    c.presence = m.p;
    broadcast(id, { t: 'p', id, p: m.p });
  }
}

const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); res.end(`Relais Aetheria — ${clients.size} joueur(s) connecté(s)\n`); });

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'));
  const id = crypto.randomBytes(8).toString('hex');
  const client = { socket, presence: {} };
  clients.set(id, client);
  send(client, { t: 'hello', id });
  send(client, { t: 'all', peers: Object.fromEntries([...clients].filter(([k]) => k !== id).map(([k, c]) => [k, c.presence])) });
  let buf = Buffer.alloc(0);
  let fragments = [];
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0, op = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) return socket.destroy();
      const maskLen = masked ? 4 : 0;
      if (buf.length < off + maskLen + len) return;
      const mask = masked ? buf.subarray(off, off + 4) : null;
      const data = Buffer.from(buf.subarray(off + maskLen, off + maskLen + len));
      if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + maskLen + len);
      if (op === 0x8) { socket.end(); return; }
      if (op === 0x9) { socket.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
      if (op === 0x1 || op === 0x0) {
        fragments.push(data);
        if (fin) { onMessage(id, Buffer.concat(fragments).toString('utf8')); fragments = []; }
      }
    }
  });
  const bye = () => { if (clients.delete(id)) broadcast(id, { t: 'bye', id }); };
  socket.on('close', bye);
  socket.on('error', bye);
});

server.listen(PORT, () => console.log(`Relais Aetheria à l'écoute sur ws://localhost:${PORT}`));
