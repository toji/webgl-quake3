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

var q3bspParser = require("./q3bsp-parser").q3bspParser;
var q3shaderParser = require("./q3shader-parser").q3shaderParser;
var threeJsExport = require("./threejs-export").threeJsExport;

var path = process.argv[2];

if(!path) {
    console.log("No BSP path provided");
}

q3shaderParser.load("../demo_baseq3/scripts/web_demo.shader", function(shaders) {
    fs.writeFile('shaders-output.js', JSON.stringify(shaders, null, "\t"), function (err) {
        if (err) throw err;
        console.log('Shaders Exported');
    });

    q3bspParser.load(path, 5, function(data) {
        console.log("Parse complete");
        threeJsExport.toFile("output.js", shaders, data);
        threeJsExport.shadersToFile("material-output.js", shaders, data);
    });
});


