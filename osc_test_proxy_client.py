var util = require('util');
var osc = require('./lib/osc');

var m = new osc.OSCMessage('/test/1');
m.push(42);
m.push(14);
var m2 = new osc.OSCMessage('/test/2');
var bndl = new osc.OSCBundle();
bndl.push(m); bndl.push(m2);
var bndl2 = new osc.OSCBundle();
bndl2.push(new osc.OSCMessage('/test/3'));
bndl2.push(new osc.OSCMessage('/test/4'));
bndl2.push(new osc.OSCMessage('/test/5'));
bndl2.timetag = new Date(Date.parse("September 18, 1970"));
bndl.push(bndl2);
var p = new osc.OSCPacket(bndl);

var WebSocket = require('ws'), ws = new WebSocket('ws://localhost:8080');

ws.on('message', function(message) {
      var p = new osc.OSCPacket();
      p.recvFromStream(message);
      console.log(util.inspect(p, false, null));
});
