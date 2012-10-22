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
 * Multiplier to encode ms as fixed point.
 */
var MS_ENCODE = 4294967.295;

/**
 * Read an OSCTimeTag from a buffer and convert to a Javascript Date object.
 * @param {Uint32Array} buffer
 * @return The Date or null if the time tag is an "immediate"
 */
function ReadOSCTimeTag(buffer) {
    var seconds = buffer[0];
    var subseconds = buffer[1];
    if (seconds == 0 && subseconds == 1) { // special case indicate immediate
        return null;
    }
    seconds -= EPOCH_ADJUST;
    subseconds /= MS_ENCODE;
    var d = new Date();
    d.setTime(seconds * 1000 + subseconds);
    return d;
}

/**
 * Write a Javascript Date object to a DataView as an OSCTimeTag
 * @param {Date} d The Date object or null to write an "immediate" time tag
 * @param {Uint32Array} buffer
 */
function WriteOSCTimeTag(d, buffer) {
    if (d == null) { // immediate
        buffer[0] = 0;
        buffer[1] = 1;
        return 8;
    }
    buffer[0] = Math.floor(d.getTime() / 1000) + EPOCH_ADJUST;
    buffer[1] = d.getMilliseconds() * MS_ENCODE;
}

function padStr(buf, str, offset) {
   for (var i = 0; i < str.length; ++i) {
      buf.setUint8(offset++, str.charCodeAt(i));
   }
   buf.setUint8(offset++, 0);
   while (offset % 4 != 0) {
      buf.setUint8(offset++, 0);
   }
   return offset;
}

function reads(b, off) {
   var s = "";
   do {
      s += String.fromCharCode(b.getUint8(off++));
      s += String.fromCharCode(b.getUint8(off++));
      s += String.fromCharCode(b.getUint8(off++));
      s += String.fromCharCode(b.getUint8(off++));
   } while (b.getUint8(off-1) != 0);
   if (b.getUint8(off-4) == 0) s = s.slice(0, -4);
   else if (b.getUint8(off-3) == 0) s = s.slice(0, -3);
   else if (b.getUint8(off-2) == 0) s = s.slice(0, -2);
   else if (b.getUint8(off-1) == 0) s = s.slice(0, -1);
   return [s,off];
}

function padLen(l) {
   l += 1;
   while (l % 4 != 0) l++;
   return l;
}

var OSCMessage = Class.create({
    /**
     * Construct an OSCMessage
     * @param arg Overloaded parameter can be a string indicating an OSC address,
     *        an ArrayBuffer or DataView containing the message which will be parsed, or
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
           } else if (arg instanceof DataView) {
              this.fromBuffer(arg);
           } else if (arg instanceof ArrayBuffer) {
              this.fromBuffer(new DataView(arg, 0));
           } else if (arg === undefined) {
              this.address = '';
              this.typetagstring = '';
              this.args = [];
           } else {
              throw "Argument must be an address string or a buffer object.";
           }
        },
   /**
    * Read an OSCMessage from a buffer DataView.
    * @param {DataView} b
    */
   fromBuffer: function(b) {
      var offset = 0;
      var tmp = reads(b,offset); offset = tmp[1]; this.address = tmp[0];
      if (this.address === "#bundle") {
         throw "OSCBundle not supported."
      } else if (this.address[0] != '/') {
         throw "Invalid message address.";
      }
      tmp = reads(b,offset); offset = tmp[1]; this.typetagstring = tmp[0];
      this.args = []
      for (var i = 1; i < this.typetagstring.length; ++i) {
         switch (this.typetagstring[i]) {
            case 'i':
               this.args.push(b.getInt32(offset)); offset += 4;
               break;
            case 'f':
               this.args.push(b.getFloat32(offset)); offset += 4;
               break;
            case 's':
               tmp = reads(b,offset); offset = tmp[1]; this.args.push(tmp[0]);
               break;
            case 'b':
            {
               // Create a new view into the array
               var len = b.getInt32(offset); offset += 4;
               var blobView = new DataView(b.buffer, b.byteOffset + offset, len);
               offset += len;
               offset += len % 4; // the len doesn't include padding to 32-bits
               this.args.push(blobView);
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
         } else if (arg instanceof ArrayBuffer) {
            arg = new DataView(arg, 0);
            type = 'b';
         } else if (arg instanceof DataView) {
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
      var r = "<OSCMessage [" + this.size() + '] "' + this.address + '" : ' + this.typetagstring + " : ";
      for (var i = 0; i < this.args.length; ++i) {
         if (this.args[i] instanceof DataView) {
            r += " " + "<Buffer length " + this.args[i].byteLength + ">";
         } else if (typeof(this.args[i]) === 'string') {
            r += ' "' + this.args[i] + '"';
         } else {
            r += " " + this.args[i].toString();
         }
      }
      return r + ">";
   },
   /**
    * Calculate the size of the OSCMessage in bytes.
    * This method dynamically calculates the size so it is best to
    * store the result instead of calling this multiple times in a tight loop.
    * @type Number
    */
   size: function() {
      var sz = padLen(this.address.length) + padLen(this.typetagstring.length);
      for (var i = 0; i < this.args.length; ++i) {
         switch(this.typetagstring[i+1]) {
            case 'i':
            case 'f':
               sz += 4;
               break;
            case 's':
               sz += padLen(this.args[i].length);
               break;
            case 'b':
               sz += padLen(this.args[i].byteLength) + 4;
               break;
            default:
               throw new OSCBadType(this.typetagstring[i]);
         }
      }
      return sz;
   },
   /**
    * Write the OSCMessage to a buffer.
    * The ArrayBuffer will be created and returned.
    * @type ArrayBuffer
    */
   toBuffer: function(b) {
      if (this.address[0] != '/') {
         throw "Invalid OSCMessage address";
      }
      if (b == undefined) {
         var ab = new ArrayBuffer(this.size());
         b = new DataView(ab, 0);
      }
      var offset = 0;
      offset = padStr(b, this.address, offset);
      offset = padStr(b, this.typetagstring, offset);
      for (var i = 0; i < this.args.length; ++i) {
         switch(this.typetagstring[i+1]) {
            case 'i':
               b.setInt32(offset, this.args[i]); offset += 4;
               break;
            case 'f':
               b.setFloat32(offset, this.args[i]); offset += 4;
               break;
            case 's':
               offset = padStr(b, this.args[i], offset);
               break;
            case 'b':
               b.setInt32(offset, this.args[i].length); offset += 4;
               for (var i = 0; i < this.args[i].byteLength; ++i) {
                  b.setUint8(offset+i, this.args[i].getUint8(i));
               }
               offset += this.args[i].length;
               while (offset % 4 != 0) {
                  b.setUint8(offset, 0);
                  ++offset;
               }
               break;
            default:
               throw new OSCBadType(this.typetagstring[i]);
         }
      }
      return b.buffer;
   }
});

var OSCBundle = Class.create({
    /**
     * Construct an OSCBundle
     *
     * @param arg Overloaded argument which can be an ArrayBuffer or DataView to load the
     *            bundle from the buffer or undefined to default initialize.
     */
    initialize: function(arg) {
           if (arg == undefined) {
              this.timetag = new Date();
              this.elements = new Array();
           } else if (arg instanceof DataView) {
              this.elements = new Array();
              this.fromBuffer(arg);
           } else if (arg instanceof ArrayBuffer) {
              this.elements = new Array();
              this.fromBuffer(new DataView(arg, 0));
           } else {
              throw "Argument must undefined or a Buffer.";
           }
        },
   /**
    * Read an OSCBundle from a buffer.
    * @param {DataView} b
    */
   fromBuffer: function(b) {
      if (!OSCBundle.isBundle(b)) {
         throw new OSCBadType("Element is not a bundle.");
      }
      this.timetag = ReadOSCTimeTag(new Uint32Array(b.buffer, b.byteOffset + 8, 2));
      var offset = 16;
      while (offset < b.byteLength) {
         var sz = b.getUint32(offset); offset += 4;
         var tmp = new DataView(b.buffer, b.byteOffset + offset, sz); offset += sz;
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
      for (var i = 0; i < this.elements.length; ++i) {
         sz += 4 + this.elements[i].size();
      }
      return sz;
   },
   /**
    * Write the OSCBundle to a buffer.
    * The buffer will be created and returned.
    * @type Buffer
    */
   toBuffer: function(v) {
      if (v == undefined) {
         b = new ArrayBuffer(this.size());
         v = new DataView(b, 0);
      }
      var offset = padStr(v, "#bundle", 0);
      WriteOSCTimeTag(this.timetag, new Uint32Array(v.buffer, v.byteOffset + offset, 2)); offset += 8;
      for (var i = 0; i < this.elements.length; ++i) {
         var sz = this.elements[i].size();
         v.setUint32(offset, sz); offset += 4;
         this.elements[i].toBuffer(new DataView(v.buffer, v.byteOffset + offset, sz));
         offset += sz;
      }
      return v.buffer;
   },
});

/**
 * Static class method which reads the first 8 bytes from the buffer
 * to determine if it is a bundle.
 * @param {Buffer} b
 * @type boolean
 */
OSCBundle.isBundle = function(b) {
      return reads(b, 0)[0] == "#bundle";
   }

exports.ReadOSCTimeTag = ReadOSCTimeTag;
exports.WriteOSCTimeTag = WriteOSCTimeTag;
exports.OSCMessage = OSCMessage;
exports.OSCBundle = OSCBundle;
