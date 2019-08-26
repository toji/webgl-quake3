// This file contains the code both for the main thread interface and the
// worker that does the transcoding.
const IN_WORKER = (typeof importScripts==="function");

if (!IN_WORKER) {
  //
  // Main Thread
  //
  class PendingTextureRequest {
    constructor(gl, url, texture) {
      this.gl = gl;
      this.url = url;
      this.texture = texture;
      this.promise = new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }

    uploadCompressedData(format, buffer, mipLevels) {
      let gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipLevels.length > 1 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);

      for (let mipLevel of mipLevels) {
        let levelData = new Uint8Array(buffer, mipLevel.offset, mipLevel.size);
        gl.compressedTexImage2D(
          gl.TEXTURE_2D,
          mipLevel.level,
          format,
          mipLevel.width,
          mipLevel.height,
          0,
          levelData);
      }
    }
  };

  class BasisBasics {
    constructor() {
      this.pendingTextures = {};
      this.nextPendingTextureId = 1;

      // Reload the current script as a worker
      this.worker = new Worker('js/basis/basis-basics.js');
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

        // Upload the DXT data returned by the worker.
        pendingTexture.uploadCompressedData(
          msg.data.format,
          msg.data.buffer,
          msg.data.mipLevels);
        pendingTexture.resolve(pendingTexture.texture);
      };
    }

    loadFromUrl(gl, url, texture) {
      if (!texture) {
        texture = gl.createTexture();
      }

      // TODO: Not this
      gl.getExtension('WEBGL_compressed_texture_s3tc');

      let pendingTexture = new PendingTextureRequest(gl, url, texture);
      this.pendingTextures[this.nextPendingTextureId] = pendingTexture;

      this.worker.postMessage({
        id: this.nextPendingTextureId,
        url: url,
        format: null
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

  const BASIS_FORMAT = {
    ETC1: 0,
    BC1: 1,
    BC4: 2,
    PVRTC1_4_OPAQUE_ONLY: 3,
    BC7_M6_OPAQUE_ONLY: 4,
    ETC2: 5,
    BC3: 6,
    BC5: 7,
  };

  // DXT formats, from:
  // http://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_s3tc/
  const COMPRESSED_RGB_S3TC_DXT1_EXT  = 0x83F0;
  const COMPRESSED_RGBA_S3TC_DXT1_EXT = 0x83F1;
  const COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83F2;
  const COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83F3;

  const DXT_FORMAT_MAP = {};
  DXT_FORMAT_MAP[BASIS_FORMAT.BC1] = COMPRESSED_RGB_S3TC_DXT1_EXT;
  DXT_FORMAT_MAP[BASIS_FORMAT.BC3] = COMPRESSED_RGBA_S3TC_DXT5_EXT;

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

  function transcode(id, arrayBuffer, format) {
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

    // TODO: Map based on input format
    let basisFormat = BASIS_FORMAT.BC1;
    if (hasAlpha) {
      basisFormat = BASIS_FORMAT.BC3;
    }
    let webglFormat = DXT_FORMAT_MAP[basisFormat];

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

    // Transcode each mip level into the appropriate section of the overall buffer.
    for (let mipLevel of mipLevels) {
      let levelData = new Uint8Array(transcodeData.buffer, mipLevel.offset, mipLevel.size);
      if (!basisFile.transcodeImage(levelData, IMAGE_INDEX, mipLevel.level, basisFormat, 1, 0)) {
        basisFileFail(id, basisFile, 'transcodeImage failed');
        return;
      }
    }

    basisFile.close();
    basisFile.delete();

    // Post the transcoded results back to the main thread.
    postMessage({
      id: id,
      buffer: transcodeData.buffer,
      format: webglFormat,
      mipLevels: mipLevels
    }, [transcodeData.buffer]);
  }

  onmessage = (msg) => {
    // Each call to the worker must contain:
    let url = msg.data.url; // The URL of the basis image OR
    let buffer = msg.data.buffer; // An array buffer with the basis image data
    let format = msg.data.format; // The format to transcode to
    let id = msg.data.id; // A unique ID for the texture

    if (url) {
      // Make the call to fetch the basis texture data
      fetch(`../../${url}`).then(function(response) {
        if (response.ok) {
          response.arrayBuffer().then((arrayBuffer) => {
            if (BasisFile) {
              transcode(id, arrayBuffer, format);
            } else {
              BASIS_INITIALIZED.then(() => {
                transcode(id, arrayBuffer, format);
              });
            }
          });
        } else {
          fail(id, `Fetch failed: ${response.status}, ${response.statusText}`);
        }
      });
    } else if (buffer) {
      if (BasisFile) {
        transcode(id, buffer, format);
      } else {
        BASIS_INITIALIZED.then(() => {
          transcode(id, buffer, format);
        });
      }
    } else {
      fail(id, `No url or buffer specified`);
    }
  };
}