/*
 * Copyright (c) 2009 Brandon Jones
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

var threeJsExport = exports.threeJsExport = {};

threeJsExport.toFile = function(path, data) {

    var output = {
        metadata : {
            formatVersion: 3,
            generatedBy: "quake3-exporter",
            vertices: data.geometry.attribs.position.length / 3,
            faces: data.geometry.indices.length / 3,
            description: data.entities.worldspawn[0].message
        },

        materials: [{
            DbgColor: 16777215,
            DbgIndex: 0,
            DbgName: "default_mat"
        }]
    };


    output.vertices = data.geometry.attribs.position;
    output.normals = [];
    output.uvs = [data.geometry.attribs.texCoord];
    output.uvs2 = [data.geometry.attribs.lightmapCoord];
    output.colors = []; //data.geometry.attribs.colors;
    
    output.faces = data.geometry.indices;

    fs.writeFile(path, JSON.stringify(output, null, "\t"), function (err) {
        if (err) throw err;
        console.log('Exported');
    });
};