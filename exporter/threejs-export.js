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

var DEFAULT_VERTEX = [
    "varying vec2 vTexCoord;",
    "varying vec2 vLightmapCoord;",
    "varying vec3 vColor;",

    "void main(void) {",
    "    vec4 worldPosition = modelViewMatrix * vec4(position, 1.0);",
    "    vTexCoord = uv;",
    "    vColor = color;",
    "    vLightmapCoord = uv2;",
    "    gl_Position = projectionMatrix * worldPosition;",
    "}"
].join("\n");

var DEFAULT_FRAGMENT = [
    "uniform sampler2D texture;",
    "uniform sampler2D lightmap;",

    "varying vec2 vTexCoord;",
    "varying vec2 vLightmapCoord;",

    "void main(void) {",
    "    vec4 diffuseColor = texture2D(texture, vTexCoord);",
    "    vec4 lightColor = texture2D(lightmap, vLightmapCoord);",
    "    gl_FragColor = vec4(diffuseColor.rgb * lightColor.rgb, diffuseColor.a);",
    "}"
].join("\n");

var MODEL_FRAGMENT = [
    "uniform sampler2D texture;",

    "varying vec2 vTexCoord;",
    "varying vec3 vColor;",

    "void main(void) {",
    "    vec4 diffuseColor = texture2D(texture, vTexCoord);",
    "    gl_FragColor = vec4(diffuseColor.rgb * vColor, diffuseColor.a);",
    "}"
].join("\n");

var threeJsExport = exports.threeJsExport = {};

threeJsExport.toFile = function(path, shaders, data) {
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
        }
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
        output.vertices.push(-data.geometry.attribs.position[i+1]);
    }

    output.normals = [];
    for(i = 0; i < vertexCount; i+=3) {
        output.normals.push(normals[i+0]);
        output.normals.push(normals[i+2]);
        output.normals.push(-normals[i+1]);
    }

    output.uvs = [data.geometry.attribs.texCoord, data.geometry.attribs.lightmapCoord];

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
    var i0, i1, i2;

    output.faces = [];
    for(i = 0; i < meshCount; ++i) {
        mesh = data.geometry.meshes[i];

        lastIndex = mesh.firstIndex + mesh.indexCount;
        for(j = mesh.firstIndex; j < lastIndex; j += 3) {
            output.faces.push(170); // Face type mask

            i0 = data.geometry.indices[j+2];
            i1 = data.geometry.indices[j+1];
            i2 = data.geometry.indices[j+0];

            output.faces.push(i0);
            output.faces.push(i1);
            output.faces.push(i2);

            output.faces.push(mesh.material);

            output.faces.push(i0);
            output.faces.push(i1);
            output.faces.push(i2);

            output.faces.push(i0);
            output.faces.push(i1);
            output.faces.push(i2);

            output.faces.push(i0);
            output.faces.push(i1);
            output.faces.push(i2);

            output.faces.push(i0);
            output.faces.push(i1);
            output.faces.push(i2);
        }
    }

    fs.writeFile(path, JSON.stringify(output, null, "\t"), function (err) {
        if (err) throw err;
        console.log('Mesh Exported');
    });
};

threeJsExport.shadersToFile = function(path, shaders, data) {
    var i;

    var materials = {};

    var material, shader;
    for(i = 0; i < data.materials.length; ++i) {
        material = data.materials[i];

        shader = shaders[material.shaderName];
        if(shader) {
            materials[material.shaderName] = threeJsExport.materialToThreeJs(shader);
        } else {
            materials[material.shaderName] = threeJsExport.defaultMaterialToThreeJs(material);
        }
    }

    fs.writeFile(path, JSON.stringify(materials, null, "\t"), function (err) {
        if (err) throw err;
        console.log('Materials Exported');
    });
};

threeJsExport.materialToThreeJs = function(material) {
    var name, type, value, shaderUni, uniform, textureId = 0, uniforms = {};

    for(name in material.shader.uniforms) {
        shaderUni = material.shader.uniforms[name];
        uniform = {};

        // skip some of the uniforms that three.js handles
        if(name === "modelViewMatrix" || name === "projectionMatrix") {
            delete material.shader.uniforms[name];
            continue;
        }

        switch(shaderUni.type) {
            case "float": uniform.type = "f"; break;
            case "vec2": uniform.type = "v2"; break;
            case "vec3": uniform.type = "v3"; break;
            case "vec4": uniform.type = "v4"; break;
            case "sampler2D":
                uniform.type = "t";
                uniform.value = textureId++;

                if(shaderUni.src == "$lightmap") {
                    uniform.texture = "lightmap.png";
                } else {
                    uniform.texture = shaderUni.src;
                }

                if(shaderUni.clamp) { uniform.clamp = shaderUni.clamp; }
                
                break;
        }

        uniforms[name] = uniform;
    }

    var vertexShader = Utils.getVertexSource(material.shader, {attrib: false});
    vertexShader = vertexShader.replace(/texCoord/g, "uv").replace(/lightCoord/g, "uv2");

    var fragmentShader = Utils.getFragmentSource(material.shader, {precision: false});

    var threeMaterial = {
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader
    };

    if(material.blend) { threeMaterial.transparent = true; }

    return threeMaterial;
};

threeJsExport.defaultMaterialToThreeJs = function(material) {
    var uniforms = {
        texture: { type: "t", value: 0, texture: material.shaderName + ".png" },
        lightmap: { type: "t", value: 1, texture: "lightmap.png" }
    };

    return {
        uniforms: uniforms,
        vertexShader: DEFAULT_VERTEX,
        fragmentShader: DEFAULT_FRAGMENT
    };
};

threeJsExport.modelMaterialToThreeJs = function(material) {
    var uniforms = {
        texture: { type: "t", value: 0, texture: material.shaderName + ".png" }
    };

    return {
        uniforms: uniforms,
        vertexShader: DEFAULT_VERTEX,
        fragmentShader: MODEL_FRAGMENT
    };
};