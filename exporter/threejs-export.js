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

var threeJsExport = exports.threeJsExport = {};

threeJsExport.toFile = function(path, data) {
    var i, j, indexCount, vertexCount, color;

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

    var material;
    output.materials = [];
    for(i = 0; i < data.materials.length; ++i) {
        material = data.materials[i];

        output.materials.push({
            DbgColor: 16777215,
            DbgIndex: i,
            DbgName: material.shaderName,
            colorDiffuse: [Math.random(), Math.random(), Math.random()]
            //mapDiffuse : "no-shader.png"
        });
    }

    // We need to swizzle the Y and Z components, since Quake 3 uses a Z-up space
    output.vertices = [];
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

    output.colors = [];
    for(i = 0; i < vertexCount; ++i) {
        color = Utils.colorToVec(data.geometry.attribs.color[i]);
        output.colors.push(color[0]);
        output.colors.push(color[1]);
        output.colors.push(color[2]);
    }
    
    indexCount = data.geometry.indices.length;

    var mesh, meshCount = data.geometry.meshes.length;
    var lastIndex;

    output.faces = [];
    for(i = 0; i < meshCount; ++i) {
        mesh = data.geometry.meshes[i];

        lastIndex = mesh.firstIndex + mesh.indexCount;
        for(j = mesh.firstIndex; j < lastIndex; j += 3) {
            output.faces.push(170); // Face type mask

            output.faces.push(data.geometry.indices[j+0]);
            output.faces.push(data.geometry.indices[j+1]);
            output.faces.push(data.geometry.indices[j+2]);

            output.faces.push(mesh.material);

            output.faces.push(data.geometry.indices[j+0]);
            output.faces.push(data.geometry.indices[j+1]);
            output.faces.push(data.geometry.indices[j+2]);

            output.faces.push(data.geometry.indices[j+0]);
            output.faces.push(data.geometry.indices[j+1]);
            output.faces.push(data.geometry.indices[j+2]);

            output.faces.push(data.geometry.indices[j+0]);
            output.faces.push(data.geometry.indices[j+1]);
            output.faces.push(data.geometry.indices[j+2]);
        }
    }

    fs.writeFile(path, JSON.stringify(output, null, "\t"), function (err) {
        if (err) throw err;
        console.log('Exported');
    });
};