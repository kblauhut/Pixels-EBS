const jwt = require('jsonwebtoken');

const secret = Buffer.from('F5dfewdiA/lXpI5DAZOnBXsCnBwvBxV6nRLEo6i9fLo=', 'base64');

function from(token) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    console.warn("JWT Error");
    return null;
  }
}

exports.from = from;
