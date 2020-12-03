const CANVAS_X = 300;
const CANVAS_Y = 450;

const WebSocket = require('ws');
const db = require('better-sqlite3')('db.sqlite');
const jwt = require('jsonwebtoken');
const secret = Buffer.from("F5dfewdiA/lXpI5DAZOnBXsCnBwvBxV6nRLEo6i9fLo=", 'base64')

const wss = new WebSocket.Server({ port: 8989 });
const canvas = new Uint8Array(CANVAS_X * CANVAS_Y);

db.prepare('CREATE TABLE IF NOT EXISTS pixels (x INTEGER NOT NULL, y INTEGER NOT NULL, color INT, PRIMARY KEY(x,y))').run();
db.prepare('CREATE TABLE IF NOT EXISTS users (user_id TEXT NOT NULL PRIMARY KEY, pixels_remaining INTEGER)').run();
db.prepare('CREATE TABLE IF NOT EXISTS pixels_users (id INTEGER PRIMARY KEY, timestamp INTEGER NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, user_id TEXT NOT NULL, FOREIGN KEY (x,y) REFERENCES pixels(x,y), FOREIGN KEY (user_id) REFERENCES users(user_id))').run();

loadCanvasFromDB();

const broadcast = (data, ws) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== ws) {
      client.send(JSON.stringify(data));
    }
  });
};

wss.on('connection', (ws, req) => {
  let session = null;
  let userInfo = null;
  ws.send(JSON.stringify({
    type: 'LOAD_CANVAS',
    message: { x: CANVAS_X, y: CANVAS_Y, canvas: Array.from(canvas) },
  }));
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'SET_PIXEL':
        if (!pixelInsertIsValid(userInfo, data.payload.x, data.payload.y)) break;
        broadcast({
          type: 'SET_PIXEL',
          message: data.payload,
        }, ws);
        setPixel(data.payload.x, data.payload.y, data.payload.color, userInfo);
        userInfo.cooldown = Date.now() + 10;
        ws.send(JSON.stringify({
          type: 'USER_INFO',
          message: userInfo
        }));
        break;
      case 'AUTHENTICATE':
        session = createSession(data.payload.token);
        userInfo = getUserInfo(session);
        ws.send(JSON.stringify({
          type: 'USER_INFO',
          message: userInfo
        }));
      default:
        break;
    }
  });
});


function addUserToDB(uid) {
  const stmt = db.prepare('INSERT INTO users (user_id, pixels_remaining) VALUES (?,?)');
  stmt.run(uid, 0);
}

function checkIfUserExists(uid) {
  const stmt = db.prepare('SELECT EXISTS(SELECT 1 FROM users WHERE user_id = ?)');
  const query = stmt.get(uid)
  let keys = Object.keys(query)
  if (query[keys[0]] == 0) {
    return false;
  }
  return true;
}

function getUserInfo(session) {
  if (session == null) {
    return userInfo;
  }
  let uid = session.opaque_user_id;
  let userInfo = { signedIn: false, userId: uid, cooldown: Date.now(), purchasedPixels: 0 }
  if (uid.charAt(0) !== 'U') {
    return userInfo;
  }
  if (!checkIfUserExists(uid)) {
    addUserToDB(uid);
  }
  const stmt = db.prepare('SELECT user_id, pixels_remaining FROM users WHERE user_id = ?');
  const query = stmt.get(uid);
  userInfo.signedIn = true;
  userInfo.purchasedPixels = query.pixels_remaining;
  userInfo.userId = query.user_id;
  return userInfo;
}

function pixelInsertIsValid(userInfo, x, y) {
  if (userInfo == null) return false;
  if (x >= CANVAS_X || x < 0) return false;
  if (y >= CANVAS_Y || y < 0) return false;
  if (userInfo.purchasedPixels != 0 || userInfo.cooldown <= Date.now()) return true;
  return false;
}

function setPixel(x, y, color, userInfo) {
  const updatePixel = db.prepare('REPLACE INTO pixels (x,y,color) VALUES (?,?,?)');
  const addPixelUserRelation = db.prepare('INSERT INTO pixels_users (x,y,user_id,timestamp) VALUES (?,?,?,?)')
  const value = (CANVAS_Y * (x + 1)) - CANVAS_Y + y;
  canvas[value] = color;
  updatePixel.run(x, y, color);
  addPixelUserRelation.run(x, y, userInfo.userId, Date.now())
}

function createSession(token) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

function loadCanvasFromDB() {
  const rows = db.prepare('SELECT * FROM pixels').all();
  rows.forEach((row) => {
    const value = (CANVAS_Y * row.x) - CANVAS_Y + row.y - 1;
    canvas[value] = row.color;
  });
}



//INGNORE...
function fillDB() {
  const insert = db.prepare('REPLACE INTO pixels (x,y,color) VALUES (@x,@y,@color)');

  const values = [];
  for (let x = 0; x < 350; x += 1) {
    for (let y = 0; y < 450; y += 1) {
      values.push({ x, y, color: 11 });
    }
  }
  const transaction = db.transaction((values) => {
    for (const value of values) {
      insert.run(value);
    }
  });
  transaction(values);
}
