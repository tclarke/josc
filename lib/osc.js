var prototype = require('prototype');

/**
 * Base OSC error type.
 * @param {String} message
 *	  Message for the user.
 */
var OSCError = Class.create({
    initialize: function(message) {
                    this.message = "OSC: " + message; 
                }
    });

/**
 * OSC bad type error type.
 * @param {String} message
 */
var OSCBadType = Class.create(OSCError, {
    initialize: function(message) {
                    this.message = "OSCBadType: " + message;
                }
    });

/**
 * Number of seconds from January 1, 1900 to January 1, 1970.
 * Used to adjust between the POSIX epoch and the OSC epoch
 */
var EPOCH_ADJUST = 2208988800;

/**
 * Read an OSCTimeTag from a buffer and convert to a Javascript Date object.
 * @param {Buffer} buffer
 * @param {Number} offset
 * @return The Date or null if the time tag is an "immediate"
 */
function ReadOSCTimeTag(buffer, offset) {
    var seconds = buffer.readUInt32BE(offset); offset += 4;
    var subseconds = buffer.readUInt32BE(offset); offset += 4;
    if (seconds == 0 && subseconds == 1) { // special case indicate immediate
        return null;
    }
    seconds -= EPOCH_ADJUST;
    var d = new Date();
    d.setTime(seconds);
    d.setMilliseconds(subseconds);
    return d;
}

/**
 * Write a Javascript Date object to a buffer as an OSCTimeTag
 * @param {Date} d The Date object or null to write an "immediate" time tag
 * @param {Buffer} b
 * @param {Number} offset
 * @return The buffer offset after the time tag.
 */
function WriteOSCTimeTag(d, b, offset) {
    if (d == null) { // immediate
        b.writeUInt32BE(0, offset); offset += 4;
        b.writeUInt32BE(1, offset); offset += 4;
        return offset;
    }
    var seconds = Math.floor(d.getTime() / 1000) + EPOCH_ADJUST;
    var subseconds = d.getMilliseconds() * 1e6;
    b.writeUInt32BE(seconds, offset); offset += 4;
    b.writeUInt32BE(subseconds, offset); offset += 4;
    return offset;
}

var OSCMessage = Class.create({
    /**
     * Construct an OSCMessage
     * @param arg Overloaded parameter can be a string indicating an OSC address,
     *            a Buffer containing the message which will be parsed, or
     *	      undefined to initialize default values.
     */
    initialize: function(arg) {
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
        },
   /**
    * Read an OSCMessage from a buffer.
    * @param {Buffer} b
    */
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
   /**
    * Add a new arg to the OSCMessage.
    * @param arg The new argument value.
    * @param type The optional OSCMessage type string. If undefined,
    *             the type will be guessed from arg.
    */
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
   /**
    * Convert the OSCMessage to a string suitable for display.
    * @type string
    */
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
   /**
    * Calculate the size of the OSCMessage in bytes.
    * This method dynamically calculates the size so it is best to
    * store the result instead of calling this multiple times in a tight loop.
    * @type Number
    */
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
   /**
    * Write the OSCMessage to a buffer.
    * The buffer will be created and returned.
    * @type Buffer
    */
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
});

var OSCBundle = Class.create({
    /**
     * Construct an OSCBundle
     *
     * @param arg Overloaded argument which can be a Buffer to load the
     *            bundle from the buffer or undefined to default initialize.
     */
    initialize: function(arg) {
           if (arg == undefined) {
              this.timetag = new Date();
              this.elements = new Array();
           } else if (arg instanceof Buffer) {
              this.elements = new Array();
              this.fromBuffer(arg);
           } else {
              throw "Argument must undefined or a Buffer.";
           }
        },
   /**
    * Read an OSCBundle from a buffer.
    * @param {Buffer} b
    */
   fromBuffer: function(b) {
      if (!OSCBundle.isBundle(b)) {
         throw new OSCBadType("Element is not a bundle.");
      }
      this.timetag = ReadOSCTimeTag(b, 8);
      var offset = 16;
      while (offset < b.length) {
         var sz = b.readUInt32BE(offset); offset += 4;
         var tmp = new Buffer(sz);
         b.copy(tmp, 0, offset, offset + sz); offset += sz;
         if (OSCBundle.isBundle(tmp)) {
            this.elements.push(new OSCBundle(tmp));
         } else {
            this.elements.push(new OSCMessage(tmp));
         }
      }
   },
   /**
    * Add a new element to the OSCBundle.
    * @param element An OSCBundle or OSCMessage to add to the bundle.
    */
   push: function(element) {
      if (element instanceof OSCBundle || element instanceof OSCMessage) {
         this.elements.push(element);
      } else {
         throw "Element must be an OSCMessage or an OSCBundle";
      }
   },
   /**
    * Calculate the size of the OSCBundle in bytes.
    * This method dynamically calculates the size so it is best to
    * store the result instead of calling this multiple times in a tight loop.
    * @type Number
    */
   size: function() {
      var sz = 8 + 8;
      for (i in this.elements) {
         sz += 4 + this.elements[i].size();
      }
      return sz;
   },
   /**
    * Write the OSCBundle to a buffer.
    * The buffer will be created and returned.
    * @type Buffer
    */
   toBuffer: function() {
      var b = new Buffer(this.size());
      b.write("#bundle", 0, 7, 'ascii');
      b.writeUInt8(0, 7);
      var offset = 8;
      offset = WriteOSCTimeTag(this.timetag, b, offset);
      for (i in this.elements) {
         var ebuf = this.elements[i].toBuffer();
         b.writeUInt32BE(ebuf.length, offset); offset += 4;
         ebuf.copy(b, offset); offset += ebuf.length;
      }
      return b;
   },
});

/**
 * Static class method which reads the first 8 bytes from the buffer
 * to determine if it is a bundle.
 * @param {Buffer} b
 * @type boolean
 */
OSCBundle.isBundle = function(b) {
      return b.toString('ascii', 0, 7) == "#bundle";
   }

exports.ReadOSCTimeTag = ReadOSCTimeTag;
exports.WriteOSCTimeTag = WriteOSCTimeTag;
exports.OSCMessage = OSCMessage;
exports.OSCBundle = OSCBundle;
