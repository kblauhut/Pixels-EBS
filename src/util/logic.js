const db = require('./db_helper');

function getUserInfo(session) {
  const userInfo = {
    signedIn: false, userId: '', cooldown: Date.now(), purchasedPixels: 0,
  };

  if (session == null) {
    return userInfo;
  }

  const uid = session.opaque_user_id;

  if (uid.charAt(0) !== 'U') {
    return userInfo;
  }
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
  if (x >= canvasX || x < 0) return false;
  if (y >= canvasY || y < 0) return false;
  if (userInfo.purchasedPixels !== 0 || userInfo.cooldown <= Date.now()) return true;
  return false;
}

exports.getUserInfo = getUserInfo;
exports.pixelInsertIsValid = pixelInsertIsValid;
