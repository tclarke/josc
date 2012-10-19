var osc = require('./lib/osc');

var m = new osc.OSCMessage('/test/1');
m.push(42);
m.push(14);
var m2 = new osc.OSCMessage('/test/2');
var p = new osc.OSCPacket();
p.push(m);
p.push(m2);

var WebSocket = require('ws'), ws = new WebSocket('ws://localhost:8080');
ws.on('open', function() {
   console.log(m);
   console.log(m2);
   p.dispatchStream = function(d) { ws.send(d); };
   p.send();
});

ws.on('message', function(message) {
   console.log('received: %s', message);
});
