/*
 * binFile.js - Binary Stream Reader
 * version 1.0
 */
 
/*
 * Copyright (c) 2011 Brandon Jones
 *
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 *    1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 *
 *    2. Altered source versions must be plainly marked as such, and must not
 *    be misrepresented as being the original software.
 *
 *    3. This notice may not be removed or altered from any source
 *    distribution.
 */

var BinaryFile = exports.BinaryFile = function(data) {
    this.buffer = data;
    this.length = data.length;
    this.offset = 0;
};

BinaryFile.prototype.eof = function() {
    this.offset >= this.length;
}

// Seek to the given byt offset within the stream
BinaryFile.prototype.seek = function(offest) {
    this.offset = offest;
};

// Seek to the given byt offset within the stream
BinaryFile.prototype.tell = function() {
    return this.offset;
};

// Read a signed byte from the stream
BinaryFile.prototype.readByte = function() {
    var value = this.buffer.readInt8(this.offset);
    this.offset += 1;
    return value;
};

// Read an unsigned byte from the stream
BinaryFile.prototype.readUByte = function() {
    var value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
};

// Read a signed short (2 bytes) from the stream
BinaryFile.prototype.readShort = function() {
    var value = this.buffer.readInt16LE(this.offset);
    this.offset += 2;
    return value;
};

// Read an unsigned short (2 bytes) from the stream
BinaryFile.prototype.readUShort = function() {
    var value = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
};

// Read a signed long (4 bytes) from the stream
BinaryFile.prototype.readLong = function() {
    var value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
};

// Read an unsigned long (4 bytes) from the stream
BinaryFile.prototype.readULong = function() {
    var value = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
};

// Read a float (4 bytes) from the stream
BinaryFile.prototype.readFloat = function() {
    var value = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    return value;
};

// Read an ASCII string of the given length from the stream
BinaryFile.prototype.readString = function(length) {
    var str = this.buffer.toString('utf8', this.offset, this.offset + length).replace(/\0+$/,'');
    this.offset += length;
    return str;
};
