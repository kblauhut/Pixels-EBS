const CANVAS_X = 300;
const CANVAS_Y = 450;
const COOLDOWN_MS = 60000;

const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const jwt = require('./util/jwt_helper');
const db = require('./util/db_helper')
const logic = require('./util/logic')

db.createTables();

const server = https.createServer({
  cert: fs.readFileSync('./cert/server.crt'),
  key: fs.readFileSync('./cert/server.key')
}).listen(8989);

const wss = new WebSocket.Server({ server });
const canvas = db.loadCanvasFromDB(CANVAS_X, CANVAS_Y);
var connectedUsers = []

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
        userInfo = setPixel(data, ws, userInfo)
        break;
      case 'AUTHENTICATE':
        userInfo = authenticate(data, userInfo, ws);
        break;
      case 'PURCHASE':
        userInfo = purchase(data, userInfo, ws)
        break;
      default:
        break;
    }
  });
  ws.on('close', () => {
    if (userInfo.signedIn) {
      const index = connectedUsers.indexOf(userInfo.userId);
      if (index > -1) {
        connectedUsers.splice(index, 1);
      }
    }
  })
});

function setPixel(data, ws, userInfo) {
  const x = data.payload.x;
  const y = data.payload.y;
  const color = data.payload.color;

  if (!logic.pixelInsertIsValid(userInfo, x, y, CANVAS_X, CANVAS_Y)) {
    return userInfo;
  }

  const value = (CANVAS_Y * (x + 1)) - CANVAS_Y + y;
  canvas[value] = color;
  db.addPixelToDB(x, y, color, userInfo.userId)
  if (userInfo.purchasedPixels > 0) {
    db.consumePurchasedPixel(userInfo.userId)
    userInfo.purchasedPixels -= 1;
  } else {
    db.updateUserCooldown(userInfo.userId)
    console.log("s");
  }

  broadcast({
    type: 'SET_PIXEL',
    message: data.payload,
  }, ws);

  userInfo.cooldownUnix = Date.now() + COOLDOWN_MS;
  userInfo.cooldown = userInfo.purchasedPixels > 0 ? 0 : COOLDOWN_MS

  ws.send(JSON.stringify({
    type: 'USER_DATA',
    message: userInfo
  }));
  return userInfo;
}

function authenticate(data, userInfo, ws) {
  const session = jwt.from(data.payload.token);
  userInfo = logic.getUserInfo(session, COOLDOWN_MS);

  console.log(userInfo);

  if (userInfo.signedIn && connectedUsers.includes(userInfo.userId)) {
    ws.close()
  }

  connectedUsers.push(userInfo.userId)

  ws.send(JSON.stringify({
    type: 'USER_DATA',
    message: userInfo
  }));

  return userInfo
}

function purchase(data, userInfo, ws) {
  const receipt = jwt.from(data.payload.transaction.transactionReceipt);
  if (receipt == null) return;

  const transactionId = receipt.data.transactionId;
  const time = receipt.data.time;
  const sku = receipt.data.product.sku;
  const amount = receipt.data.product.cost.amount;
  const uid = userInfo.userId;

  console.log(receipt);

  userInfo.purchasedPixels += amount;
  logic.processPurchase(transactionId, uid, time, sku, amount)

  ws.send(JSON.stringify({
    type: 'USER_DATA',
    message: userInfo
  }));

  return userInfo;
}