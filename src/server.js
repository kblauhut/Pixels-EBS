const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const jwt = require('./util/jwt_helper');
const db = require('./util/db_helper')
const logic = require('./util/logic')
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CANVAS_X = 300;
const CANVAS_Y = 450;
const COOLDOWN_MS = process.env.COOLDOWN ? parseInt(process.env.COOLDOWN) : 60000;

db.createTables();

const server = https.createServer({
  cert: fs.readFileSync('./cert/server.crt'),
  key: fs.readFileSync('./cert/server.key')
}).listen(8989);

const wss = new WebSocket.Server({ server });
const canvas = db.loadCanvasFromDB(CANVAS_X, CANVAS_Y);
var id = 0;
var lookup = {};

const broadcast = (data, ws) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== ws) {
      client.send(JSON.stringify(data));
    }
  });
};

const broadcastToUid = (userID, data) => {
  Object.keys(lookup).forEach(key => {
    if (lookup[key].userInfo.userId === userID) {
      lookup[key].send(data);
    }
  });
}

wss.on('connection', (ws, req) => {
  ws.userInfo = null;

  ws.send(JSON.stringify({
    type: 'LOAD_CANVAS',
    message: { x: CANVAS_X, y: CANVAS_Y, canvas: Array.from(canvas) },
  }));

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'SET_PIXEL':
        setPixel(data, ws);
        break;
      case 'AUTHENTICATE':
        authenticate(data, ws);
        break;
      case 'PURCHASE':
        purchase(data, ws)
        break;
      default:
        break;
    }
  });
  ws.on('close', () => {
    delete lookup[ws.id];
  })
});

function setPixel(data, ws) {
  const x = data.payload.x;
  const y = data.payload.y;
  const color = data.payload.color;
  if (!logic.pixelInsertIsValid(ws.userInfo, x, y, CANVAS_X, CANVAS_Y)) {
    return;
  }

  const value = (CANVAS_Y * (x + 1)) - CANVAS_Y + y;
  canvas[value] = color;
  db.addPixelToDB(x, y, color, ws.userInfo.userId)
  if (ws.userInfo.purchasedPixels > 0) {
    db.consumePurchasedPixel(ws.userInfo.userId)
    ws.userInfo.purchasedPixels -= 1;
  } else {
    db.updateUserCooldown(ws.userInfo.userId)
  }

  broadcast({
    type: 'SET_PIXEL',
    message: data.payload,
  }, ws);

  ws.userInfo.cooldownUnix = Date.now() + COOLDOWN_MS;
  ws.userInfo.cooldown = ws.userInfo.purchasedPixels > 0 ? 0 : COOLDOWN_MS

  broadcastToUid(
    ws.userInfo.userId,
    JSON.stringify({
      type: 'USER_DATA',
      message: ws.userInfo
    })
  )
}

function authenticate(data, ws) {
  const session = jwt.from(data.payload.token);
  ws.userInfo = logic.getUserInfo(session, COOLDOWN_MS);

  if (ws.userInfo.signedIn) {
    console.log(ws.userInfo);
    ws.id = id++;
    lookup[ws.id] = ws;
    console.log(Object.keys(lookup));
  }

  broadcastToUid(
    ws.userInfo.userId,
    JSON.stringify({
      type: 'USER_DATA',
      message: ws.userInfo
    })
  )
}

function purchase(data, ws) {
  const receipt = jwt.from(data.payload.transaction.transactionReceipt);
  if (receipt == null) return;

  const transactionId = receipt.data.transactionId;
  const time = receipt.data.time;
  const sku = receipt.data.product.sku;
  const amount = receipt.data.product.cost.amount;
  const uid = ws.userInfo.userId;

  console.log(receipt);

  ws.userInfo.purchasedPixels += amount;
  logic.processPurchase(transactionId, uid, time, sku, amount)

  broadcastToUid(
    ws.userInfo.userId,
    JSON.stringify({
      type: 'USER_DATA',
      message: ws.userInfo
    })
  )
}
