var util = require('util');
var osc = require('./lib/osc');
var oscserver = require('./lib/oscserver');

var wss = new oscserver.WSServer(8080);
wss.on('packet', function(p, ws) {
   console.log(util.inspect(p, false, null));
   this.send(p, ws);
   ws.close();
});
wss.listen();
