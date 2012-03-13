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
var Utils = require("./export-utils").Utils;

console.log("Utils:", Utils);

var threeJsExport = exports.threeJsExport = {};

threeJsExport.toFile = function(path, data) {
    var i, indexCount, vertexCount;

    vertexCount = data.geometry.attribs.position.length;
    indexCount = data.geometry.indices.length;

    var normals = Utils.generateNormals(data.geometry.attribs.position, data.geometry.indices);

    var output = {
        metadata : {
            formatVersion: 3,
            generatedBy: "quake3-exporter",
            vertices: vertexCount / 3,
            faces: indexCount / 3,
            description: data.entities.worldspawn[0].message
        },

        materials: [{
            DbgColor: 16777215,
            DbgIndex: 0,
            DbgName: "default_mat",
            mapDiffuse : "no-shader.png"
        }]
    };


    output.vertices = []; ;
    for(i = 0; i < vertexCount; i+=3) {
        output.vertices.push(data.geometry.attribs.position[i+0]);
        output.vertices.push(data.geometry.attribs.position[i+2]);
        output.vertices.push(data.geometry.attribs.position[i+1]);
    }

    output.normals = [];
    for(i = 0; i < vertexCount; i+=3) {
        output.normals.push(normals[i+0]);
        output.normals.push(normals[i+2]);
        output.normals.push(normals[i+1]);
    }

    output.uvs = [data.geometry.attribs.texCoord];
    output.uvs2 = [data.geometry.attribs.lightmapCoord];
    output.colors = []; //data.geometry.attribs.colors;
    
    indexCount = data.geometry.indices.length;

    output.faces = [];
    for(i = 0; i < indexCount; i+=3) {
        output.faces.push(32); // Face type mask (Triangles, Pos + Normal)
        output.faces.push(data.geometry.indices[i+0]);
        output.faces.push(data.geometry.indices[i+1]);
        output.faces.push(data.geometry.indices[i+2]);

        output.faces.push(data.geometry.indices[i+0]);
        output.faces.push(data.geometry.indices[i+1]);
        output.faces.push(data.geometry.indices[i+2]);
    }

    

    fs.writeFile(path, JSON.stringify(output, null, "\t"), function (err) {
        if (err) throw err;
        console.log('Exported');
    });
};