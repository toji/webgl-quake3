/*
 * Copyright (c) 2019 Brandon Jones
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

// This file contains the code both for the main thread interface and the
// worker that does the transcoding.
const IN_WORKER = typeof importScripts === "function";
const SCRIPT_PATH = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;

if (!IN_WORKER) {
  //
  // Main Thread
  //
  class PendingTextureRequest {
    constructor(gl, url) {
      this.gl = gl;
      this.url = url;
      this.texture = null;
      this.alphaTexture = null;
      this.promise = new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }

    uploadImageData(webglFormat, buffer, mipLevels) {
      let gl = this.gl;
      let texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipLevels.length > 1 || webglFormat.uncompressed ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);

      let levelData = null;

      for (let mipLevel of mipLevels) {
        if (!webglFormat.uncompressed) {
          levelData = new Uint8Array(buffer, mipLevel.offset, mipLevel.size);
          gl.compressedTexImage2D(
            gl.TEXTURE_2D,
            mipLevel.level,
            webglFormat.format,
            mipLevel.width,
            mipLevel.height,
            0,
            levelData);
        } else {
          switch (webglFormat.type) {
            case WebGLRenderingContext.UNSIGNED_SHORT_4_4_4_4:
            case WebGLRenderingContext.UNSIGNED_SHORT_5_5_5_1:
            case WebGLRenderingContext.UNSIGNED_SHORT_5_6_5:
              levelData = new Uint16Array(buffer, mipLevel.offset, mipLevel.size / 2);
              break;
            default:
              levelData = new Uint8Array(buffer, mipLevel.offset, mipLevel.size);
              break;
          }
          gl.texImage2D(
            gl.TEXTURE_2D,
            mipLevel.level,
            webglFormat.format,
            mipLevel.width,
            mipLevel.height,
            0,
            webglFormat.format,
            webglFormat.type,
            levelData);
        }
      }

      if (webglFormat.uncompressed && mipLevels.length == 1) {
        gl.generateMipmap(gl.TEXTURE_2D);
      }

      return texture;
    }
  };

  class BasisBasics {
    constructor() {
      this.gl = null;
      this.supportedFormats = {};
      this.pendingTextures = {};
      this.nextPendingTextureId = 1;

      // Reload the current script as a worker
      this.worker = new Worker(SCRIPT_PATH);
      this.worker.onmessage = (msg) => {
        // Find the pending texture associated with the data we just received
        // from the worker.
        let pendingTexture = this.pendingTextures[msg.data.id];
        if (!pendingTexture) {
          if (msg.data.error) {
            console.error(`Basis transcode failed: ${msg.data.error}`);
          }
          console.error(`Invalid pending texture ID: ${msg.data.id}`);
          return;
        }

        // Remove the pending texture from the waiting list.
        delete this.pendingTextures[msg.data.id];

        // If the worker indicated an error has occured handle it now.
        if (msg.data.error) {
          console.error(`Basis transcode failed: ${msg.data.error}`);
          pendingTexture.reject(`${msg.data.error}`);
          return;
        }

        // Upload the image data returned by the worker.
        pendingTexture.texture = pendingTexture.uploadImageData(
            msg.data.webglFormat,
            msg.data.buffer,
            msg.data.mipLevels);

        if (msg.data.alphaBuffer) {
          pendingTexture.alphaTexture = pendingTexture.uploadImageData(
              msg.data.webglFormat,
              msg.data.alphaBuffer,
              msg.data.mipLevels);
        }

        pendingTexture.resolve({
          mipLevels: msg.data.mipLevels.length,
          width: msg.data.mipLevels[0].width,
          height: msg.data.mipLevels[0].height,
          alpha: msg.data.hasAlpha,
          texture: pendingTexture.texture,
          alphaTexture: pendingTexture.alphaTexture,
        });
      };
    }

    setContext(gl) {
      if (this.gl != gl) {
        this.gl = gl;
        if (gl) {
          this.supportedFormats = {
            s3tc: !!gl.getExtension('WEBGL_compressed_texture_s3tc'),
            etc1: !!gl.getExtension('WEBGL_compressed_texture_etc1'),
            etc2: !!gl.getExtension('WEBGL_compressed_texture_etc'),
            pvrtc: !!gl.getExtension('WEBGL_compressed_texture_pvrtc'),
            astc: !!gl.getExtension('WEBGL_compressed_texture_astc')
          };
        } else {
          this.supportedFormats = {};
        }
      }
    }

    loadFromUrl(url) {
      let pendingTexture = new PendingTextureRequest(this.gl, url);
      this.pendingTextures[this.nextPendingTextureId] = pendingTexture;

      this.worker.postMessage({
        id: this.nextPendingTextureId,
        url: url,
        supportedFormats: this.supportedFormats
      });

      this.nextPendingTextureId++;
      return pendingTexture.promise;
    }
  }

  window.BasisBasics = BasisBasics;

} else {
  //
  // Worker
  //
  importScripts('basis_transcoder.js');

  let BasisFile = null;

  const BASIS_INITIALIZED = BASIS().then((module) => {
    BasisFile = module.BasisFile;
    module.initializeBasis();
  });

  // Based on transcoder_texture_format enum in basisu_transcoder.h
  const BASIS_FORMAT = {
    // Compressed formats

    // ETC1-2
    ETC1: 0,
    ETC2: 1,

    // BC1-5, BC7
    BC1: 2,
    BC3: 3,
    BC4: 4,
    BC5: 5,
    BC7_M6_OPAQUE_ONLY: 6,
    BC7_M5: 7,

    // PVRTC1 4bpp
    PVRTC1_4_RGB: 8,
    PVRTC1_4_RGBA: 9,

    // ASTC
    ASTC_4x4: 10,

    // ATC
    ATC_RGB: 11,
    ATC_RGBA_INTERPOLATED_ALPHA: 12,

    // Uncompressed (raw pixel) formats
    RGBA32: 13,
    RGB565: 14,
    BGR565: 15,
    RGBA4444: 16,
  };

  // WebGL compressed formats types, from:
  // http://www.khronos.org/registry/webgl/extensions/

  // https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_s3tc/
  const COMPRESSED_RGB_S3TC_DXT1_EXT  = 0x83F0;
  const COMPRESSED_RGBA_S3TC_DXT1_EXT = 0x83F1;
  const COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83F2;
  const COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83F3;

  // https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_etc1/
  const COMPRESSED_RGB_ETC1_WEBGL = 0x8D64

  // https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_etc/
  const COMPRESSED_R11_EAC                        = 0x9270;
  const COMPRESSED_SIGNED_R11_EAC                 = 0x9271;
  const COMPRESSED_RG11_EAC                       = 0x9272;
  const COMPRESSED_SIGNED_RG11_EAC                = 0x9273;
  const COMPRESSED_RGB8_ETC2                      = 0x9274;
  const COMPRESSED_SRGB8_ETC2                     = 0x9275;
  const COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2  = 0x9276;
  const COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2 = 0x9277;
  const COMPRESSED_RGBA8_ETC2_EAC                 = 0x9278;
  const COMPRESSED_SRGB8_ALPHA8_ETC2_EAC          = 0x9279;

  // https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_astc/
  const COMPRESSED_RGBA_ASTC_4x4_KHR = 0x93B0;

  // https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_pvrtc/
  const COMPRESSED_RGB_PVRTC_4BPPV1_IMG = 0x8C00;
  const COMPRESSED_RGB_PVRTC_2BPPV1_IMG  = 0x8C01;
  const COMPRESSED_RGBA_PVRTC_4BPPV1_IMG = 0x8C02;
  const COMPRESSED_RGBA_PVRTC_2BPPV1_IMG = 0x8C03;

  const BASIS_WEBGL_FORMAT_MAP = {};
  // Compressed formats
  BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.BC1] = { format: COMPRESSED_RGB_S3TC_DXT1_EXT };
  BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.BC3] = { format: COMPRESSED_RGBA_S3TC_DXT5_EXT };
  BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.ETC1] = { format: COMPRESSED_RGB_ETC1_WEBGL };
  BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.ETC2] = { format: COMPRESSED_RGBA8_ETC2_EAC };
  BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.ASTC_4x4] = { format: COMPRESSED_RGBA_ASTC_4x4_KHR };
  BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.PVRTC1_4_RGB] = { format: COMPRESSED_RGB_PVRTC_4BPPV1_IMG };
  BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.PVRTC1_4_RGBA] = { format: COMPRESSED_RGBA_PVRTC_4BPPV1_IMG };

  // Uncompressed formats
  BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.RGBA32] = { uncompressed: true, format: WebGLRenderingContext.RGBA, type: WebGLRenderingContext.UNSIGNED_BYTE };
  BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.RGB565] = { uncompressed: true, format: WebGLRenderingContext.RGB, type: WebGLRenderingContext.UNSIGNED_SHORT_5_6_5 };
  BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.RGBA4444] = { uncompressed: true, format: WebGLRenderingContext.RGBA, type: WebGLRenderingContext.UNSIGNED_SHORT_4_4_4_4 };

  // Notifies the main thread when a texture has failed to load for any reason.
  function fail(id, errorMsg) {
    postMessage({
      id: id,
      error: errorMsg
    });
  }

  function basisFileFail(id, basisFile, errorMsg) {
    fail(id, errorMsg);
    basisFile.close();
    basisFile.delete();
  }

  // This utility currently only transcodes the first image in the file.
  const IMAGE_INDEX = 0;
  const TOP_LEVEL_MIP = 0;

  function transcode(id, arrayBuffer, supportedFormats) {
    let basisData = new Uint8Array(arrayBuffer);

    let basisFile = new BasisFile(basisData);
    let images = basisFile.getNumImages();
    let levels = basisFile.getNumLevels(IMAGE_INDEX);
    let hasAlpha = basisFile.getHasAlpha();
    if (!images || !levels) {
      basisFileFail(id, basisFile, 'Invalid Basis data');
      return;
    }

    if (!basisFile.startTranscoding()) {
      basisFileFail(id, basisFile, 'startTranscoding failed');
      return;
    }

    let basisFormat = undefined;
    let needsSecondaryAlpha = false;
    if (hasAlpha) {
      if (supportedFormats.etc2) {
        basisFormat = BASIS_FORMAT.ETC2;
      } else if (supportedFormats.s3tc) {
        basisFormat = BASIS_FORMAT.BC3;
      } else if (supportedFormats.astc) {
        basisFormat = BASIS_FORMAT.ASTC_4x4;
      } else if (supportedFormats.pvrtc) {
        basisFormat = BASIS_FORMAT.PVRTC1_4_RGBA;
      } /*else if (supportedFormats.etc1) {
        basisFormat = BASIS_FORMAT.ETC1;
        needsSecondaryAlpha = true;
      }*/ else {
        // If we don't support any appropriate compressed formats transcode to
        // raw pixels. This is something of a last resort, because the GPU
        // upload will be significantly slower and take a lot more memory, but
        // at least it prevents you from needing to store a fallback JPG/PNG and
        // the download size will still likely be smaller.
        basisFormat = BASIS_FORMAT.RGBA32;
      } 
    } else {
      if (supportedFormats.etc1) {
        // Should be the highest quality, so use when available.
        // http://richg42.blogspot.com/2018/05/basis-universal-gpu-texture-format.html
        basisFormat = BASIS_FORMAT.ETC1;
      } else if (supportedFormats.s3tc) {
        basisFormat = BASIS_FORMAT.BC1;
      } else if (supportedFormats.etc2) {
        // This will include an alpha channel, which isn't ideal, but it's still
        // better than using uncompressed pixels.
        basisFormat = BASIS_FORMAT.ETC2;
      } else if (supportedFormats.astc) {
        // This will include an alpha channel, which isn't ideal, but it's still
        // better than using uncompressed pixels.
        basisFormat = BASIS_FORMAT.ASTC_4x4;
      } else if (supportedFormats.pvrtc) {
        basisFormat = BASIS_FORMAT.PVRTC1_4_RGB;
      } else {
        // See note on uncompressed transcode above.
        basisFormat = BASIS_FORMAT.RGB565;
      }
    }
    
    if (basisFormat === undefined) {
      basisFileFail(id, basisFile, 'No supported transcode formats');
      return;
    }

    let webglFormat = BASIS_WEBGL_FORMAT_MAP[basisFormat];

    // If we're not using compressed textures it'll be cheaper to generate
    // mipmaps on the fly, so only transcode a single level.
    if (webglFormat.uncompressed) {
      levels = 1;
    }

    // Gather information about each mip level to be transcoded.
    let mipLevels = [];
    let totalTranscodeSize = 0;

    for (let mipLevel = 0; mipLevel < levels; ++mipLevel) {
      let transcodeSize = basisFile.getImageTranscodedSizeInBytes(IMAGE_INDEX, mipLevel, basisFormat);
      mipLevels.push({
        level: mipLevel,
        offset: totalTranscodeSize,
        size: transcodeSize,
        width: basisFile.getImageWidth(IMAGE_INDEX, mipLevel),
        height: basisFile.getImageHeight(IMAGE_INDEX, mipLevel),
      });
      totalTranscodeSize += transcodeSize;
    }

    // Allocate a buffer large enough to hold all of the transcoded mip levels at once.
    let transcodeData = new Uint8Array(totalTranscodeSize);
    let alphaTranscodeData = needsSecondaryAlpha ? new Uint8Array(totalTranscodeSize) : null;

    // Transcode each mip level into the appropriate section of the overall buffer.
    for (let mipLevel of mipLevels) {
      let levelData = new Uint8Array(transcodeData.buffer, mipLevel.offset, mipLevel.size);
      if (!basisFile.transcodeImage(levelData, IMAGE_INDEX, mipLevel.level, basisFormat, 1, 0)) {
        basisFileFail(id, basisFile, 'transcodeImage failed');
        return;
      }
      if (needsSecondaryAlpha) {
        let alphaLevelData = new Uint8Array(alphaTranscodeData.buffer, mipLevel.offset, mipLevel.size);
        if (!basisFile.transcodeImage(alphaLevelData, IMAGE_INDEX, mipLevel.level, basisFormat, 1, 1)) {
          basisFileFail(id, basisFile, 'alpha transcodeImage failed');
          return;
        }
      }
    }

    basisFile.close();
    basisFile.delete();

    // Post the transcoded results back to the main thread.
    let transferList = [transcodeData.buffer];
    if (needsSecondaryAlpha) {
      transferList.push(alphaTranscodeData.buffer);
    }
    postMessage({
      id: id,
      buffer: transcodeData.buffer,
      alphaBuffer: needsSecondaryAlpha ? alphaTranscodeData.buffer : null,
      webglFormat: webglFormat,
      mipLevels: mipLevels,
      hasAlpha: hasAlpha,
    }, transferList);
  }

  onmessage = (msg) => {
    // Each call to the worker must contain:
    let url = msg.data.url; // The URL of the basis image OR
    let buffer = msg.data.buffer; // An array buffer with the basis image data
    let supportedFormats = msg.data.supportedFormats; // The formats this device supports
    let id = msg.data.id; // A unique ID for the texture

    if (url) {
      // Make the call to fetch the basis texture data
      fetch(`../../${url}`).then(function(response) {
        if (response.ok) {
          response.arrayBuffer().then((arrayBuffer) => {
            if (BasisFile) {
              transcode(id, arrayBuffer, supportedFormats);
            } else {
              BASIS_INITIALIZED.then(() => {
                transcode(id, arrayBuffer, supportedFormats);
              });
            }
          });
        } else {
          fail(id, `Fetch failed: ${response.status}, ${response.statusText}`);
        }
      });
    } else if (buffer) {
      if (BasisFile) {
        transcode(id, buffer, supportedFormats);
      } else {
        BASIS_INITIALIZED.then(() => {
          transcode(id, buffer, supportedFormats);
        });
      }
    } else {
      fail(id, `No url or buffer specified`);
    }
  };
}