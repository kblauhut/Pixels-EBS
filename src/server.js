const CANVAS_X = 300;
const CANVAS_Y = 450;
const COOLDOWN_MS = 10000;

const WebSocket = require('ws');
const jwt = require('./util/jwt_helper');
const db = require('./util/db_helper')
const logic = require('./util/logic')

db.createTables();

const wss = new WebSocket.Server({ port: 8989 });
const canvas = db.loadCanvasFromDB(CANVAS_X, CANVAS_Y);

const broadcast = (data, ws) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== ws) {
      client.send(JSON.stringify(data));
    }
  });
};

wss.on('connection', (ws, req) => {
  let userInfo = null;

  ws.send(JSON.stringify({
    type: 'LOAD_CANVAS',
    message: { x: CANVAS_X, y: CANVAS_Y, canvas: Array.from(canvas) },
  }));

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'SET_PIXEL':
        setPixel(data, ws, userInfo)
        break;
      case 'AUTHENTICATE':
        userInfo = authenticate(data, userInfo, ws);
        break;
      default:
        break;
    }
  });
});

function setPixel(data, ws, userInfo) {
  const x = data.payload.x;
  const y = data.payload.y;
  const color = data.payload.color;

  if (!logic.pixelInsertIsValid(userInfo, x, y, CANVAS_X, CANVAS_Y)) return;

  const value = (CANVAS_Y * (x + 1)) - CANVAS_Y + y;
  canvas[value] = color;
  db.addPixelToDB(x, y, color, userInfo.userId)

  broadcast({
    type: 'SET_PIXEL',
    message: data.payload,
  }, ws);

  userInfo.cooldown = Date.now() + COOLDOWN_MS;
  ws.send(JSON.stringify({
    type: 'USER_INFO',
    message: userInfo
  }));
}

function authenticate(data, userInfo, ws) {
  const session = jwt.createSession(data.payload.token);
  userInfo = logic.getUserInfo(session);
  ws.send(JSON.stringify({
    type: 'USER_INFO',
    message: userInfo
  }));
  return userInfo
}