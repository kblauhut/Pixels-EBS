const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');

const server = https.createServer({
    cert: fs.readFileSync('./cert/server.crt'),
    key: fs.readFileSync('./cert/server.key')
}).listen(8990);

const wss = new WebSocket.Server({ server });
var currentUsers = [];
var connectedUsers = 0;

const broadcast = (data) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};

wss.on('connection', (ws, req) => {
    ws.send(JSON.stringify({
        connectedUsers: currentUsers, signedInUsers: connectedUsers,
    }));
});

function sendCurrentUsers(users, userList) {
    currentUsers = userList;
    connectedUsers = users;
    broadcast({ connectedUsers: users, signedInUsers: userList });
}

function sendPixelPlace(pixelData) {
    console.log(pixelData);
    const x = pixelData.payload.x;
    const y = pixelData.payload.y;
    const color = pixelData.payload.color;
    broadcast({ pixel: { x: x, y: y, color: color } });
}

exports.sendCurrentUsers = sendCurrentUsers;
exports.sendPixelPlace = sendPixelPlace;
