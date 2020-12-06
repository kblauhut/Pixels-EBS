const db = require('better-sqlite3')('db.sqlite');

function createTables() {
  db.prepare('CREATE TABLE IF NOT EXISTS pixels (x INTEGER NOT NULL, y INTEGER NOT NULL, color INT, PRIMARY KEY(x,y))').run();
  db.prepare('CREATE TABLE IF NOT EXISTS users (user_id TEXT NOT NULL PRIMARY KEY, pixels_remaining INTEGER)').run();
  db.prepare('CREATE TABLE IF NOT EXISTS pixels_users (id INTEGER PRIMARY KEY, timestamp INTEGER NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, user_id TEXT NOT NULL, FOREIGN KEY (x,y) REFERENCES pixels(x,y), FOREIGN KEY (user_id) REFERENCES users(user_id))').run();
  db.prepare('CREATE TABLE IF NOT EXISTS purchases (transaction_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, time TEXT NOT NULL, sku TEXT NOT NULL, amount INTEGER NOT NULL)').run();
}

function loadCanvasFromDB(canvasX, canvasY) {
  const canvas = new Uint8Array(canvasX * canvasY);
  const rows = db.prepare('SELECT * FROM pixels').all();
  rows.forEach((row) => {
    const value = (canvasY * row.x) - canvasY + row.y - 1;
    canvas[value] = row.color;
  });
  return canvas;
}

function addUserToDB(uid) {
  const stmt = db.prepare('INSERT INTO users (user_id, pixels_remaining) VALUES (?,?)');
  stmt.run(uid, 0);
}

function checkIfUserExists(uid) {
  const stmt = db.prepare('SELECT EXISTS(SELECT 1 FROM users WHERE user_id = ?)');
  const query = stmt.get(uid);
  const keys = Object.keys(query);
  if (query[keys[0]] === 0) {
    return false;
  }
  return true;
}

function getUserFromDB(uid) {
  const stmt = db.prepare('SELECT user_id, pixels_remaining FROM users WHERE user_id = ?');
  return stmt.get(uid);
}

function addPixelToDB(x, y, color, uid) {
  const updatePixel = db.prepare('REPLACE INTO pixels (x,y,color) VALUES (?,?,?)');
  const addPixelUserRelation = db.prepare('INSERT INTO pixels_users (x,y,user_id,timestamp) VALUES (?,?,?,?)');
  updatePixel.run(x, y, color);
  addPixelUserRelation.run(x, y, uid, Date.now());
}

function addPurchaseToDB(transaction_id, user_id, time, sku, amount) {
  const stmt = db.prepare('INSERT INTO purchases (transaction_id, user_id, time, sku, amount) VALUES (?,?,?,?,?)');
  stmt.run(transaction_id, user_id, time, sku, amount);
}

function giveUserPixels(uid, amount) {
  if (!checkIfUserExists(uid)) {
    addUserToDB(uid)
  }
  const stmt = db.prepare('UPDATE users SET pixels_remaining = pixels_remaining + ? WHERE user_id = ?');
  stmt.run(amount, uid)
}

exports.createTables = createTables;
exports.loadCanvasFromDB = loadCanvasFromDB;
exports.addUserToDB = addUserToDB;
exports.checkIfUserExists = checkIfUserExists;
exports.getUserFromDB = getUserFromDB;
exports.addPixelToDB = addPixelToDB;
exports.giveUserPixels = giveUserPixels;
exports.addPurchaseToDB = addPurchaseToDB;
