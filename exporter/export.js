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
var PakFile = require("./pakfile").PakFile;
var q3bspParser = require("./q3bsp-parser").q3bspParser;
var q3shaderParser = require("./q3shader-parser").q3shaderParser;
var textureUtil = require("./texture-util");
var threeJsExport = require("./threejs-export").threeJsExport;

var path = process.argv[2];
var map = process.argv[3];
var outputFolder = process.argv[4] || "../export";

if(!path) {
    console.log("No base path specified");
    return;
}

var pak = new PakFile(path);

if(!map) {
    console.log("No map name specified");
    console.log("Available maps:", pak.listFileNames(/^.*\.bsp$/));
    return;
}

var mapFile = pak.readFile("maps/" + map + ".bsp");

if(!mapFile) {
    console.log("Could not find map:", map + ".bsp");
    return;
}

q3bspParser.parse(mapFile, 5, function(data) {
    console.log("Map loaded");

    var shaders = q3shaderParser.parseList(pak.readFileList(/^.*\.shader$/));
    console.log("Shaders loaded");

    var lightmapPath = "textures/" + map + "/lightmap.png";
    textureUtil.writeCanvasToPng(outputFolder, lightmapPath, data.lightmapCanvas);

    console.log("Exporting textures");
    textureUtil.exportTextures(outputFolder, shaders, data, lightmapPath, pak);
    console.log("Textures exported");

    var materials = q3shaderParser.compileMapMaterials(shaders, data, lightmapPath);
    console.log("Materials compiled");

    threeJsExport.geometryToFile(outputFolder + "/" + map + ".json", materials, data);
    threeJsExport.materialsToFile(outputFolder + "/" + map + ".materials.json", materials, data, lightmapPath);
    threeJsExport.collisionHullsToFile(outputFolder + "/" + map + ".collision.json", data);
});


