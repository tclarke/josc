var util = require('util');
var osc = require('./lib/osc');

var WebSocketServer = require('ws').Server, wss = new WebSocketServer({port:8080});
wss.on('connection', function(ws) {
   var oss = new osc.UDPServer(4444);
   oss._dispatch = function(pkt) {
      ws.send(pkt.sendToStream());
   };
   ws.on('message', function(data) {
      var p = new osc.OSCPacket();
      p.recvFromStream(data);
      console.log(util.inspect(p, false, null));
      ws.close();
   });
   oss.start()
});

