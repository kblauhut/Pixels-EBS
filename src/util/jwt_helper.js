const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') })

const jwt = require('jsonwebtoken');
const secretKey = process.env.EXTENSION_SECRET ? process.env.EXTENSION_SECRET : ''
const secret = Buffer.from(secretKey, 'base64');

function from(token) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    console.warn("JWT Error");
    return null;
  }
}

exports.from = from;
