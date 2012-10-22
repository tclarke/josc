var osc = require('../lib/osc');

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

var ws = new WebSocket('ws://localhost:8080');

ws.onmessage = function(message) {
    var rdr = new FileReader();
    rdr.onloadend = function() {
       var v = new DataView(rdr.result, 0);
       if (osc.OSCBundle.isBundle(v)) {
           console.log(new osc.OSCBundle(v));
       } else {
           console.log(new osc.OSCMessage(v));
       }
    }
    rdr.readAsArrayBuffer(message.data);
};

ws.onopen = function() {
   ws.send(bndl.toBuffer());
}
