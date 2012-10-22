var util = require('util');
var osc = require('./lib/osc');
var WebSocketServer = require('ws').Server, wss = new WebSocketServer({port:8080});
wss.on('connection', function(ws) {
   ws.on('message', function(data) {
      if (data.length == 0) return;
      var b = new Uint8Array(data);
      var v = new DataView(b.buffer, 0);
      var p = null;
      if (osc.OSCBundle.isBundle(v)) {
         p = new osc.OSCBundle(v);
      } else {
         p = new osc.OSCMessage(v);
      }
      console.log(util.inspect(p, false, null));
      ws.send(new Uint8Array(p.toBuffer()), {binary: true, mask: true});
      ws.close();
   });
});
