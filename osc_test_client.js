var osc = require('./lib/osc');
var util = require('util');

var m = new osc.OSCMessage('/test/1');
m.push(42);
m.push(14);
var m2 = new osc.OSCMessage('/test/2');

var bndl = new osc.OSCBundle();
bndl.timetag = null;
bndl.push(m);
bndl.push(m2);

var bndl2 = new osc.OSCBundle();
bndl2.push(new osc.OSCMessage('/test/3'));
bndl2.push(bndl);
bndl2.push(new osc.OSCMessage('/test/4'));

var WebSocket = require('ws'), ws = new WebSocket('ws://localhost:8080');
ws.on('open', function() {
   console.log("Sending: " + util.inspect(bndl2, false, null));
   ws.send(new Uint8Array(bndl2.toBuffer()), {binary: true, mask: true});
});

ws.on('message', function(message) {
   var b = new Uint8Array(message);
   var v = new DataView(b.buffer, 0);
   var p = null;
   if (osc.OSCBundle.isBundle(v)) {
      p = new osc.OSCBundle(v);
   } else {
      p = new osc.OSCMessage(v);
   }
   console.log("Received: " + util.inspect(p, false, null));
});
