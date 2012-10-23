var util = require('util'),
    ws = require('ws'),
    osc = require('./lib/osc'),
    oscserver = require('./lib/oscserver');

var clientConnections = new Array();
var oss = new oscserver.UDPServer(4444);
var wss = new oscserver.WSServer(8080);
oss.on("packet", function(p) {
   console.log("Received a packer from UDP: ", p);
   var i = 0
   for (var i = 0; i < clientConnections.length; ++i) {
      if (clientConnections[i] == null) continue;
      switch (clientConnections[i].readyState) {
         case ws.OPEN:
            wss.send(p, clientConnections[i]);
            break;
         case ws.CLOSED:
            clientConnections[i] = null;
            break;
      }
   }
});
wss.on("connection", function(client) {
   console.log("Received WS client connection.");
   clientConnections.push(client);
});
wss.on("packet", function(p, ws) {
   console.log("Received a packet from WS: ", p);
   oss.send(p, 7000);
});
wss.listen();
oss.listen();
