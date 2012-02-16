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

// Account for CommonJS environments
(function(global) {
    "use strict";

    var elementPrototype = (global.HTMLElement || global.Element)["prototype"];
    
    //=====================
    // Animation
    //=====================
    
    // window.requestAnimationFrame
    if(!window.requestAnimationFrame) {
        window.requestAnimationFrame = (function(){
            return  window.webkitRequestAnimationFrame || 
                    window.mozRequestAnimationFrame    || 
                    window.oRequestAnimationFrame      || 
                    window.msRequestAnimationFrame     || 
                    function(callback, element){
                      window.setTimeout(function() {
                          callback(new Date().getTime());
                      }, 1000 / 60);
                    };
        })();
    }
    
    // window.animationStartTime
    if(!window.animationStartTime) {
        window.animationStartTime = window.webkitAnimationStartTime || 
        window.mozAnimationStartTime ||
        new Date().getTime();
    }
    
    //=====================
    // Fullscreen
    //=====================
    
    // document.isFullScreen
    if(!document.hasOwnProperty("fullscreenEnabled")) {
        var getter = (function() {
            // These are the functions that match the spec, and should be preferred
            if("webkitIsFullScreen" in document) {
                return function() { return document.webkitIsFullScreen; }
            }
            if("mozFullScreen" in document) {
                return function() { return document.mozFullScreen; }
            }
            return function() { return false }; // not supported, never fullscreen
        })();
        
        Object.defineProperty(document, "fullscreenEnabled", { 
            enumerable: true, configurable: false, writeable: false,
            get: getter
        });
    }
    
    if(!document.hasOwnProperty("fullscreenElement")) {
        var getter = (function() {
            // These are the functions that match the spec, and should be preferred
            if("webkitFullscreenElement" in document) {
                return function() { return document.webkitFullscreenElement; }
            }
            if("mozFullscreenElemen" in document) {
                return function() { return document.mozFullscreenElemen; }
            }
            return function() { return null }; // not supported
        })();
        
        Object.defineProperty(document, "fullscreenElement", { 
            enumerable: true, configurable: false, writeable: false,
            get: getter
        });
    }
    
    // Document event: fullscreenchange
    function fullscreenchange(oldEvent) {
        var newEvent = document.createEvent("CustomEvent");
        newEvent.initCustomEvent("fullscreenchange", true, false, null);
        // TODO: Any need for variable copy?
        document.dispatchEvent(newEvent);
    }
    document.addEventListener("webkitfullscreenchange", fullscreenchange, false);
    document.addEventListener("mozfullscreenchange", fullscreenchange, false);
    
    // Document event: fullscreenerror
    function fullscreenerror(oldEvent) {
        var newEvent = document.createEvent("CustomEvent");
        newEvent.initCustomEvent("fullscreenerror", true, false, null);
        // TODO: Any need for variable copy?
        document.dispatchEvent(newEvent);
    }
    document.addEventListener("webkitfullscreenerror", fullscreenerror, false);
    document.addEventListener("mozfullscreenerror", fullscreenerror, false);
    
    // element.requestFullScreen
    if(!elementPrototype.requestFullScreen) {
        elementPrototype.requestFullScreen = (function() {
            if(elementPrototype.webkitRequestFullScreen) {
                return function() {
                    this.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
                }
            }
            
            return  elementPrototype.mozRequestFullScreen    || 
                    function(){ /* unsupported, fail silently */ };
        })();
    }
    
    // document.exitFullscreen
    if(!document.exitFullscreen) {
        document.exitFullscreen = (function() {
            return  document.webkitExitFullscreen ||
                    document.mozExitFullscreen || 
                    function(){ /* unsupported, fail silently */ };
        })();
    }
    
    //=====================
    // Mouse Lock
    //=====================

    // Navigator pointer is not the right interface according to spec.
    // Here for backwards compatibility only
    if(!navigator.pointer) {
        navigator.pointer = navigator.webkitPointer || navigator.mozPointer;
    }
    
    // document.pointerLockEnabled
    if(!document.hasOwnProperty("pointerLockEnabled")) {
        var getter = (function() {
            // These are the functions that match the spec, and should be preferred
            if("webkitPointerLockEnabled" in document) {
                return function() { return document.webkitPointerLockEnabled; }
            }
            if("mozPointerLockEnabled" in document) {
                return function() { return document.mozPointerLockEnabled; }
            }
    
            // Early versions of the spec managed mouselock through the pointer object
            if(navigator.pointer) {
                if(typeof(navigator.pointer.isLocked) === "boolean") {
                    // Chrome initially launched with this interface
                    return function() { return navigator.pointer.isLocked; }
                } else if(typeof(navigator.pointer.isLocked) === "function") {
                    // Some older builds might provide isLocked as a function
                    return function() { return navigator.pointer.isLocked(); }
                } else if(typeof(navigator.pointer.islocked) === "function") {
                    // For compatibility with early Firefox build
                    return function() { return navigator.pointer.islocked(); }
                }
            }
            return function() { return false }; // not supported, never locked
        })();
        
        Object.defineProperty(document, "pointerLockEnabled", { 
            enumerable: true, configurable: false, writeable: false,
            get: getter
        });
    }
    
    // element.requestPointerLock
    if(!elementPrototype.requestPointerLock) {
        elementPrototype.requestPointerLock = (function() {
            return  elementPrototype.webkitRequestPointerLock || 
                    elementPrototype.mozRequestPointerLock    || 
                    function(){
                        if(navigator.pointer) { 
                            var elem = this;
                            navigator.pointer.lock(elem); 
                        }
                    };
        })();
    }
    
})((typeof(exports) != 'undefined') ? global : window);