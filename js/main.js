/* 
 * main.js - Setup for Quake 3 WebGL demo
 */

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
 *	  1. The origin of this software must not be misrepresented; you must not
 *	  claim that you wrote the original software. If you use this software
 *	  in a product, an acknowledgment in the product documentation would be
 *	  appreciated but is not required.
 *
 *	  2. Altered source versions must be plainly marked as such, and must not
 *	  be misrepresented as being the original software.
 *
 *	  3. This notice may not be removed or altered from any source
 *	  distribution.
 */

// The bits that need to change to load different maps are right here!
// ===========================================

var mapName = 'q3tourney2';
var mapShaders = [
	'scripts/base.shader', 'scripts/base_button.shader', 'scripts/base_floor.shader',
	'scripts/base_light.shader', 'scripts/base_object.shader', 'scripts/base_support.shader',
	'scripts/base_trim.shader', 'scripts/base_wall.shader', 'scripts/common.shader',
	'scripts/ctf.shader', 'scripts/eerie.shader', 'scripts/gfx.shader',
	'scripts/gothic_block.shader', 'scripts/gothic_floor.shader', 'scripts/gothic_light.shader',
	'scripts/gothic_trim.shader', 'scripts/gothic_wall.shader', 'scripts/hell.shader',
	'scripts/liquid.shader', 'scripts/menu.shader', 'scripts/models.shader',
	'scripts/organics.shader', 'scripts/sfx.shader', 'scripts/shrine.shader',
	'scripts/skin.shader', 'scripts/sky.shader', 'scripts/test.shader'
];

// For my demo, I compiled only the shaders the map used into a single file for performance reasons
//var mapShaders = ['scripts/web_demo.shader'];

// ===========================================
// Everything below here is common to all maps
var modelViewMat, projectionMat;
var activeShader;
var map, playerMover;

var zAngle = 3;
var xAngle = 0;
var cameraPosition = [0, 0, 0];

var startTime = new Date().getTime();

// Set up basic GL State up front
function initGL(gl, canvas) {
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clearDepth(1.0);
	
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);
	gl.enable(gl.CULL_FACE);
	
	projectionMat = mat4.create();
	mat4.perspective(45.0, canvas.width/canvas.height, 1.0, 4096.0, projectionMat);
	modelViewMat = mat4.create();
	
	initMap(gl);
}

// Load the map
function initMap(gl) {
	$('#mapTitle').html(mapName.toUpperCase());

	map = new q3bsp(gl);
	map.onentitiesloaded = initMapEntities;
	map.onbsp = initPlayerMover;
	map.onsurfaces = initSurfaces;
	map.loadShaders(mapShaders);
	map.load('maps/' + mapName +'.bsp');
}

// Process entities loaded from the map
function initMapEntities(entities) {
	respawnPlayer(0);
}

function initPlayerMover(bsp) {
	playerMover = new q3movement(bsp);
	respawnPlayer(0);
	$('#viewport').show();
}

// Populates a combo box that allows users to select a shader which will be rendered as the
// default shader (blue grid). Useful for identifying problematic surfaces.
function initSurfaces(surfaces) {
	var shaderSelect = $('#shaderSelect');
	
	shaderSelect.keyup(updateHighlight);
	shaderSelect.change(updateHighlight);
	
	shaderSelect.html(''); // Clear current options
	shaderSelect.append('<option>[None]</option>');
	for(var i = 0; i < surfaces.length; ++i) {
		shaderSelect.append('<option>' + surfaces[i].shaderName + '</option>');
	}
}
function updateHighlight() {
	$("#shaderSelect option:selected").each(function () {
		map.highlightShader($(this).text());
	});
}

var lastIndex = 0;
// "Respawns" the player at a specific spawn point. Passing -1 will move the player to the next spawn point.
function respawnPlayer(index) {
	if(map.entities && playerMover) {
		if(index == -1) {
			index = (lastIndex+1)% map.entities.info_player_deathmatch.length;
		}
		lastIndex = index;
	
		var spawnPoint = map.entities.info_player_deathmatch[index];
		playerMover.position = [
			spawnPoint.origin[0], 
			spawnPoint.origin[1], 
			spawnPoint.origin[2]+30 // Start a little ways above the floor
		];
		
		playerMover.velocity = [0,0,0];
		
		zAngle = -spawnPoint.angle * (3.1415/180) + (3.1415*0.5); // Negative angle in radians + 90 degrees
		xAngle = 0;
	}
}

var lastMove = 0;

function onFrame(gl, event) {
	$('#fps').html(event.framesPerSecond);
	
	// Update player movement @ 60hz
	// The while ensures that we update at a fixed rate even if the rendering bogs down
	while(event.elapsed - lastMove >= 16) {
		updateInput(16);
		lastMove += 16;
	}
	
	drawFrame(gl);
}

// Draw a single frame
function drawFrame(gl) {
	// Clear back buffer but not color buffer (we expect the entire scene to be overwritten)
	gl.depthMask(true);
	gl.clear(gl.DEPTH_BUFFER_BIT);
	
	if(!map || !playerMover) { return; }
	
	// Matrix setup
	mat4.identity(modelViewMat);
	mat4.rotateX(modelViewMat, xAngle-Math.PI/2);
	mat4.rotateZ(modelViewMat, zAngle);
	mat4.translate(modelViewMat, [-playerMover.position[0], -playerMover.position[1], -playerMover.position[2]-30]);
	
	// Here's where all the magic happens...
	map.draw(cameraPosition, modelViewMat, projectionMat);
}

var pressed = new Array(128);
var cameraMat = mat4.create();

function updateInput(frameTime) {
	if(!playerMover) { return; }
		
	var dir = [0, 0, 0];
	
	// This is our first person movement code. It's not really pretty, but it works
	if(pressed['W'.charCodeAt(0)]) {
		dir[1] += 1;
	}
	if(pressed['S'.charCodeAt(0)]) {
		dir[1] -= 1;
	}
	if(pressed['A'.charCodeAt(0)]) {
		dir[0] -= 1;
	}
	if(pressed['D'.charCodeAt(0)]) {
		dir[0] += 1;
	}
	
	if(dir[0] != 0 || dir[1] != 0 || dir[2] != 0) {
		mat4.identity(cameraMat);
		mat4.rotateZ(cameraMat, zAngle);
		mat4.inverse(cameraMat);
		
		mat4.multiplyVec3(cameraMat, dir);
	}
	
	// Send desired movement direction to the player mover for collision detection against the map
	playerMover.move(dir, frameTime);
}

function lockMouse() {
    if(navigator.pointer && !navigator.pointer.isLocked()) {
        navigator.pointer.lock(viewport, function() {  
            console.log("I can haz mouselock!");
        }, function() {  
            console.log("Epic mouselock fail!");
        });
    }
}

// Set up event handling
function initEvents() {
	var movingModel = false;
	var lastX = 0;
	var lastY = 0;
	var lastMoveX = 0;
	var lastMoveY = 0;
	var viewport = document.getElementById("viewport");
	
	navigator.pointer = navigator.pointer || navigator.webkitPointer;
	
	$(document).keydown(function(event) {
		if(event.keyCode == 32 && !pressed[32]) {
			playerMover.jump();
		}
		pressed[event.keyCode] = true;
	});
	
	$(document).keypress(function(event) {
		if(event.keyCode == 'R'.charCodeAt(0) || event.keyCode == 'r'.charCodeAt(0)) {
			respawnPlayer(-1);
		}
	});
	
	$(document).keyup(function(event) {
		pressed[event.keyCode] = false;
	});
	
	function startLook(x, y) {
		movingModel = true;
		
		lastX = x;
		lastY = y;
	}
	
	function endLook() {
		movingModel = false;
	}
	
	function moveLook(x, y) {
		var xDelta = x - lastX;
		var yDelta = y - lastY;
		lastX = x;
		lastY = y;
		
		if (movingModel) {
			moveLookLocked(xDelta, yDelta);
		}
	}
	
	function moveLookLocked(xDelta, yDelta) {
		zAngle += xDelta*0.0025;
		while (zAngle < 0)
			zAngle += Math.PI*2;
		while (zAngle >= Math.PI*2)
			zAngle -= Math.PI*2;
			
		xAngle += yDelta*0.0025;
		while (xAngle < -Math.PI*0.5)
			xAngle = -Math.PI*0.5;
		while (xAngle > Math.PI*0.5)
			xAngle = Math.PI*0.5;
	}
	
	function startMove(x, y) {
		lastMoveX = x;
		lastMoveY = y;
	}
	
	function moveUpdate(x, y, frameTime) {
		var xDelta = x - lastMoveX;
		var yDelta = y - lastMoveY;
		lastMoveX = x;
		lastMoveY = y;

		var dir = [xDelta, yDelta * -1, 0];

		mat4.identity(cameraMat);
		mat4.rotateZ(cameraMat, zAngle);
		mat4.inverse(cameraMat);

		mat4.multiplyVec3(cameraMat, dir);

		// Send desired movement direction to the player mover for collision detection against the map
		playerMover.move(dir, frameTime*2);
	}
	
	$('#viewport').click(function(event) {
		lockMouse();
	});
	
	// Mouse handling code
	// When the mouse is pressed it rotates the players view
	$('#viewport').mousedown(function(event) {
		if(event.which == 1) {
			startLook(event.pageX, event.pageY);
		}
	});
	$('#viewport').mouseup(function(event) {
		endLook();
	});
	$('#viewport').mousemove(function(event) {
	    if(navigator.pointer && navigator.pointer.isLocked()) {
	        moveLookLocked(event.movementX, event.movementY);
        } else {
		    moveLook(event.pageX, event.pageY);
	    }
	});
	
	// Touch handling code
	$('#viewport').bind('touchstart', function(event) {
		var touches = event.originalEvent.touches;
		switch(touches.length) {
			case 1: // Single finger looks around
				startLook(touches[0].pageX, touches[0].pageY);
				break;
			case 2: // Two fingers moves
				startMove(touches[0].pageX, touches[0].pageY);
				break;
			case 3: // Three finger tap jumps
				playerMover.jump();
				break;
			default:
				return;
		}
		event.stopPropagation();
		event.preventDefault();
	});
	$('#viewport').bind('touchend', function(event) {
		endLook();
		return false;
	});
	$('#viewport').bind('touchmove', function(event) {
		var touches = event.originalEvent.touches;
		switch(touches.length) {
			case 1:
				moveLook(touches[0].pageX, touches[0].pageY);
				break;
			case 2:
				moveUpdate(touches[0].pageX, touches[0].pageY, 16);
				break;
			default:
				return;
		}
		event.stopPropagation();
		event.preventDefault();
	});
}

// Utility function that tests a list of webgl contexts and returns when one can be created
// Hopefully this future-proofs us a bit
function getAvailableContext(canvas, contextList) {
	if (canvas.getContext) {
		for(var i = 0; i < contextList.length; ++i) {
			try {
				var context = canvas.getContext(contextList[i], { antialias:false });
				if(context != null)
					return context;
			} catch(ex) { }
		}
	}
	return null;
}

var GL_WINDOW_WIDTH = 854;
var GL_WINDOW_HEIGHT = 480;

function main() {
	var canvas = $('#viewport').get(0);
	
	// Set the canvas size
	canvas.width = GL_WINDOW_WIDTH;
	canvas.height = GL_WINDOW_HEIGHT;
	
	// Get the GL Context (try 'webgl' first, then fallback)
	var gl = getAvailableContext(canvas, ['webgl', 'experimental-webgl']);
	
	if(!gl) {
		$('#viewport-frame').remove();
		$('#webgl-error').show();
	} else {
		$('#viewport-info').show();
		initEvents();
		initGL(gl, canvas);
		
		// use requestAnimationFrame to do animation if available
		$(canvas).requestAnimation(function(event) {
			if(!map || !playerMover) { return; }
			onFrame(gl, event); 
		});
	}

	$('#showFPS').change(function() {
		if($('#showFPS:checked').length) {
			$('#fps-counter').show();
		} else {
			$('#fps-counter').hide();
		}
	});
	
	$('#playMusic').change(function() {
		if(map) {
			map.playMusic($('#playMusic:checked').length > 0);
		}
	});
	
	// Handle fullscreen transition
	function fullscreenchange() {
		if(document.webkitIsFullScreen || document.mozFullScreen) {
			canvas.width = screen.width;
			canvas.height = screen.height;
			lockMouse(); // Attempt to lock the mouse automatically
		} else {
			canvas.width = GL_WINDOW_WIDTH;
			canvas.height = GL_WINDOW_HEIGHT;
		}
		gl.viewport(0, 0, canvas.width, canvas.height);
		mat4.perspective(45.0, canvas.width/canvas.height, 1.0, 4096.0, projectionMat);
	};
	
	canvas.addEventListener("webkitfullscreenchange", fullscreenchange, false);
	canvas.addEventListener("mozfullscreenchange", fullscreenchange, false);
	
	$('#fullscreenBtn').click(function() {
		if(canvas.webkitRequestFullScreen) {
			canvas.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
		} else if(canvas.mozRequestFullScreen) {
			canvas.mozRequestFullScreen();
		}
	});
}

$(main); // Fire this once the page is loaded up