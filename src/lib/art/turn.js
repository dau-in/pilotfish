// Turning the mouse over and looking round it, in WebGL. The top drawing is laid on a height field shaped like
// the X11 (low at the front, highest at the hump, rounding down to the desk at the edges); the underside drawing
// lies on a flat base under it, and a wall closes the gap all round. Where the flank is too steep to carry the top
// drawing, it shows a drawing of the side instead, side buttons included. The textures are made from the same
// SVG the page shows, so at rest the canvas matches the page exactly and swapping between them is invisible.
// Lighting is relative to the rest pose: a face is exactly as drawn when it faces you, and brightens or darkens
// only as it turns.
export const TURN = (() => {
  const VS = `
    attribute vec2 aXY;    // drawing units, 0..760 x 0..1523
    attribute float aH;    // height in drawing units at full inflation
    attribute vec2 aG;     // top surface: dH/dx, dH/dy. Walls: their outward normal across the desk
    attribute float aFace; // 0 top surface, 1 base, 2 wall along the top edge, 3 wall along the desk
    uniform vec2 uRes, uOrigin, uEye;
    uniform float uScale, uInflate, uAngle, uTilt, uLift, uD, uZ0;
    varying vec2 vUV; varying vec3 vN; varying vec3 vRest; varying float vFace; varying vec2 vXY; varying float vH;
    vec3 turn(vec3 v, float c, float s, float ct, float st) {
      v = vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
      return vec3(v.x, v.y * ct - v.z * st, v.y * st + v.z * ct);
    }
    void main() {
      float c = cos(uAngle), s = sin(uAngle), ct = cos(uTilt), st = sin(uTilt);
      bool base = aFace > 0.5 && aFace < 1.5, desk = aFace > 2.5;
      float z = base || desk ? -4.0 : aH * uInflate;
      vec3 p = turn(vec3(aXY.x - 380.0, aXY.y - 761.5, z - uZ0), c, s, ct, st);
      vec3 w = p * uScale; w.z += uLift;
      vec2 at = uOrigin + vec2(380.0, 761.5) * uScale + w.xy;
      float hw = (uD - w.z) / uD;                 // homogeneous w: perspective-correct texturing
      vec2 ndc = (uEye * hw + at - uEye) / uRes * 2.0 - hw;
      gl_Position = vec4(ndc.x, -ndc.y, -w.z / 4000.0 * hw, hw);
      vec3 n = aFace < 0.5 ? normalize(vec3(-aG * uInflate, 1.0)) : base ? vec3(0.0, 0.0, -1.0) : vec3(aG, 0.0);
      vN = turn(n, c, s, ct, st);
      vRest = base ? vec3(0.0, 0.0, 1.0) : n;
      vUV = base ? vec2(1.0 - aXY.x / 760.0, aXY.y / 1523.0) : aXY / vec2(760.0, 1523.0);
      vFace = aFace; vXY = aXY; vH = desk ? 0.0 : aH;
    }`;
  const FS = `
    precision mediump float;
    uniform sampler2D uTop, uUnder, uSide;
    uniform vec3 uWall;
    uniform float uHmax;
    varying vec2 vUV; varying vec3 vN; varying vec3 vRest; varying float vFace; varying vec2 vXY; varying float vH;
    const vec3 L = vec3(-0.42, -0.5, 0.76);
    // Distance to a rounded rectangle of half size b and corner radius r: negative inside.
    float rr(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    // The side drawing at a point of the flank: along the mouse, and up from the desk. Left flank above, right below.
    vec3 sideAt(vec2 xy, float h) {
      float v = clamp(1.0 - h / uHmax, 0.0, 1.0) * 0.5 + (xy.x > 380.0 ? 0.5 : 0.0);
      return texture2D(uSide, vec2(xy.y / 1523.0, v)).rgb;
    }
    void main() {
      vec3 n = normalize(vN), r = normalize(vRest), l = normalize(L);
      float now = dot(n, l), rest = dot(r, l);
      float lit = 0.6 + 0.5 * max(now, 0.0);
      if (vFace > 1.5) {
        // The walls round the edge. The sides carry the side drawing; the front and back are plain shell, with
        // the opening of the USB-C port low in the front, between the button tips.
        vec3 col = abs(r.y) > 0.7 ? uWall : sideAt(vXY, vH);
        if (r.y < -0.7) {
          // The port, low on the block's front face: a raised collar that catches the light, its rim, the dark
          // opening and the socket's tongue inside it.
          vec2 p = vec2(vXY.x - 380.0, vH - 84.0);
          float dc = rr(p, vec2(46.0, 25.0), 14.0);
          col = mix(col, min(col * 1.16 + 0.05, vec3(1.0)), 1.0 - smoothstep(-1.0, 1.0, dc));
          col = mix(col, col * 0.55, (1.0 - smoothstep(0.0, 2.5, abs(dc))) * 0.7);
          col = mix(col, vec3(0.025), 1.0 - smoothstep(-1.0, 1.0, rr(p, vec2(29.0, 10.0), 10.0)));
          col = mix(col, vec3(0.34), 1.0 - smoothstep(-0.8, 0.8, rr(p, vec2(18.0, 2.6), 2.6)));
        }
        gl_FragColor = vec4(col * lit, 1.0);
        return;
      }
      vec4 t = vFace > 0.5 ? texture2D(uUnder, vUV) : texture2D(uTop, vUV);
      float f = clamp(1.0 + 0.7 * (now - rest), 0.32, 1.45);
      if (vFace > 0.5) {
        if (t.a < 0.02) discard;
        gl_FragColor = vec4(t.rgb * f, t.a);        // textures are premultiplied
        return;
      }
      // A steep flank holds only a sliver of the top drawing, the antialiased edge included; turned towards you it
      // would smear that sliver into streaks. Where it would stretch, the flank shows the side drawing instead,
      // solid, lit as it faces the light. The mesh's own edge is antialiased by the canvas.
      float stretch = max(n.z, 0.0) / max(r.z, 0.04);
      float wall = smoothstep(1.5, 3.0, stretch);
      float a = mix(t.a, 1.0, wall);
      if (a < 0.02) discard;
      gl_FragColor = vec4(mix(t.rgb * f, sideAt(vXY, vH) * lit, wall), a);
    }`;

  // Centre-line height from front (0) to back (1), as a share of the highest point; the X11 is about 38.5 mm
  // tall over 124 mm, so the hump stands about 470 drawing units high.
  const PROFILE = [[0, 0.5], [0.1, 0.58], [0.25, 0.72], [0.45, 0.9], [0.6, 1], [0.72, 0.98], [0.84, 0.86], [0.92, 0.66], [0.97, 0.42], [1, 0.12]];
  const HMAX = 470, K = 2.6, NU = 96, NY = 220;
  const profile = t => {
    for (let i = 1; i < PROFILE.length; i++) {
      const [t1, v1] = PROFILE[i];
      if (t <= t1) { const [t0, v0] = PROFILE[i - 1], f = (t - t0) / (t1 - t0); return v0 + (v1 - v0) * f * f * (3 - 2 * f); }
    }
    return PROFILE.at(-1)[1];
  };
  // The centre height at y, for drawings that must line up with the turning shape (the flanks).
  const hc = y => HMAX * profile(Math.min(1, Math.max(0, y / 1523)));

  function mesh(bodyPath) {
    // Half width of the outline in each row, from a raster of the path.
    const cv = document.createElement('canvas'); cv.width = 380; cv.height = 762;
    const cx = cv.getContext('2d'); cx.scale(0.5, 0.5); cx.fill(new Path2D(bodyPath));
    const px = cx.getImageData(0, 0, 380, 762).data;
    // The edge is read to a fraction of a pixel from the antialiased coverage of the first pixel it crosses,
    // then smoothed over a few rows: on a steep flank a one-pixel step would show as a band of light.
    const raw = new Float32Array(762), half = new Float32Array(762);
    for (let r = 0; r < 762; r++) {
      let x = 0;
      while (x < 190 && px[(r * 380 + x) * 4 + 3] <= 8) x++;
      const edge = x < 190 ? x + 1 - px[(r * 380 + x) * 4 + 3] / 255 : 190;
      raw[r] = Math.max(1, 190 - edge) * 2;
    }
    for (let r = 0; r < 762; r++) {
      let s = 0, n = 0;
      for (let k = -2; k <= 2; k++) { const q = r + k; if (q >= 0 && q < 762) { s += raw[q]; n++; } }
      half[r] = s / n;
    }
    const halfAt = y => { const r = Math.min(761, Math.max(0, y / 2)), r0 = Math.floor(r), r1 = Math.min(761, r0 + 1); return half[r0] + (half[r1] - half[r0]) * (r - r0); };
    const H = (x, y) => {
      const u = Math.abs(x - 380) / halfAt(y);
      return u >= 1 ? 0 : HMAX * profile(y / 1523) * Math.pow(1 - Math.pow(u, K), 1 / K);
    };
    // Each row runs exactly from one edge of the outline to the other, with columns packed towards the edges
    // where the flank drops steeply, so the silhouette is the outline itself and the wall has no steps.
    const verts = [], idx = [];
    const at = (j, i) => j * (NU + 1) + i;
    for (let j = 0; j <= NY; j++) {
      const y = Math.min(1522, (j / NY) * 1523), w = halfAt(y);
      for (let i = 0; i <= NU; i++) {
        const s = (i / NU) * 2 - 1, u = Math.sin((s * Math.PI) / 2) * 0.9995;
        const x = 380 + u * w, e = 2;
        verts.push(x, y, H(x, y), (H(x + e, y) - H(x - e, y)) / (2 * e), (H(x, y + e) - H(x, y - e)) / (2 * e), 0);
      }
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NU; i++) {
      const a = at(j, i), b = a + 1, c = a + NU + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    // Walls from the top surface's edge down to the desk: a skirt along each side (the flank stops a little
    // above the desk) and a face across the front and the back. Each strip is a run of surface vertices,
    // repeated once at the top edge and once on the desk, with the wall's outward normal.
    const vx = k => [verts[k * 6], verts[k * 6 + 1], verts[k * 6 + 2]];
    const strip = (keys, normal) => {
      const first = verts.length / 6;
      keys.forEach((k, n) => {
        const [x, y, h] = vx(k), [nx, ny] = normal(n, keys);
        verts.push(x, y, h, nx, ny, 2, x, y, 0, nx, ny, 3);
      });
      for (let n = 0; n < keys.length - 1; n++) {
        const t0 = first + n * 2, b0 = t0 + 1, t1 = t0 + 2, b1 = t0 + 3;
        idx.push(t0, b0, t1, t1, b0, b1);
      }
    };
    // Along a side, the normal is square to the edge, pointing away from the middle.
    const across = (n, keys) => {
      const [x0, y0] = vx(keys[Math.max(0, n - 1)]), [x1, y1] = vx(keys[Math.min(keys.length - 1, n + 1)]);
      let nx = y1 - y0, ny = -(x1 - x0); const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      return vx(keys[n])[0] < 380 === nx < 0 ? [nx, ny] : [-nx, -ny];
    };
    const rows = j => Array.from({ length: NU + 1 }, (_, i) => at(j, i));
    const cols = i => Array.from({ length: NY + 1 }, (_, j) => at(j, i));
    strip(cols(0), across); strip(cols(NU), across);
    strip(rows(0), () => [0, -1]); strip(rows(NY), () => [0, 1]);
    const base = verts.length / 6;
    for (const [x, y] of [[0, 0], [760, 0], [0, 1523], [760, 1523]]) verts.push(x, y, 0, 0, 0, 1);
    idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    return { verts: new Float32Array(verts), idx: new Uint16Array(idx) };
  }

  function create(canvas, bodyPath) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: true, alpha: true });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const m = mesh(bodyPath);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, m.verts, gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    const attr = (name, size, offset) => { const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 24, offset); };
    attr('aXY', 2, 0); attr('aH', 1, 8); attr('aG', 2, 12); attr('aFace', 1, 20);
    const U = n => gl.getUniformLocation(prog, n);
    const loc = Object.fromEntries(['uRes', 'uOrigin', 'uEye', 'uScale', 'uInflate', 'uAngle', 'uTilt', 'uLift', 'uD', 'uZ0', 'uTop', 'uUnder', 'uSide', 'uWall', 'uHmax'].map(n => [n, U(n)]));
    // Texture units: 0 the top, 1 the underside, 2 the flanks.
    const tex = [gl.createTexture(), gl.createTexture(), gl.createTexture()];
    tex.forEach((t, i) => {
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    });
    gl.uniform1i(loc.uTop, 0); gl.uniform1i(loc.uUnder, 1); gl.uniform1i(loc.uSide, 2); gl.uniform1f(loc.uHmax, HMAX);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // An SVG string becomes a texture through an image, at the resolution it will be seen at.
    async function face(i, svg) {
      const img = new Image();
      img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      await img.decode();
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[i]);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      URL.revokeObjectURL(img.src);
    }

    // frame: { res: [w, h], origin: [x, y], eye: [x, y], scale, inflate, angle, tilt, lift, d, wall: [r, g, b] }
    // angle rolls the mouse round its length; tilt then tips it towards or away from you. wall is the shell's
    // own colour, 0..1, for the front and back.
    function draw(f) {
      const dpr = devicePixelRatio || 1;
      const W = Math.round(f.res[0] * dpr), Hh = Math.round(f.res[1] * dpr);
      if (canvas.width !== W || canvas.height !== Hh) { canvas.width = W; canvas.height = Hh; }
      gl.viewport(0, 0, W, Hh);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform2f(loc.uRes, f.res[0], f.res[1]); gl.uniform2f(loc.uOrigin, f.origin[0], f.origin[1]); gl.uniform2f(loc.uEye, f.eye[0], f.eye[1]);
      gl.uniform1f(loc.uScale, f.scale); gl.uniform1f(loc.uInflate, f.inflate); gl.uniform1f(loc.uAngle, f.angle); gl.uniform1f(loc.uTilt, f.tilt);
      gl.uniform1f(loc.uLift, f.lift); gl.uniform1f(loc.uD, f.d); gl.uniform1f(loc.uZ0, 0.42 * HMAX * f.inflate);
      gl.uniform3fv(loc.uWall, f.wall ?? [0.82, 0.13, 0.12]);
      // The face turned towards you is drawn last, so its antialiased rim blends over the other.
      const topFirst = Math.cos(f.angle) * Math.cos(f.tilt) < 0, top = m.idx.length - 6;
      const parts = topFirst ? [[0, top], [top, 6]] : [[top, 6], [0, top]];
      for (const [start, count] of parts) gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, start * 2);
    }
    return { face, draw, HMAX };
  }
  return { create, hc, HMAX };
})();
