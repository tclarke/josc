var osc = require('./lib/osc');
var WebSocketServer = require('ws').Server, wss = new WebSocketServer({port:8080});
wss.on('connection', function(ws) {
   ws.on('message', function(data) {
      var p = new osc.OSCPacket();
      p.recvFromStream(data);
      console.log(p);
      console.log(p.packets);
      ws.close();
   });
});
