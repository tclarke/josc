var osc = require('./lib/osc');
var oscserver = require('./lib/oscserver');
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

var wss = new oscserver.WSServer();
wss.on('packet', function(p, ws) {
   console.log(util.inspect(p, false, null));
   this.send(p, ws);
});
wss.on('connection', function(ws) {
   this.send(bndl2, ws);
});

wss.connect("ws://localhost:8080");
