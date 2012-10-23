var osc = require('./osc');
var dgram = require('dgram');
var ws = require('ws');
var events = require('events');
var prototype = require('prototype');

/**
 * EventEmitter isn't a prototype class so we use this to get it into the prototype chain.
 */
var EventEmitter = Class.create();
EventEmitter.prototype = new events.EventEmitter;

var UDPServer = Class.create(EventEmitter, {
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
           var srv = this;
           this.socket.on("message", function(msg) {srv._recv(msg)});
        },
   /**
    * Bind to the address/port and begin listening for datagrams.
    */
   listen: function() { this.socket.bind(this.port, this.addr); },
   /**
    * Unbind from the address/pot and stop listening for datagrams.
    */
   close: function() { this.socket.close(); },
   /**
    * Send a datagram.
    * @param An OSCMessage or OSCBundle
    */
   send: function(packet, port, addr) {
         if (addr == undefined) addr = "localhost";
         var buf = packet.toBuffer();
         this.socket.send(new Uint8Array(buf), 0, buf.byteLength, port, addr);
      },

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

var WSServer = Class.create(EventEmitter, {
   /**
    * Construct a simple WebSocket OSC server.
    * Since this is a bi-directional link, it can
    * also be used as a client if connect() is called
    * instead of listen. In that case, port and addr can be undefined.
    *
    * @param port The port to listen on.
    * @param addr The interface address to bind to or undefined to bind to localhost.
    */
   initialize: function(port, addr) {
         // simple state machine to handle partially received packets
         this.recvSM = { sz:null, buf:null };
         this.port = port;
         this.addr = addr;
      },
   /**
    * Begin listening for connections.
    */
   listen: function() {
         if (this.addr == undefined)
            this.socket = new ws.Server({port:this.port});
         else
            this.socket = new ws.Server({port:this.port, host:this.addr});
         var srv = this;
         this.socket.on("connection", function(client) {
               client.on("message", function(message) { srv._recv(message, this); });
               srv.emit("connection", client);
            });
      },
   /**
    * Stop listening for connections.
    */
   close: function() { this.socket.close(); },
   /**
    * Connect to a WS server.
    * This is used by the initiating (client) side.
    *
    * @param url The WebSocket URL.
    */
   connect: function(url) {
         this.socket = new ws(url);
         var srv = this;
         this.socket.on("open", function() {
               this.on("message", function(message) { srv._recv(message, this); });
               srv.emit("connection", this);
            });
      },

   /**
    * Send a packet over the ws connection.
    * @param An OSCMessage or OSCBundle
    */
   send: function(packet, client) {
         var buf = packet.toBuffer();
         var szbuf = new Uint32Array(1);
         szbuf[0] = buf.byteLength;
         client.send(szbuf, {binary:true});
         client.send(new Uint8Array(buf), {binary:true});
      },
   
   _recv: function(msg, client) {
         var b = new Uint8Array(msg);
         if (this.recvSM.sz === null) {
            // no partial packet
            var v = new DataView(b.buffer, 0);
            var sz = v.getUint32(0);
            this.recvSM.sz = sz;
            this.recvSM.buf = b.subarray(4);
            if (b.byteLength - 4 < sz) {
               // don't have the whole thing
               return;
            }
         } else {
            // partial packet
            var newBuf = new Uint8Array(this.recvSM.buf.byteLength + b.byteLength);
            for (var i = 0; i < this.recvSM.buf.byteLength; ++i) newBuf[i] = this.recvSM.buf[i];
            for (var i = 0; i < b.byteLength; ++i) newBuf[i + this.recvSM.buf.byteLength] = b[i];
            this.recvSM.buf = newBuf;
         }
         v = new DataView(this.recvSM.buf.buffer, 0);
         if (osc.OSCBundle.isBundle(v)) {
            this.emit("packet", new osc.OSCBundle(v), client);
         } else {
            this.emit("packet", new osc.OSCMessage(v), client);
         }
         if (this.recvSM.sz < this.recvSM.buf.byteLength) {
            // got part of the next packet
            var v = new DataView(this.recvSM.buf.buffer, this.recvSM.sz);
            var sz = v.getUint32(0);
            this.recvSM.buf = this.recvSM.buf.subarray(this.recvSM.sz);
            this.recvSM.sz = sz;
         } else {
            this.recvSM.sz = null;
            this.recvSM.buf = null;
         }
      }
});

exports.UDPServer = UDPServer;
exports.WSServer = WSServer;
