/* 
 * binFile.js - High performance Binary Reader
 * version 0.1
 */
 
/*
 * Copyright (c) 2010 Brandon Jones
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

BinaryFile = function(data) {
	this.buffer = data;
	this.length = data.length;
	this.offset = 0;
};

// TODO: Just use offset directly?
BinaryFile.prototype.seek = function(offest) {
	this.offset = offest;
};

BinaryFile.prototype.readByte = function() {
	var b0 = this.buffer.charCodeAt(this.offset) & 0xff;
	this.offset += 1;
	return b0;
};

BinaryFile.prototype.readUByte = function() {
	var b0 = this.buffer.charCodeAt(this.offset) & 0xff;
	this.offset += 1;
	return b0;
};

BinaryFile.prototype.readShort = function() {
	var off = this.offset;
	var buf = this.buffer;
	var b0 = buf.charCodeAt(off) & 0xff;
	var b1 = buf.charCodeAt(off+1) & 0xff;
	this.offset += 2;
	return b0 + (b1 << 8);
};

BinaryFile.prototype.readUShort = function() {
	var off = this.offset;
	var buf = this.buffer;
	var b0 = buf.charCodeAt(off) & 0xff;
	var b1 = buf.charCodeAt(off+1) & 0xff;
	this.offset += 2;
	return b0 + (b1 << 8);
};

BinaryFile.prototype.readLong = function() {
	var off = this.offset;
	var buf = this.buffer;
	var b0 = buf.charCodeAt(off) & 0xff;
	var b1 = buf.charCodeAt(off+1) & 0xff;
	var b2 = buf.charCodeAt(off+2) & 0xff;
	var b3 = buf.charCodeAt(off+3) & 0xff;
	this.offset += 4;
	var result = (b0 + (b1 << 8) + (b2 << 16) + (b3 << 24)); //??? This concerns me...
	//return result & 0x7FFFFFFF - result & 0x80000000;
	return result;
};

BinaryFile.prototype.readULong = function() {
	var off = this.offset;
	var buf = this.buffer;
	var b0 = buf.charCodeAt(off) & 0xff;
	var b1 = buf.charCodeAt(off+1) & 0xff;
	var b2 = buf.charCodeAt(off+2) & 0xff;
	var b3 = buf.charCodeAt(off+3) & 0xff;
	this.offset += 4;
	return b0 + (b1 << 8) + (b2 << 16) + (b3 << 24);
};

var bin_log2 = Math.log(2);

// Code "borrowed" from Google's Numbers.java file in the GWT Quake2 port 
BinaryFile.prototype.readFloat = function() {
	var i = this.readLong(); // TODO: inline
	var exponent = (i >>> 23) & 255;
	var significand = i & 0x007fffff;
	var result;
	if (exponent == 0) {
		result = (Math.exp((-126 - 23) * bin_log2) * significand);
	} else if (exponent == 255) {
		result = significand == 0 ? +Infinity : NaN;
	} else {
		result = (Math.exp((exponent - 127 - 23) * bin_log2) * (0x00800000 | significand));
	}
	return (i & 0x80000000) == 0 ? result : -result;
};

BinaryFile.prototype.readString = function(length) {
	var str = this.buffer.substr(this.offset, length).replace(/\0+$/,'');
	this.offset += length;
	return str;
};
