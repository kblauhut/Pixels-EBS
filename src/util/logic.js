const db = require('./db_helper');

function getUserInfo(session) {
  const userInfo = {
    signedIn: false, userId: '', cooldown: Date.now(), purchasedPixels: 0,
  };

  if (!session || !session.user_id || session.is_unlinked) {
    return userInfo;
  }

  const uid = session.user_id;

  if (!db.checkIfUserExists(uid)) {
    db.addUserToDB(uid);
  }

  const query = db.getUserFromDB(uid);
  userInfo.signedIn = true;
  userInfo.purchasedPixels = query.pixels_remaining;
  userInfo.userId = query.user_id;
  return userInfo;
}

function pixelInsertIsValid(userInfo, x, y, canvasX, canvasY) {
  if (userInfo == null) return false;
  if (userInfo.userId == '') return false;
  if (x >= canvasX || x < 0) return false;
  if (y >= canvasY || y < 0) return false;
  if (userInfo.purchasedPixels !== 0 || userInfo.cooldown <= Date.now()) return true;
  return false;
}


function processPurchase(transaction_id, uid, time, sku, amount) {
  db.giveUserPixels(uid, amount);
  db.addPurchaseToDB(transaction_id, uid, time, sku, amount);
}

exports.getUserInfo = getUserInfo;
exports.pixelInsertIsValid = pixelInsertIsValid;
exports.processPurchase = processPurchase;
