// Packed-alpha H.264: RGB is the top half, grayscale alpha is the bottom half.
// Canvas is genuinely transparent. A CSS key/green-screen or oval shadow is never used.

export class PackedAlphaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!this.gl) throw new Error('WebGL unavailable');
    this.lost = false;
    this.initialize();
    this.onLost = event => {
      event.preventDefault();
      this.lost = true;
      canvas.dispatchEvent(new CustomEvent('fashion:render-lost', { bubbles: true }));
    };
    this.onRestored = () => {
      try {
        // Restored contexts retain no shaders, buffers, textures or GL state.
        this.initialize();
        this.lost = false;
        canvas.dispatchEvent(new CustomEvent('fashion:render-restored', { bubbles: true }));
      } catch (error) {
        canvas.dispatchEvent(new CustomEvent('fashion:render-error', { bubbles: true, detail: error.message }));
      }
    };
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
  }

  initialize() {
    const gl = this.gl;
    const vertex = `attribute vec2 position; varying highp vec2 uv;
      void main(){uv=vec2((position.x+1.0)*0.5,(1.0-position.y)*0.5);gl_Position=vec4(position,0.0,1.0);}`;
    const fragment = `precision highp float; varying highp vec2 uv; uniform sampler2D frame;
      void main(){
        // Rasterized uv already addresses pixel centers. An additional inset
        // scales the halves differently and resamples RGB against its matte.
        float colorY=uv.y*0.5;
        float maskY=0.5+uv.y*0.5;
        vec3 rgb=texture2D(frame,vec2(uv.x,colorY)).rgb;
        float alpha=texture2D(frame,vec2(uv.x,maskY)).r;
        gl_FragColor=vec4(rgb*alpha,alpha);
      }`;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    this.program = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); gl.linkProgram(this.program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    gl.useProgram(this.program);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(video) {
    if (this.lost || video.readyState < 2 || !video.videoWidth) return false;
    const gl = this.gl;
    const width = video.videoWidth, height = Math.round(video.videoHeight / 2);
    // Native movie resolution keeps hair mattes stable; no CSS upscaling of a tiny backing store.
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height; gl.viewport(0, 0, width, height);
    }
    gl.useProgram(this.program); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return gl.getError() === gl.NO_ERROR;
  }

  destroy() {
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    if (!this.lost) { this.gl.deleteTexture(this.texture); this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program); }
  }
}
