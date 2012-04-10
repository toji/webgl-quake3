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

var fs = require("fs");
var zipfile = require("zipfile");

var PakFile = exports.PakFile = function(path) {
    this.paks = [];

    var files = fs.readdirSync(path);
    var i, file, data;

    for(i in files) {
        file = files[i];
        if(/^.*\.pk3$/.test(file)) {
            this.paks.push(new zipfile.ZipFile(path + "/" + file));
        }
    }
};

PakFile.prototype.readFile = function(name) {
    var i, pak;

    for(i in this.paks) {
        pak = this.paks[i];
        if(pak.names.indexOf(name) != -1) {
            return pak.readFileSync(name);
        }
    }

    return null;
};

PakFile.prototype.readFileList = function(expr) {
    var files = {};
    var i, j, pak, name;

    for(i in this.paks) {
        pak = this.paks[i];
        for(j in pak.names) {
            name = pak.names[j];
            if(expr.test(name)) {
                files[name] = pak.readFileSync(name);
            }
        }
    }

    return files;
};

PakFile.prototype.findFile = function(expr) {
    var i, j, pak, name;

    for(i in this.paks) {
        pak = this.paks[i];
        for(j in pak.names) {
            name = pak.names[j];
            if(expr.test(name)) {
                return { name: name, pak: pak };
            }
        }
    }

    return null;
};

PakFile.prototype.listFileNames = function(expr) {
    var files = [];
    var i, j, pak, name;

    for(i in this.paks) {
        pak = this.paks[i];
        for(j in pak.names) {
            name = pak.names[j];
            if(expr.test(name)) {
                files.push(name);
            }
        }
    }

    return files;
};
