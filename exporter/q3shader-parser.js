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

//
// Shader Tokenizer
//

shaderTokenizer = function(src) {
    // Strip out comments
    src = src.replace(/\/\/.*$/mg, ''); // C++ style (//...)
    src = src.replace(/\/\*[^*\/]*\*\//mg, ''); // C style (/*...*/) (Do the shaders even use these?)
    this.tokens = src.match(/[^\s\n\r\"]+/mg);
    
    this.offset = 0;
};

shaderTokenizer.prototype.EOF = function() {
    if(this.tokens === null) { return true; }
    var token = this.tokens[this.offset];
    while(token === '' && this.offset < this.tokens.length) {
        this.offset++;
        token = this.tokens[this.offset];
    }
    return this.offset >= this.tokens.length;
};

shaderTokenizer.prototype.next = function() {
    if(this.tokens === null) { return ; }
    var token = '';
    while(token === '' && this.offset < this.tokens.length) {
        token = this.tokens[this.offset++];
    }
    return token;
};

shaderTokenizer.prototype.prev = function() {
    if(this.tokens === null) { return ; }
    var token = '';
    while(token === '' && this.offset >= 0) {
        token = this.tokens[this.offset--];
    }
    return token;
};

//
// Shader Loading
//

var q3shaderParser = exports.q3shaderParser = {};

q3shaderParser.loadList = function(sources, onload) {
    for(var i = 0; i < sources.length; ++i) {
        q3shaderParser.load(sources[i], onload);
    }
};

q3shaderParser.load = function(url, onload) {
    fs.readFile(url, function(err, data) {
        q3shaderParser.parse(url, data.toString(), onload);
    });
};

q3shaderParser.parse = function(url, src, onload) {
    var shaders = {}, stage, material;
    
    var tokens = new shaderTokenizer(src);
    
    // Parse a shader
    while(!tokens.EOF()) {
        var name = tokens.next();
        var shader = q3shaderParser.parseShader(name, tokens);
        if(shader) {
            if(shader.stages) {

                material = {
                    url: url,
                    sort: shader.sort
                };

                if(shader.cull != "back") {
                    material.cull = shader.cull;
                }

                if(shader.blend) {
                    material.blend = shader.blend;
                    material.blendSrc = shader.blendSrc;
                    material.blendDest = shader.blendDest;
                }

                var builder = q3shaderParser.buildShader(shader);

                material.shader = builder.getShaderObject();
            }
        }

        shaders[shader.name] = material;
    }
    
    onload(shaders);
};

// Cleans up the parsed stage into a more compact, useful shader pass
q3shaderParser.stageToPass = function(shader, stage) {
    var pass = {
        // Build a WebGL shader program out of the stage parameters set here
        shader: q3shaderParser.buildShader(shader, stage)
    };

    if(stage.map) {
        pass.texture = {};

        if(stage.map === "anim") {
            pass.texture.animSrc = stage.animMaps;
            pass.texture.delay = stage.animFreq;
        } else {
            pass.texture.src = stage.map;
        }

        if(stage.clamp) {
            pass.texture.clamp = stage.clamp;
        }
    }

    if(stage.hasBlendFunc) {
        pass.blendFunc = {
            src: stage.blendSrc.toUpperCase().replace("GL_", ""),
            dest: stage.blendDest.toUpperCase().replace("GL_", "")
        };
    }

    if(stage.depthWrite) {
        pass.depthWrite = true;
    }

    if(stage.depthFunc != "lequal") {
        pass.depthFunc = stage.depthFunc.toUpperCase();
    }

    return pass;
};

q3shaderParser.parseShader = function(name, tokens) {
    var brace = tokens.next();
    if(brace != '{') {
        return null;
    }
    
    var shader = {
        name: name,
        cull: 'back',
        sky: false,
        blend: false,
        opaque: false,
        sort: 0,
        vertexDeforms: [],
        stages: []
    };

    // Parse a shader
    while(!tokens.EOF()) {
        var token = tokens.next().toLowerCase();
        if(token == '}') { break; }
        
        switch (token) {
            case '{': {
                var stage = q3shaderParser.parseStage(tokens);
                
                // I really really really don't like doing this, which basically just forces lightmaps to use the 'filter' blendmode
                // but if I don't a lot of textures end up looking too bright. I'm sure I'm jsut missing something, and this shouldn't
                // be needed.
                if(stage.isLightmap && (stage.hasBlendFunc)) {
                    stage.blendSrc = 'GL_DST_COLOR';
                    stage.blendDest = 'GL_ZERO';
                }
                
                // I'm having a ton of trouble getting lightingSpecular to work properly,
                // so this little hack gets it looking right till I can figure out the problem
                if(stage.alphaGen == 'lightingspecular') {
                    stage.blendSrc = 'GL_ONE';
                    stage.blendDest = 'GL_ZERO';
                    stage.hasBlendFunc = false;
                    stage.depthWrite = true;
                    shader.stages = [];
                }
                
                if(stage.hasBlendFunc) { shader.blend = true; } else { shader.opaque = true; }
                
                shader.stages.push(stage);
            } break;
            
            case 'cull':
                shader.cull = tokens.next();
                break;
                
            case 'deformvertexes':
                var deform = {
                    type: tokens.next().toLowerCase()
                };
                
                switch(deform.type) {
                    case 'wave':
                        deform.spread = 1.0 / parseFloat(tokens.next());
                        deform.waveform = q3shaderParser.parseWaveform(tokens);
                        break;
                    default: deform = null; break;
                }
                
                if(deform) { shader.vertexDeforms.push(deform); }
                break;
                
            case 'sort':
                var sort = tokens.next().toLowerCase();
                switch(sort) {
                    case 'portal': shader.sort = 1; break;
                    case 'sky': shader.sort = 2; break;
                    case 'opaque': shader.sort = 3; break;
                    case 'banner': shader.sort = 6; break;
                    case 'underwater': shader.sort = 8; break;
                    case 'additive': shader.sort = 9; break;
                    case 'nearest': shader.sort = 16; break;
                    default: shader.sort = parseInt(sort); break; 
                };
                break;
                
            case 'surfaceparm':
                var param = tokens.next().toLowerCase();
                
                switch(param) {
                    case 'sky':
                        shader.sky = true;
                        break;
                    default: break;
                }
                break;
                
            default: break;
        }
    }
    
    if(!shader.sort) {
        shader.sort = (shader.opaque ? 3 : 9);
    }
    
    return shader;
};

q3shaderParser.parseStage = function(tokens) {
    var stage = {
        map: null,
        clamp: false,
        tcGen: 'base',
        rgbGen: 'identity',
        rgbWaveform: null,
        alphaGen: '1.0',
        alphaFunc: null,
        alphaWaveform: null,
        blendSrc: 'GL_ONE', 
        blendDest: 'GL_ZERO',
        hasBlendFunc: false,
        tcMods: [],
        animMaps: [],
        animFreq: 0,
        depthFunc: 'lequal',
        depthWrite: true
    };
    
    // Parse a shader
    while(!tokens.EOF()) {
        var token = tokens.next();
        if(token == '}') { break; }
        
        switch(token.toLowerCase()) {
            case 'clampmap':
                stage.clamp = true;
            case 'map':
                stage.map = tokens.next().replace(/(\.jpg|\.tga)/, '.png');
                break;
                
            case 'animmap':
                stage.map = 'anim';
                stage.animFreq = parseFloat(tokens.next());
                var nextMap = tokens.next();
                while(nextMap.match(/(\.jpg|\.tga)/)) {
                    stage.animMaps.push(nextMap.replace(/(\.jpg|\.tga)/, '.png'));
                    nextMap = tokens.next();
                }
                tokens.prev();
                break;
                
            case 'rgbgen':
                stage.rgbGen = tokens.next().toLowerCase();;
                switch(stage.rgbGen) {
                    case 'wave':
                        stage.rgbWaveform = q3shaderParser.parseWaveform(tokens);
                        if(!stage.rgbWaveform) { stage.rgbGen == 'identity'; }
                        break;
                };
                break;
                
            case 'alphagen':
                stage.alphaGen = tokens.next().toLowerCase();
                switch(stage.alphaGen) {
                    case 'wave':
                        stage.alphaWaveform = q3shaderParser.parseWaveform(tokens);
                        if(!stage.alphaWaveform) { stage.alphaGen == '1.0'; }
                        break;
                    default: break;
                };
                break;
                
            case 'alphafunc':
                stage.alphaFunc = tokens.next().toUpperCase();
                break;
                
            case 'blendfunc':
                stage.blendSrc = tokens.next();
                stage.hasBlendFunc = true;
                if(!stage.depthWriteOverride) {
                    stage.depthWrite = false;
                }
                switch(stage.blendSrc) {
                    case 'add':
                        stage.blendSrc = 'GL_ONE';
                        stage.blendDest = 'GL_ONE';
                        break;
                        
                    case 'blend':
                        stage.blendSrc = 'GL_SRC_ALPHA';
                        stage.blendDest = 'GL_ONE_MINUS_SRC_ALPHA';
                        break;
                        
                    case 'filter':
                        stage.blendSrc = 'GL_DST_COLOR';
                        stage.blendDest = 'GL_ZERO';
                        break;
                        
                    default:
                        stage.blendDest = tokens.next();
                        break;
                }
                break;
                
            case 'depthfunc':
                stage.depthFunc = tokens.next().toLowerCase();
                break;
                
            case 'depthwrite':
                stage.depthWrite = true;
                stage.depthWriteOverride = true;
                break;
                
            case 'tcmod':
                var tcMod = {
                    type: tokens.next().toLowerCase()
                }
                switch(tcMod.type) {
                    case 'rotate': 
                        tcMod.angle = parseFloat(tokens.next()) * (3.1415/180);
                        break;
                    case 'scale':
                        tcMod.scaleX = parseFloat(tokens.next());
                        tcMod.scaleY = parseFloat(tokens.next());
                        break;
                    case 'scroll':
                        tcMod.sSpeed = parseFloat(tokens.next());
                        tcMod.tSpeed = parseFloat(tokens.next());
                        break;
                    case 'stretch':
                        tcMod.waveform = q3shaderParser.parseWaveform(tokens);
                        if(!tcMod.waveform) { tcMod.type == null; }
                        break;
                    case 'turb':
                        tcMod.turbulance = {
                            base: parseFloat(tokens.next()),
                            amp: parseFloat(tokens.next()),
                            phase: parseFloat(tokens.next()),
                            freq: parseFloat(tokens.next())
                        };
                        break;
                    default: tcMod.type == null; break;
                }
                if(tcMod.type) {
                    stage.tcMods.push(tcMod);
                }
                break;
            case 'tcgen':
                stage.tcGen = tokens.next();
                break;
            default: break;
        }
    }
    
    if(stage.blendSrc == 'GL_ONE' && stage.blendDest == 'GL_ZERO') {
        stage.hasBlendFunc = false;
        stage.depthWrite = true;
    }
    
    stage.isLightmap = stage.map == '$lightmap'
    
    return stage;
};

q3shaderParser.parseWaveform = function(tokens) {
    return {
        funcName: tokens.next().toLowerCase(),
        base: parseFloat(tokens.next()),
        amp: parseFloat(tokens.next()),
        phase: parseFloat(tokens.next()),
        freq: parseFloat(tokens.next())
    };
};

//
// WebGL Shader creation
//

// This whole section is a bit ugly, but it gets the job done. The job, in this case, is translating
// Quake 3 shaders into GLSL shader programs. We should probably be doing a bit more normalization here.

q3shaderParser.buildShader = function(stageShader) {
    var i, stage;
    var builder = new shaderBuilder();

    builder.addAttrib("position", "vec3");
    builder.addAttrib("normal", "vec3");
    builder.addAttrib("color", "vec3");
    
    builder.addVarying("vColor", "vec3");
    
    builder.addUniform("modelViewMatrix", {type: "mat4"});
    builder.addUniform("projectionMatrix", {type: "mat4"});
    builder.addUniform("time", {type: "float"});

    // Vertex Shader
    builder.addVertexLines([
        'vec3 defPosition = position;',
        'vColor = color;',
    ]);

    for(i = 0; i < stageShader.vertexDeforms.length; ++i) {
        var deform = stageShader.vertexDeforms[i];
        
        switch(deform.type) {
            case 'wave':
                var name = 'deform' + i;
                var offName = 'deformOff' + i;
                
                builder.addVertexLines([
                    'float ' + offName + ' = (position.x + position.y + position.z) * ' + deform.spread.toFixed(4) + ';'
                ]);
                
                var phase = deform.waveform.phase;
                deform.waveform.phase = phase.toFixed(4) + ' + ' + offName;
                builder.addVertexLines([ 
                    builder.createWaveform(name, deform.waveform) 
                ]);
                deform.waveform.phase = phase;
                
                builder.addVertexLines([
                    'defPosition += normal * ' + name + ';'
                ]);
                break;
            default: break;
        }
    }

    builder.addVertexLines(['vec4 worldPosition = modelViewMatrix * vec4(defPosition, 1.0);']);

    for(i = 0; i < stageShader.stages.length; ++i) {
        stage = stageShader.stages[i];
        stage.stageId = i;

        q3shaderParser.buildVertexPass(stageShader, stage, builder);
    }

    builder.addVertexLines(['gl_Position = projectionMatrix * worldPosition;']);

    //Fragment Shader
    builder.addFragmentLines(['vec4 passColor;']);

    for(i = 0; i < stageShader.stages.length; ++i) {
        stage = stageShader.stages[i];
        q3shaderParser.buildFragmentPass(stageShader, stage, builder);
    }

    builder.addFragmentLines(['gl_FragColor = fragColor;']);

    return builder;
};

q3shaderParser.buildVertexPass = function(stageShader, stage, shader) {
    var passName = "vertPass" + stage.stageId;
    var texCoordVar = "vTexCoord" + stage.stageId;
    shader.addVarying(texCoordVar, "vec2");

    if(stage.isLightmap) {
        shader.addAttrib("lightCoord", "vec2");
    } else {
        shader.addAttrib("texCoord", "vec2");
    }
    
    var passFunc = "vec2 " + passName + "(vec4 worldPosition) {\n";
        passFunc += "   vec2 vTexCoord;\n"

    if(stage.tcGen == 'environment') {
        passFunc += [
            '   vec3 viewer = normalize(-worldPosition.xyz);',
            'float d = dot(normal, viewer);',
            'vec3 reflected = normal*2.0*d - viewer;',
            'vTexCoord = vec2(0.5, 0.5) + reflected.xy * 0.5;\n'
        ].join("\n\t");
    } else {
        // Standard texturing
        if(stage.isLightmap) {
            passFunc += '   vTexCoord = lightCoord;\n';
        } else {
            passFunc += '   vTexCoord = texCoord;\n';
        }
    }

    switch(stage.alphaGen) {
        case 'lightingspecular':
            shader.addAttrib("lightCoord", "vec2");
            shader.addVarying("vLightCoord", "vec2");
            shader.addVertexLines([ 'vLightCoord = lightCoord;' ]);
            break;
        default: 
            break;
    }
    
    // tcMods
    for(var i = 0; i < stage.tcMods.length; ++i) {
        var tcMod = stage.tcMods[i];
        switch(tcMod.type) {
            case 'rotate':
                passFunc += [
                    '   float r = ' + tcMod.angle.toFixed(4) + ' * time;',
                    'vTexCoord -= vec2(0.5, 0.5);',
                    'vTexCoord = vec2(vTexCoord.s * cos(r) - vTexCoord.t * sin(r), vTexCoord.t * cos(r) + vTexCoord.s * sin(r));',
                    'vTexCoord += vec2(0.5, 0.5);\n',
                ].join("\n\t");
                break;
            case 'scroll':
                passFunc += '   vTexCoord += vec2(' + tcMod.sSpeed.toFixed(4) + ' * time, ' + tcMod.tSpeed.toFixed(4) + ' * time);\n';
                break;
            case 'scale':
                passFunc += '   vTexCoord *= vec2(' + tcMod.scaleX.toFixed(4) + ', ' + tcMod.scaleY.toFixed(4) + ');\n';
                break;
            case 'stretch':
                passFunc += [
                    '   ' + shader.createWaveform('stretchWave', tcMod.waveform),
                    'stretchWave = 1.0 / stretchWave;',
                    'vTexCoord *= stretchWave;',
                    'vTexCoord += vec2(0.5 - (0.5 * stretchWave), 0.5 - (0.5 * stretchWave));\n',
                ].join("\n\t");
                break;
            case 'turb':
                var tName = 'turbTime' + i;
                passFunc += [
                    '   float ' + tName + ' = ' + tcMod.turbulance.phase.toFixed(4) + ' + time * ' + tcMod.turbulance.freq.toFixed(4) + ';',
                    'vTexCoord.s += sin( ( ( position.x + position.z )* 1.0/128.0 * 0.125 + ' + tName + ' ) * 6.283) * ' + tcMod.turbulance.amp.toFixed(4) + ';',
                    'vTexCoord.t += sin( ( position.y * 1.0/128.0 * 0.125 + ' + tName + ' ) * 6.283) * ' + tcMod.turbulance.amp.toFixed(4) + ';\n'
                ].join("\n\t");
                break;
            default: break;
        }
    }

    passFunc += "   return vTexCoord;\n";
    passFunc += "}";

    shader.addVertexFunction(passName, passFunc);
    shader.addVertexLines([texCoordVar + ' = ' + passName + "(worldPosition);"]);
}

q3shaderParser.buildFragmentPass = function(stageShader, stage, shader) {
    var passName = "fragPass" + stage.stageId;
    var samplerVar = "texSampler" + stage.stageId;
    var texCoordVar = "vTexCoord" + stage.stageId;
    var textureSrc = stage.map === "anim" ? stage.animMaps[0] : stage.map;

    var samplerTmp = {type: 'sampler2D', src: textureSrc};
    if(stage.clamp) {
        samplerTmp.clamp = true;
    }
    shader.addUniform(samplerVar, samplerTmp);

    var passFunc = "vec4 " + passName + "(sampler2D texture, vec2 vTexCoord) {\n";
        passFunc += "   vec4 texColor = texture2D(texture, vTexCoord);\n";
    
    switch(stage.rgbGen) {
        case 'vertex':
            passFunc += '   vec3 rgb = texColor.rgb * vColor.rgb;\n';
            break;
        case 'wave':
            passFunc += '   ' + shader.createWaveform('rgbWave', stage.rgbWaveform) + '\n';
            passFunc += '   vec3 rgb = texColor.rgb * rgbWave;\n';
            break;
        default:
            passFunc += '   vec3 rgb = texColor.rgb;\n';
            break;
    }
    
    switch(stage.alphaGen) {
        case 'wave':
            passFunc += shader.createWaveform('alpha', stage.alphaWaveform);
            break;
        case 'lightingspecular':
            // For now this is VERY special cased. May not work well with all instances of lightingSpecular
            shader.addUniform("lightmap", {type: 'sampler2D', src: "$lightmap"});
            passFunc += [
                '   vec4 light = texture2D(lightmap, vLightCoord);',
                'rgb *= light.rgb;',
                'rgb += light.rgb * texColor.a * 0.6;', // This was giving me problems, so I'm ignorning an actual specular calculation for now
                'float alpha = 1.0;\n'
            ].join("\n\t");
            break;
        default: 
            passFunc += '   float alpha = texColor.a;\n';
            break;
    }
    
    if(stage.alphaFunc) {
        switch(stage.alphaFunc) {
            case 'GT0':
                passFunc += '   if(alpha == 0.0) { discard; }\n';
                break;
            case 'LT128':
                passFunc += '   if(alpha >= 0.5) { discard; }\n';
                break;
            case 'GE128':
                passFunc += '   if(alpha < 0.5) { discard; }\n';
                break;
            default: 
                break;
        }
    }

    passFunc += "   return vec4(rgb, alpha);\n";
    passFunc += "}";
    
    shader.addFragmentFunction(passName, passFunc);
    if(stage.stageId === 0) {
        shader.addFragmentLines([
            'vec4 fragColor = ' + passName + "(" + samplerVar + ", " + texCoordVar + ");"
        ]);
    } else {
        shader.addFragmentLines([
            'passColor = ' + passName + "(" + samplerVar + ", " + texCoordVar + ");",
            shader.createBlend('passColor', 'fragColor', stage.blendSrc, stage.blendDest)
        ]);
    }
}

//
// Shader construction utility
//

var shaderBuilder = function() {
    this.attribs = {};
    this.varyings = {};
    this.uniforms = {};

    this.vertexFunctions = {};
    this.fragmentFunctions = {};

    this.vertexLines = [];
    this.fragmentLines = [];
}

shaderBuilder.prototype.addAttrib = function(name, type) {
    this.attribs[name] = type;
}

shaderBuilder.prototype.addVarying = function(name, type) {
    this.varyings[name] = type;
}

shaderBuilder.prototype.addUniform = function(name, data) {
    this.uniforms[name] = data;
}

shaderBuilder.prototype.addVertexFunction = function(name, src) {
    this.vertexFunctions[name] = src;
}

shaderBuilder.prototype.addFragmentFunction = function(name, src) {
    this.fragmentFunctions[name] = src;
}

shaderBuilder.prototype.addVertexLines = function(lines) {
    var i;
    for(i in lines) {
        this.vertexLines.push(lines[i]);
    }
}

shaderBuilder.prototype.addFragmentLines = function(lines) {
    var i;
    for(i in lines) {
        this.fragmentLines.push(lines[i]);
    }
}

shaderBuilder.prototype.getVertexSource = function() {
    var i, src = "";

    for(i in this.varyings) {
        src += "varying " + this.varyings[i] + " " + i + ";\n";
    }

    src += "\n";

    for(i in this.vertexFunctions) {
        src += this.vertexFunctions[i] + '\n';
    }
    
    src += 'void main() {\n\t';
    src += this.vertexLines.join('\n\t');
    src += '\n}\n';
    
    return src;
}

shaderBuilder.prototype.getFragmentSource = function() {
    var i, src = "";

    for(i in this.varyings) {
        src += "varying " + this.varyings[i] + " " + i + ";\n";
    }

    src += "\n";

    for(i in this.fragmentFunctions) {
        src += this.fragmentFunctions[i] + '\n';
    }

    src += 'void main() {\n\t';
    src += this.fragmentLines.join('\n\t');
    src += '\n}\n';
    
    return src;
}

shaderBuilder.prototype.createWaveform = function(name, wf, timeVar, shader) {
    var funcName;

    if(!wf) { 
        return 'float ' + name + ' = 0.0;'; 
    }
    
    if(!timeVar) { timeVar = 'time'; }
    
    if(typeof(wf.phase) == "number") {
        wf.phase = wf.phase.toFixed(4)
    }
    
    switch(wf.funcName) {
        case 'sin':  
            return 'float ' + name + ' = ' + wf.base.toFixed(4) + ' + sin((' + wf.phase + ' + ' + timeVar + ' * ' + wf.freq.toFixed(4) + ') * 6.283) * ' + wf.amp.toFixed(4) + ';';
        case 'square': funcName = 'square'; this.addSquareFunc(shader); break;
        case 'triangle': funcName = 'triangle'; this.addTriangleFunc(shader); break;
        case 'sawtooth': funcName = 'fract'; break;
        case 'inversesawtooth': funcName = '1.0 - fract'; break;
        default: 
            return 'float ' + name + ' = 0.0;';
    }
    return 'float ' + name + ' = ' + wf.base.toFixed(4) + ' + ' + funcName + '(' + wf.phase + ' + ' + timeVar + ' * ' + wf.freq.toFixed(4) + ') * ' + wf.amp.toFixed(4) + ';';
}

shaderBuilder.prototype.addSquareFunc = function(shader) {
    var func = [
        'float square(float val) {',
        '   return (mod(floor(val*2.0)+1.0, 2.0) * 2.0) - 1.0;',
        '}',
    ].join('\n');

    if(shader === "vertex") { 
        this.addVertexFunction("square", func);
    } else {
        this.addFragmentFunction("square", func);
    }
}

shaderBuilder.prototype.addTriangleFunc = function(shader) {
    var func = [
        'float triangle(float val) {',
        '   return abs(2.0 * fract(val) - 1.0);',
        '}',
    ].join('\n');

    if(shader === "vertex") { 
        this.addVertexFunction("triangle", func);
    } else {
        this.addFragmentFunction("triangle", func);
    }
}

shaderBuilder.prototype.createBlend = function(srcVar, destVar, srcFunc, destFunc) {
    var srcCode,destCode;

    switch(srcFunc) {
        case "GL_SRC_ALPHA": srcCode = srcVar + "*" + srcVar + ".a"; break;
        case "GL_ONE_MINUS_SRC_ALPHA": srcCode = srcVar + "* (1.0-" + srcVar + ".a)"; break;
        case "GL_DST_COLOR": srcCode = srcVar + "*" + destVar; break;
        case "GL_ONE_MINUS_DST_COLOR": srcCode = srcVar + "* (1.0-" + destVar + ")"; break;
        case "GL_ONE": 
        default: srcCode = srcVar; break;
    }

    switch(destFunc) {
        case "GL_ONE_MINUS_SRC_ALPHA": destCode = destVar + "* (1.0-" + srcVar + ".a)"; break;
        case "GL_SRC_COLOR": destCode = destVar + "*" + srcVar; break;
        case "GL_ONE_MINUS_SRC_COLOR": destCode = destVar + "* (1.0-" + srcVar + ")"; break;
        case "GL_ZERO": destCode = null; break;
        case "GL_ONE": 
        default: destCode = destVar; break;
    }

    return destVar + "=" + srcCode + (destCode ? "+" + destCode : "") + ";";
}

shaderBuilder.prototype.getShaderObject = function() {
    var self = this;

    return {
        attribs: self.attribs,
        uniforms: self.uniforms,
        vertexShader: self.getVertexSource(),
        fragmentShader: self.getFragmentSource()
    };
}

//
// WebGL Shader builder utility
//

/*shaderBuilder = function(passId, type) {
    this.passId = 0;
    this.type = type;

    this.attrib = {};
    this.varying = {};
    this.uniform = {};
    
    this.functions = {};
    
    this.statements = [];
}

shaderBuilder.prototype.addAttribs = function(attribs) {
    for (var name in attribs) {
        this.attrib[name] = attribs[name];
    }
}

shaderBuilder.prototype.addVaryings = function(varyings) {
    for (var name in varyings) {
        this.varying[name] = varyings[name];
    }
}

shaderBuilder.prototype.addUniforms = function(uniforms) {
    for (var name in uniforms) {
        this.uniform[name] = uniforms[name];
    }
}

shaderBuilder.prototype.addFunction = function(name, lines) {
    this.functions[name] = lines.join('\n');
}

shaderBuilder.prototype.addLines = function(statements) {
    for(var i = 0; i < statements.length; ++i) {
        this.statements.push(statements[i]);
    }
}

shaderBuilder.prototype.getSource = function() {
    var i, src = "";

    for(i in this.functions) {
        src += this.functions[i] + '\n';
    }
    
    if(this.type == "fragment") {
        src += 'vec4 pass' + this.passId + '() {\n\t';
        src += this.statements.join('\n\t');
        src += '\n}\n';

        src += 'void main() {\n\t';
        src += '    vec4 passResult;\n';
        src += '    passResult = pass' + this.passId + '();\n';
        src += '    gl_FragColor = passResult;\n';
        src += '}\n';
    } else {
        src += 'void main() {\n\t';
        src += this.statements.join('\n\t');
        src += '\n}\n';
    }
    
    return src;
}

shaderBuilder.prototype.getShaderObject = function() {
    var self = this;

    return {
        attrib: self.attrib,
        varying: self.varying,
        uniform: self.uniform,
        source: self.getSource()
    };
}

// q3-centric functions

shaderBuilder.prototype.addWaveform = function(name, wf, timeVar) {
    if(!wf) { 
        this.statements.push('float ' + name + ' = 0.0;');
        return; 
    }
    
    if(!timeVar) { timeVar = 'time'; }
    
    if(typeof(wf.phase) == "number") {
        wf.phase = wf.phase.toFixed(4)
    }
    
    switch(wf.funcName) {
        case 'sin':  
            this.statements.push('float ' + name + ' = ' + wf.base.toFixed(4) + ' + sin((' + wf.phase + ' + ' + timeVar + ' * ' + wf.freq.toFixed(4) + ') * 6.283) * ' + wf.amp.toFixed(4) + ';');
            return;
        case 'square': funcName = 'square'; this.addSquareFunc(); break;
        case 'triangle': funcName = 'triangle'; this.addTriangleFunc(); break;
        case 'sawtooth': funcName = 'fract'; break;
        case 'inversesawtooth': funcName = '1.0 - fract'; break;
        default: 
            this.statements.push('float ' + name + ' = 0.0;');
            return;
    }
    this.statements.push('float ' + name + ' = ' + wf.base.toFixed(4) + ' + ' + funcName + '(' + wf.phase + ' + ' + timeVar + ' * ' + wf.freq.toFixed(4) + ') * ' + wf.amp.toFixed(4) + ';');
}

shaderBuilder.prototype.addSquareFunc = function() {
    this.addFunction('square', [
        'float square(float val) {',
        '   return (mod(floor(val*2.0)+1.0, 2.0) * 2.0) - 1.0;',
        '}',
    ]);
}

shaderBuilder.prototype.addTriangleFunc = function() {
    this.addFunction('triangle', [
        'float triangle(float val) {',
        '   return abs(2.0 * fract(val) - 1.0);',
        '}',
    ]);
}*/