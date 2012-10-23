var osc = require('../lib/osc');
function parsePacket(data) {
    var rdr = new FileReader();
    rdr.onload = function(evt) {
       var v = new DataView(evt.target.result, 0);
       if (evt.target.result.byteLength == 4) {
          var sz = v.getUint32(0);
          return;
       }
       if (osc.OSCBundle.isBundle(v)) {
           alert("Bundle not supported!");
       } else {
           var m = new osc.OSCMessage(v);
           if (m.address == "/button/1") {
              if (m.args[0] == 1.0) {
                 $("#led").css("background-color", "#00dd00");
              } else {
                 $("#led").css("background-color", "#dddddd");
              }
           } else {
              alert("Unknown address: " + m.address);
           }
       }
    }
    rdr.readAsArrayBuffer(data);
};

$(function() {
   var ws = new WebSocket('ws://localhost:8080');
   $("#check").button();
   ws.onopen = function() {
      $("#check").click(function(evt) {
         var m = new osc.OSCMessage("/led/1");
         if (this.checked) m.push(1.0, 'f');
         else m.push(0.0, 'f');
         var buf = m.toBuffer();
         var szbuf = new Uint32Array(1);
         szbuf[0] = buf.byteLength;
         ws.send(szbuf, {binary:true});
         ws.send(new Uint8Array(buf), {binary:true});
      });
   };
   ws.onmessage = function(message) {
      parsePacket(message.data);
   };
});
