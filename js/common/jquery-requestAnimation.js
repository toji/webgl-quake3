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

(function( $ ){
    var reqAnimFrame = (function(){
      return  window.requestAnimationFrame       || 
              window.webkitRequestAnimationFrame || 
              window.mozRequestAnimationFrame    || 
              window.oRequestAnimationFrame      || 
              window.msRequestAnimationFrame     || 
              function(callback, element){
                window.setTimeout(callback, 1000 / 60);
              };
    })();

    $.fn.requestAnimation = function(callback) {
        var startTime;
        if(window.mozAnimationStartTime) {
            startTime = window.mozAnimationStartTime;
        } else if (window.webkitAnimationStartTime) {
            startTime = window.webkitAnimationStartTime;
        } else {
            startTime = new Date().getTime();
        }
        
        return this.each(function() {
            var element = this;
            var lastTimestamp = startTime;
            var lastFps = startTime;
            var framesPerSecond = 0;
            var frameCount = 0;
            
            function onFrame(timestamp){
                if(!timestamp) {
                    timestamp = new Date().getTime();
                }

                // Update FPS if a second or more has passed since last FPS update
                if(timestamp - lastFps >= 1000) {
                    framesPerSecond = frameCount;
                    frameCount = 0;
                    lastFps = timestamp;
                } 
                
                if(callback({
                    timestamp: timestamp,
                    elapsed: timestamp - startTime,
                    frameTime: timestamp - lastTimestamp,
                    framesPerSecond: framesPerSecond,
                }) !== false) {
                    reqAnimFrame(onFrame, element);
                    ++frameCount;
                }
            };
            
            onFrame(startTime);
        });
    };
})( jQuery );
