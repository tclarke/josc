function OSCBadType(message) { this.message = "Bad Type: " + message; }; OSCBadType.prototype = new Error;

function OSCMessage(arg) {
   if (typeof(arg) === 'string') {
      if (arg[0] != '/') {
         throw "Invalid OSCMessage address: " + arg;
      }
      this.address = arg;
      this.typetagstring = ',';
      this.args = [];
   } else if (arg instanceof Buffer) {
      this.fromBuffer(arg);
   } else if (arg === undefined) {
      this.address = '';
      this.typetagstring = '';
      this.args = [];
   } else {
      throw "Argument must be an address string or a Buffer object.";
   }
};

OSCMessage.prototype = {
   fromBuffer: function(b) {
      var offset = 0;
      var tmp = this._reads(b,offset); offset = tmp[1]; this.address = tmp[0];
      if (this.address === "#bundle") {
         throw "OSCBundle not supported."
      } else if (this.address[0] != '/') {
         throw "Invalid message address.";
      }
      tmp = this._reads(b,offset); offset = tmp[1]; this.typetagstring = tmp[0];
      this.args = []
      for (var i = 1; i < this.typetagstring.length; ++i) {
         switch (this.typetagstring[i]) {
            case 'i':
               this.args.push(b.readInt32BE(offset)); offset += 4;
               break;
            case 'f':
               this.args.push(b.readFloatBE(offset)); offset += 4;
               break;
            case 's':
               tmp = this._reads(b,offset); offset = tmp[1]; this.args.push(tmp[0]);
               break;
            case 'b':
            {
               var len = b.readInt32BE(offset); offset += 4;
               var buf = new Buffer(len);
               b.copy(buf, 0, offset, offset+len); offset += len;
               offset += len % 4;
               this.args.push(buf);
               break;
            }
            default:
               throw new OSCBadType(this.typetagstring[i]);
         }
      }
   },
   push: function(arg, type) {
      if (type === undefined) {
         if (typeof(arg) === 'number' && arg % 1 === 0) {
            type = 'i';
         } else if (typeof(arg) === 'number') {
            type = 'f';
         } else if (arg instanceof Buffer) {
            type = 'b';
         } else {
            type = 's';
         }
      }
      this.typetagstring += type;
      this.args.push(arg);
   },
   toString: function() {
      var r = "[" + this.size() + '] "' + this.address + '" : ' + this.typetagstring + " : ";
      for (i in this.args) {
         if (this.args[i] instanceof Buffer) {
            r += " " + "<Buffer length " + this.args[i].length + ">";
         } else if (typeof(this.args[i]) === 'string') {
            r += ' "' + this.args[i] + '"';
         } else {
            r += " " + this.args[i].toString();
         }
      }
      return r;
   },
   size: function() {
      var sz = this._padLen(this.address.length) + this._padLen(this.typetagstring.length);
      for (var i = 0; i < this.args.length; ++i) {
         switch(this.typetagstring[i+1]) {
            case 'i':
            case 'f':
               sz += 4;
               break;
            case 's':
               sz += this._padLen(this.args[i].length);
               break;
            case 'b':
               sz += this._padLen(this.args[i].length) + 4;
               break;
            default:
               throw new OSCBadType(this.typetagstring[i]);
         }
      }
      return sz;
   },
   toBuffer: function() {
      if (this.address[0] != '/') {
         throw "Invalid OSCMessage address";
      }
      var b = new Buffer(this.size());
      var offset = 0;
      offset = this._padStr(b, this.address, offset);
      offset = this._padStr(b, this.typetagstring, offset);
      for (var i = 0; i < this.args.length; ++i) {
         switch(this.typetagstring[i+1]) {
            case 'i':
               b.writeInt32BE(this.args[i], offset); offset += 4;
               break;
            case 'f':
               b.writeFloatBE(this.args[i], offset); offset += 4;
               break;
            case 's':
               offset = this._padStr(b, this.args[i], offset);
               break;
            case 'b':
               b.writeInt32BE(this.args[i].length, offset); offset += 4;
               this.args[i].copy(b, offset); offset += this.args[i].length;
               while (offset % 4 != 0) {
                  b.writeUInt8(0, offset);
                  offset += 1;
               }
               break;
            default:
               throw new OSCBadType(this.typetagstring[i]);
         }
      }
      return b;
   },
   _padStr: function(buf, str, offset) {
      offset += buf.write(str, offset, str.length, 'ascii');
      buf.writeUInt8(0, offset);
      offset += 1
      while (offset % 4 != 0) {
         buf.writeUInt8(0, offset);
         offset += 1;
      }
      return offset;
   },
   _padLen: function(l) {
      l += 1;
      while (l % 4 != 0) l++;
      return l;
   },
   _reads: function(b, off) {
      var s = "";
      do {
         s += b.toString('ascii', off, off+4)
         off += 4
      } while (b.readUInt8(off-1) != 0);
      if (b.readUInt8(off-4) == 0) s = s.slice(0, -4);
      else if (b.readUInt8(off-3) == 0) s = s.slice(0, -3);
      else if (b.readUInt8(off-2) == 0) s = s.slice(0, -2);
      else if (b.readUInt8(off-1) == 0) s = s.slice(0, -1);
      return [s,off];
   }
};

exports.OSCMessage = OSCMessage;

function OSCPacket(arg) {
   this.dispatchStream = null;
   this.dispatchDatagram = null;
   this.packets = new Array();
   if (arg instanceof OSCMessage) {
      this.packets.push(arg);
   } else if (arg instanceof Array) {
      for (i in arg) {
         if (arg instanceof OSCMessage) {
            this.packets.push(arg);
         } else {
            throw "Argument must be an OSCMessage or an array of OSCMessages.";
         }
      }
   } else if (arg === undefined) {
      // do nothing
   } else {
      throw "Argument must be an OSCMessage or an array of OSCMessages.";
   }
};

OSCPacket.prototype = {
   push: function(packet) {
      if (packet instanceof OSCMessage) {
         this.packets.push(packet);
      } else {
         throw "Argument must be an OSCMessage.";
      }
   },
   sendToStream: function() {
      var pbufs = new Array();
      var sz = 0;
      for (i in this.packets) {
         var tmp = this.packets[i].toBuffer();
         sz += 4 + tmp.length;
         pbufs.push(tmp);
      }
      var b = new Buffer(sz);
      var offset = 0;
      for (i in pbufs) {
         b.writeUInt32BE(pbufs[i].length, offset); offset += 4;
         pbufs[i].copy(b, offset); offset += pbufs[i].length;
      }
      this.dispatchStream(b.toString('binary'));
   },
   sendDatagrams: function() {
      for (i in this.packets) {
         this.dispatchDatagram(this.packets[i].toBuffer().toString('binary'));
      }
   },
   send: function() {
      if (this.dispatchStream === null && this.dispatchDatagram === null) {
         throw "Must set either dispatchStream or dispatchDatagram";
      } else if (this.dispatchStream !== null && this.dispatchDatagram !== null) {
         throw "Can't set both dispatchStream and dispatchDatagram";
      } else if (this.dispatchStream !== null) {
         this.sendToStream();
      } else {
         this.sendDatagrams();
      }
   },
   recvFromStream: function(data) {
      var b = new Buffer(data, 'binary');
      var offset = 0;
      while (offset < b.length) {
         var sz = b.readUInt32BE(offset); offset += 4;
         var tmp = new Buffer(sz);
         b.copy(tmp, 0, offset, offset + sz); offset += sz;
         var m = new OSCMessage(tmp);
         this.packets.push(m);
      }
   },
   recvDatagram: function(data) {
      var m = new OSCMessage(new Buffer(data, 'binary'));
      this.packets.push(m);
   }
};

exports.OSCPacket = OSCPacket;
