var util = require('util');
var osc = require('./lib/osc');
var oscserver = require('./lib/oscserver');

var WebSocketServer = require('ws').Server, wss = new WebSocketServer({port:8080});
wss.on('connection', function(ws) {
   var oss = new oscserver.UDPServer(4444);
   oss.on("packet", function(pkt) {
       console.log("Received a packet from UDP: ", pkt);
       ws.send(new Uint8Array(pkt.toBuffer()), {binary: true, mask: true});
   });
   ws.on('message', function(data) {
       if (data.length == 0) return;
       var b = new Uint8Array(data);
       var v = new DataView(b.buffer, 0);
       var pkt = null;
       if (osc.OSCBundle.isBundle(v)) {
           pkt = new osc.OSCBundle(v);
       } else {
           pkt = new osc.OSCMessage(v);
       }
       console.log("Received a packet from WS: ", util.inspect(pkt, false, null));
       oss.socket.send(b, 0, b.length, 7000, "localhost");
   });
   oss.start()
});

