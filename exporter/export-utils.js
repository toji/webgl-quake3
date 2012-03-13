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

var glMatrix = require("./util/gl-matrix-min");

var Utils = exports.Utils = {};

Utils.generateNormals = function(positions, indices) {
    var i, idx;
    var vertCount = positions.length / 3;
    var normals = [];

    for(i = 0; i < vertCount; ++i) {
        normals.push([0, 0, 0]);
    }

    // Calculate normals/tangents
    
    var a = [0, 0, 0], b = [0, 0, 0];
    var triNormal = [0, 0, 0];

    var idx1, idx2, idx3;
    var pos1, pos2, pos3;

    for(i = 0; i < indices.length; i+=3) {
        idx1 = indices[i];
        pos1 = [
            positions[idx1*3 + 0],
            positions[idx1*3 + 1],
            positions[idx1*3 + 2]
        ];

        idx2 = indices[i+1];
        pos2 = [
            positions[idx2*3 + 0],
            positions[idx2*3 + 1],
            positions[idx2*3 + 2]
        ];

        idx3 = indices[i+2];
        pos3 = [
            positions[idx3*3 + 0],
            positions[idx3*3 + 1],
            positions[idx3*3 + 2]
        ];
        
        // Normal
        vec3.subtract(pos2, pos1, a);
        vec3.subtract(pos3, pos1, b);

        vec3.cross(b, a, triNormal);
        vec3.add(normals[idx1], triNormal);
        vec3.add(normals[idx2], triNormal);
        vec3.add(normals[idx3], triNormal);
    }

    var normAttrib = [];

    // Get the normalized vectors
    for(i = 0; i < vertCount; ++i) {
        vec3.normalize(normals[i]);

        normAttrib.push(normals[i][0]);
        normAttrib.push(normals[i][1]);
        normAttrib.push(normals[i][2]);
    }

    return normAttrib;
};