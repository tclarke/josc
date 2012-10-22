var osc = require('./osc');
var dgram = require('dgram');
var events = require('events');
var prototype = require('prototype');

var dummy = Class.create();
dummy.prototype = new events.EventEmitter;

var UDPServer = Class.create(dummy, {
    /**
     * Construct a simple UDP OSC server.
     *
     * @param port The port to bind to.
     * @param addr The interface address to bind to or undefined to bind to all interfaces.
     */
    initialize: function(port, addr) {
           this.port = port;
           this.addr = addr;
           this.socket = dgram.createSocket('udp4');
           this.socket._container = this;
           this.socket.on("message", function(msg) {this._container._recv(msg)});
        },
   /**
    * Bind to the address/port and begin listening for datagrams.
    */
   start: function() { this.socket.bind(this.port, this.addr); },
   /**
    * Unbind from the address/pot and stop listening for datagrams.
    */
   close: function() { this.socket.close(); },

   _recv: function(msg, rinfo) {
      var b = new Uint8Array(msg);
      var v = new DataView(b.buffer, 0);
      if (osc.OSCBundle.isBundle(v)) {
          this.emit("packet", new osc.OSCBundle(v));
      } else {
          this.emit("packet", new osc.OSCMessage(v));
      }
   }
});

exports.UDPServer = UDPServer;
