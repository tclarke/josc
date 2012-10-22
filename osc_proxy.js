var util = require('util');
var osc = require('./lib/osc');
var oscserver = require('./lib/oscserver');

var WebSocketServer = require('ws').Server, wss = new WebSocketServer({port:8080});
wss.on('connection', function(ws) {
   var oss = new oscserver.UDPServer(4444);
   oss.on("packet", function(pkt) {
       console.log("Received a packet from UDP: ", pkt);
       ws.send(pkt.toBuffer());
   });
   ws.on('message', function(data) {
       var b = new Buffer(data, "binary");
       var sz = b.readUInt32BE(0);
       var pbuf = new Buffer(sz);
       b.copy(pbuf, 0, 4, sz);
       var pkt = null;
       if (osc.OSCBundle.isBundle(pbuf)) {
           pkt = new osc.OSCBundle(pbuf);
       } else {
           pkt = new osc.OSCMessage(pbuf);
       }
       console.log("Received a packet from WS: ", pkt);
       oss.socket.send(pbuf, 0, pbuf.length, 1234, "localhost");
   });
   oss.start()
});

