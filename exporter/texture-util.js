var fs = require("fs");
var path = require('path');
var Canvas = require("canvas");

function ensureFilePathExists(filePath) {
    if(!filePath) { return; }

    var idx = filePath.lastIndexOf("/");
    var dir = filePath.substring(0, idx);

    if(dir) {
        ensureDirExists(dir);
    }
}

function ensureDirExists(dirPath) {
    if(!dirPath || path.existsSync(dirPath)) { return; }

    var idx = dirPath.lastIndexOf("/");
    var dir = dirPath.substring(0, idx);

    if(dir) {
        ensureDirExists(dir);
    }

    if(idx != dirPath.length - 1) {
        try {
            fs.mkdirSync(dirPath);
        } catch(ex) {
            // Don't care if the dir already exists
        }
    }
}

function exportTexture(outputFolder, name, pak) {
    var ext;

    // Don't re-write if there's already a texture there
    if(path.existsSync(outputFolder + "/" + name + ".jpg")) {
        return name + ".jpg";
    }
    if(path.existsSync(outputFolder + "/" + name + ".png")) { 
        return name + ".png";
    }

    var entry = pak.findFile(new RegExp(name + ".*$"));

    if(entry) {
        ext = entry.name.substring(entry.name.length - 3);
        if(ext === "jpg") {
            return exportJpg(outputFolder, entry);
        } else if(ext === "tga") {
            // WTF?
            console.log("TGA not yet supported:", entry.name);
        } else {
            console.log("Unknown Texture type:", entry.name);
        }
    } else {
        console.log("No Texture found:", name);
    }

    return null;
}

function exportJpg(outputFolder, entry) {
    //var img = new Canvas.Image();
    var exportPath = outputFolder + "/" + entry.name;
    var file;

    if(!path.existsSync(exportPath)) { // Don't re-write if there's already a texture there
        console.log("Exporting:", exportPath);
        ensureFilePathExists(exportPath);

        file = entry.pak.readFileSync(entry.name);

        // TODO: Check for NPOT
        
        fs.writeFileSync(exportPath, file);
    }

    return entry.name;
    
}

exports.exportTextures = function(outputFolder, shaders, data, lightmapPath, pak) {
    var material, shader, stage, exportedName, i, j, k;
    for(i = 0; i < data.materials.length; ++i) {
        material = data.materials[i];

        shader = shaders[material.shaderName];
        if(shader) {
            for(j in shader.stages) {
                stage = shader.stages[j];
                if(stage.map === "$anim") {
                    for(k in stage.animMaps) {
                        stage.animMaps[k] = exportTexture(outputFolder, stage.animMaps[k], pak);
                    }
                } else if (stage.map === "$lightmap") {
                    stage.map = lightmapPath;
                } else {
                    stage.map = exportTexture(outputFolder, stage.map, pak);
                }
            }
            //materials[material.shaderName] = threeJsExport.materialToThreeJs(shader);
        } else {
            material.shaderName = exportTexture(outputFolder, material.shaderName, pak);
            // Need to do something with the exported name. It's important, includes extension;
        }
    }
};

exports.writeCanvasToPng = function(outputFolder, name, canvas) {
    // Write compiled lightmap out to PNG
    ensureFilePathExists(outputFolder + "/" + name);
    var out = fs.createWriteStream(outputFolder + "/" + name);
    var stream = canvas.createPNGStream();
    stream.on('data', function(chunk){
        out.write(chunk);
    });
}