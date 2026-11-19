// The Attack Shark X11 in Pilotfish's own drawing style: flat shell colour, ink contours, and light and shade
// drawn as shapes rather than airbrushed. One 760 x 1523 frame serves both faces.
// The top follows the official top render (outline, button panels, wheel, LED behind the buttons).
// The underside follows the product photos: skates, label, buttons, switch, sensor and contacts were measured
// from the straight-on white underside shot and set symmetric around x = 380. Brand logos are left out.
export const X11 = (() => {
  // The front is one piece across: between the two button tips the block that holds the USB-C port comes right
  // forward to meet them, so the outline has no notch.
  const BODY = 'M380 14C400 14 420 13 436 10C436 3 441 0 448 2C540 38 650 80 719 110C736 117 750 140 751 200C752 330 737 470 737 640C737 820 759 960 759 1100C759 1250 705 1350 605 1435C535 1493 460 1523 380 1523C300 1523 225 1493 155 1435C55 1350 1 1250 1 1100C1 960 23 820 23 640C23 470 8 330 9 200C10 140 24 117 41 110C110 80 220 38 312 2C319 0 324 3 324 10C340 13 360 14 380 14Z';
  const RIGHT = 'M383 446L383 728L676 728C704 728 719 712 720 684L722 134C722 124 717 114 707 108C640 77 545 37 448 2C441 0 436 3 436 10L437 418C437 434 428 446 412 446Z';
  const LEFT = 'M377 446L377 728L84 728C56 728 41 712 40 684L38 134C38 124 43 114 53 108C120 77 215 37 312 2C319 0 324 3 324 10L323 418C323 434 332 446 348 446Z';
  // The side buttons sit on the left flank; from above only their outer edge shows.
  // The side buttons: the same length, one behind the other, a short gap between; the turning mouse draws them
  // over the same stretch of its flank (side() below).
  const FORWARD = 'M13 502C9 548 9 682 13 726C18 731 26 732 30 728C33 680 33 550 30 500C26 495 17 496 13 502Z';
  const BACK = 'M10 748C5 798 5 924 10 972C15 978 24 979 29 974C33 922 33 800 29 746C25 740 14 741 10 748Z';
  const mirror = d => d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (m, x, y) => `${760 - +x} ${y}`);

  // Light falls from the upper left. Each tone is a shape with a crisp edge, as an illustrator would cut it:
  // a highlight set in from the left flank, shade on the right, the core of the shade engraved in hatching,
  // and the rear end turning away.
  const TOP_LIGHT = 'M70 190C130 150 220 100 300 52C296 150 252 270 214 380C180 480 166 640 172 820C180 1000 214 1150 284 1290C176 1250 100 1120 76 960C58 820 60 620 62 440C63 320 62 230 70 190Z';
  const TOP_SHADE = 'M604 30C652 180 664 400 654 640C644 860 668 1060 644 1240C622 1380 522 1470 330 1528L800 1560L800 0Z';
  const TOP_DEEP = 'M708 140C726 400 714 700 726 950C736 1150 698 1330 568 1460C508 1500 448 1520 380 1528L800 1560L800 100Z';
  const TOP_REAR = 'M0 1362C120 1468 250 1504 380 1508C510 1504 640 1468 760 1362L760 1560L0 1560Z';

  // Underside, seen from below: the mouse's left side is on the right of the picture.
  // The front skate runs right up to the crease under the button tips, with no shell between them: its top is
  // drawn high and the bevel (TRIM) is laid over it, so the two share one edge. The port's lip, drawn on top,
  // cuts the notch in its middle. Only the rounded ends and the bottom show their own outline.
  const FRONT_SKATE = 'M72 346L72 214Q72 190 92 170L100 40L660 40L668 170Q688 190 688 214L688 346Q688 358 676 358L84 358Q72 358 72 346Z';
  const REAR_SKATE = 'M58 1172Q62 1150 84 1150L128 1152Q146 1154 150 1172C158 1300 250 1410 380 1410C510 1410 602 1300 610 1172Q614 1154 632 1152L676 1150Q698 1150 702 1172C712 1300 600 1508 380 1510C160 1508 48 1300 58 1172Z';
  // The black label: a top band with two wings, cut by the shell's arch around the sensor...
  const LABEL = 'M104 393L656 393Q670 393 670 407L670 794Q670 808 656 808L565 808Q551 808 551 794L551 676C551 640 527 618 491 618L269 618C233 618 209 640 209 676L209 794Q209 808 195 808L104 808Q90 808 90 794L90 407Q90 393 104 393Z';
  // ...and a column inside the arch that runs down past the contacts.
  const COLUMN = 'M225 680C225 652 246 634 274 634L486 634C514 634 535 652 535 680L535 1144Q535 1158 521 1158L239 1158Q225 1158 225 1144Z';
  // Seen from below, the USB-C port is the notch in the front edge between the two button tips: a cavity flush
  // with the shell, with the socket at its inner end facing forward. NOTCH fills exactly the gap in BODY.
  const NOTCH = 'M325 8L435 8L435 76C435 66 426 64 402 64L358 64C334 64 325 66 325 76Z';
  // From below, the front edge is a bevelled band, the tips of the two buttons: it runs unbroken along the edge
  // from each corner to the notch, with one crease where it meets the base. TRIM_L is everything above that
  // crease on the left (clipped to the body); CREASE_L is the crease. The right side is their mirror image.
  const TRIM_L = 'M-10 -10L330 -10L330 84L318 84C288 88 210 118 130 156C98 171 60 190 -10 222Z';
  const CREASE_L = 'M318 84C288 88 210 118 130 156C98 171 60 190 6 214';
  // At the notch's inner end, a raised lip of shell carries the port's slot; it is a little wider than the notch
  // and reaches down into the skate.
  // Seen from below, that block runs from the front edge back into the skate. The port's single opening is at
  // its front edge, where the cable goes in.
  const LIP = 'M318 148L318 24Q318 13 330 13L430 13Q442 13 442 24L442 148Q442 158 432 158L328 158Q318 158 318 148Z';
  // The power switch's three stops, top to bottom: 2.4G, off, Bluetooth.
  // With the cable the switch sits on Off, as it is normally used plugged in.
  const KNOB_Y = { dongle: 608, off: 644, ble: 680, cable: 644 };
  // The drawing is narrowed a little across, to the proportions of the product photo (0.485 wide to 1 long,
  // against 0.499 for the outline as traced). Every shape stays in the 760 frame; BODY_DRAWN is the outline
  // as it ends up on screen, for the 3D turn, the shadow and the glow.
  const NARROW = 0.97, NX = 380 * (1 - NARROW);
  const narrowX = x => 380 + (x - 380) * NARROW;
  const narrowPath = d => d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (m, x, y) => `${+narrowX(+x).toFixed(2)} ${y}`);
  const BODY_DRAWN = narrowPath(BODY);

  // Colours per shell. ink draws contours, seam the joins between parts, light/shade/deep the cut tones.
  const SHELLS = {
    red: { base: '#d1211e', light: '#e9463b', shade: '#a8171a', deep: '#7d0f12', ink: '#3a0507', seam: '#4c0809', rim: '#ff9d92', rimA: 0.55, hatch: '#5a0a0c', hatchA: 0.55,
      knob: '#c41e1b', side: '#c41f1c', sideEdge: '#ff8f84' },
    black: { base: '#26272c', light: '#34353c', shade: '#1a1b1f', deep: '#111114', ink: '#000000', seam: '#050506', rim: '#a3a6b3', rimA: 0.32, hatch: '#000000', hatchA: 0.65,
      knob: '#2c2d33', side: '#2a2b30', sideEdge: '#6c6e79' },
    white: { base: '#e6e6ea', light: '#f8f8fa', shade: '#c9c9d1', deep: '#adadb8', ink: '#55555f', seam: '#6f6f79', rim: '#ffffff', rimA: 0.9, hatch: '#8e8e9a', hatchA: 0.5,
      knob: '#ececf0', side: '#e2e2e7', sideEdge: '#ffffff' },
  };
  const DARK = { skate: '#121214', skateHi: '#26262b', label: '#0e0e10', text: '#ededf1', textDim: '#a9a9b2', gold: '#cdb57a', goldLo: '#7f6a38', lens: '#30323b', lensLo: '#1a1b20', port: '#09090a' };
  // The sensor's window is smoked glass, the same on every shell.

  // Line widths in CSS pixels. In the page they keep their width at any size; in a texture they are
  // converted to drawing units with the scale the texture will be shown at.
  const W = { contour: 1.8, seam: 1.3, detail: 1 };
  function strokes(opts) {
    if (opts.unitsPerPx) {
      const k = opts.unitsPerPx;
      return n => `stroke-width="${(W[n] * k).toFixed(2)}"`;
    }
    return n => `stroke-width="${W[n]}" vector-effect="non-scaling-stroke"`;
  }
  const outlines = shapes => ['ohalo', 'outline'].map(c => shapes.map(([o, tag, attrs]) => `<${tag} class="${c}" data-o="${o}" ${attrs}/>`).join('')).join('');

  function defs(u, c) {
    const hatch = (id, angle, gap, w, a) => `<pattern id="${u}-${id}" patternUnits="userSpaceOnUse" width="${gap}" height="${gap}" patternTransform="rotate(${angle})"><path d="M0 ${gap / 2}H${gap}" stroke="${c.hatch}" stroke-opacity="${a}" stroke-width="${w}"/></pattern>`;
    return `<defs>
      <clipPath id="${u}-body"><path d="${BODY}"/></clipPath>
      <clipPath id="${u}-left"><path d="${LEFT}"/></clipPath>
      <clipPath id="${u}-right"><path d="${RIGHT}"/></clipPath>
      ${hatch('h1', -38, 10, 2.2, c.hatchA)}
      <linearGradient id="${u}-rimfade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".42" stop-color="#fff" stop-opacity=".55"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="${u}-rim" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#${u}-rimfade)"/></mask>
      <linearGradient id="${u}-sidefade" x1="0" y1="0" x2="1" y2="0"><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#fff"/></linearGradient>
      <mask id="${u}-right-side" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#${u}-sidefade)"/></mask>
      <filter id="${u}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .55 0"/></filter>
      <linearGradient id="${u}-rubber"><stop offset="0" stop-color="#08080a"/><stop offset=".5" stop-color="#23232a"/><stop offset="1" stop-color="#08080a"/></linearGradient>
      <linearGradient id="${u}-turn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-opacity=".8"/><stop offset=".26" stop-opacity="0"/><stop offset=".74" stop-opacity="0"/><stop offset="1" stop-opacity=".8"/></linearGradient>
      <pattern id="${u}-ribs" class="ribs" width="78" height="11" patternUnits="userSpaceOnUse" x="341"><path d="M0 2L78 9" stroke="#43434c" stroke-width="2.6"/></pattern>
      <filter id="${u}-ledblur" x="-100%" y="-300%" width="300%" height="700%"><feGaussianBlur stdDeviation="13"/></filter>
      <filter id="${u}-dotblur" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>`;
  }

  // The drawn tones, clipped to whatever shape they are painted into. A faint grain gives the matte finish.
  function tones(u, c, clip, grain) {
    const cut = (d, fill, a = 1) => `<path d="${d}" fill="${fill}"${a < 1 ? ` fill-opacity="${a}"` : ''}/>`;
    return `<g clip-path="url(#${u}-${clip})" pointer-events="none">${cut(TOP_LIGHT, c.light)}${cut(TOP_SHADE, c.shade)}${cut(TOP_REAR, c.shade, 0.55)}${cut(TOP_DEEP, c.deep, 0.35)}${cut(TOP_DEEP, `url(#${u}-h1)`)}
      ${grain ? `<rect width="760" height="1523" filter="url(#${u}-grain)" opacity=".07"/>` : ''}</g>`;
  }

  /* ---------- Top ---------- */
  function top(shell = 'red', opts = {}) {
    const c = SHELLS[shell], u = opts.u ?? 'xt', sw = strokes(opts), tex = Boolean(opts.unitsPerPx);
    const led = opts.led ?? 'var(--led)';
    // The matte grain is left out of textures: it cannot be seen while the mouse turns and makes each bake
    // about seven times slower.
    const panel = (id, d) => `<g class="part" data-part="${id}"><path d="${d}" fill="${c.base}"/>${tones(u, c, id, !tex)}</g>`;
    return `<svg class="x11" viewBox="0 0 760 1523" ${tex ? `xmlns="http://www.w3.org/2000/svg" width="${opts.w}" height="${opts.h}"` : `role="img" aria-label="${opts.label ?? ''}"`}>
  ${defs(u, c)}
  <g transform="matrix(${NARROW} 0 0 1 ${NX.toFixed(2)} 0)">
  <g clip-path="url(#${u}-body)">
    <path d="${BODY}" fill="${c.base}"/>
    ${tones(u, c, 'body', !tex)}
    ${panel('left', LEFT)}${panel('right', RIGHT)}
    <rect x="325" y="12" width="110" height="434" rx="18" fill="${c.shade}" pointer-events="none"/>
    <rect x="329" y="184" width="102" height="258" rx="20" fill="#000" fill-opacity=".62" pointer-events="none"/>
    <g class="part" data-part="wheel">
      <rect x="331" y="194" width="98" height="246" rx="18" fill="url(#${u}-rubber)"/>
      <rect x="343" y="194" width="74" height="246" fill="url(#${u}-ribs)"/>
      <rect x="331" y="196" width="13" height="242" rx="6" fill="#cfd0d7"/><rect x="331" y="196" width="5" height="242" rx="2.5" fill="#f4f4f7"/>
      <rect x="416" y="196" width="13" height="242" rx="6" fill="#b6b7bf"/>
      <rect x="331" y="194" width="98" height="246" rx="18" fill="url(#${u}-turn)"/>
      <rect x="331" y="194" width="98" height="246" rx="18" fill="none" stroke="${c.ink}" ${sw('detail')}/>
    </g>
  </g>
  <g pointer-events="none" fill="none">
    ${tex ? '' : `<path d="${BODY}" stroke="${c.rim}" stroke-opacity="${c.rimA}" stroke-width="9" clip-path="url(#${u}-body)" mask="url(#${u}-rim)"/>`}
    <path d="${LEFT}" stroke="${c.seam}" ${sw('seam')}/><path d="${RIGHT}" stroke="${c.seam}" ${sw('seam')}/>
    <rect x="325" y="12" width="110" height="434" rx="18" stroke="${c.seam}" ${sw('seam')}/>
    ${tex ? '' : `<path d="${BODY}" stroke="${c.ink}" ${sw('contour')}/>`}
  </g>
  ${[['forward', FORWARD], ['back', BACK]].map(([id, d]) => `<g class="part" data-part="${id}"><path d="${d}" fill="${c.side}"/><path d="${d}" fill="none" stroke="${c.ink}" ${sw('detail')}/><path d="${d}" fill="none" stroke="${c.sideEdge}" stroke-opacity=".5" stroke-width="3" transform="translate(2 0)" clip-path="url(#${u}-body)"/></g>`).join('')}
  ${tex ? '' : '<rect class="hit" data-part="forward" x="-40" y="500" width="80" height="220" fill="transparent"/><rect class="hit" data-part="back" x="-40" y="740" width="80" height="225" fill="transparent"/>'}
  <!-- The LED sits in a dark window, so it reads on any shell, red on red included: a bright core, its colour,
       and a glow that spills onto the shell around it. -->
  <rect class="led-glow" x="340" y="754" width="80" height="37" rx="18" fill="${led}" filter="url(#${u}-ledblur)" pointer-events="none"/>
  <rect x="346" y="757" width="68" height="31" rx="15.5" fill="#0a0a0c" pointer-events="none"/>
  <rect class="led-chip part" data-part="led" x="354" y="764" width="52" height="17" rx="8.5" fill="${led}"/>
  <rect class="led-core" x="364" y="769" width="32" height="6" rx="3" fill="#fff" fill-opacity=".62" pointer-events="none"/>
  ${tex ? '' : '<rect class="hit" data-part="led" x="320" y="740" width="120" height="66" fill="transparent"/>'}
  ${tex ? '' : `<g pointer-events="none">${outlines([['left', 'path', `d="${LEFT}"`], ['right', 'path', `d="${RIGHT}"`], ['wheel', 'rect', 'x="331" y="194" width="98" height="246" rx="18"'],
    ['forward', 'path', `d="${FORWARD}"`], ['back', 'path', `d="${BACK}"`], ['led', 'rect', 'x="346" y="756" width="68" height="33" rx="16"']])}</g>`}
  </g>
</svg>`;
  }

  /* ---------- Underside ---------- */
  function under(shell = 'red', link = 'dongle', opts = {}) {
    const c = SHELLS[shell], d = DARK, u = opts.u ?? 'xu', sw = strokes(opts), tex = Boolean(opts.unitsPerPx);
    const ky = KNOB_Y[link] ?? KNOB_Y.dongle;
    // A round button; the page presses it (class "down" on the group) and rings it when the mouse reports it.
    const round = (id, cy) => `<g class="part" data-part="${id}">
      <circle cx="157" cy="${cy}" r="40" fill="${c.deep}"/><circle cx="157" cy="${cy}" r="34" fill="#000" fill-opacity=".5"/>
      <g class="cap"><circle cx="157" cy="${cy}" r="29" fill="${c.knob}"/><path d="M134 ${cy - 6}A24 24 0 0 1 172 ${cy - 22}" fill="none" stroke="${c.rim}" stroke-opacity="${c.rimA * 0.8}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="157" cy="${cy}" r="29" fill="none" stroke="${c.ink}" ${sw('detail')}/></g>
      ${tex ? '' : `<circle class="ring" cx="157" cy="${cy}" r="44" fill="none"/>`}</g>`;
    // The edge of the base, seen from below: the flanks curve away, so a band of shade runs round the rim,
    // engraved on the side away from the light and lit on the near side.
    const rimBand = `<path d="${BODY}" fill="none" stroke="${c.shade}" stroke-width="54"/>
      <g mask="url(#${u}-right-side)"><path d="${BODY}" fill="none" stroke="${c.deep}" stroke-opacity=".35" stroke-width="30"/><path d="${BODY}" fill="none" stroke="url(#${u}-h1)" stroke-width="30"/></g>
      <path d="${BODY}" fill="none" stroke="${c.light}" stroke-width="26" mask="url(#${u}-rim)"/>
      ${tex ? '' : `<rect width="760" height="1523" filter="url(#${u}-grain)" opacity=".07"/>`}`;
    return `<svg class="x11 x11-under" viewBox="0 0 760 1523" ${tex ? `xmlns="http://www.w3.org/2000/svg" width="${opts.w}" height="${opts.h}"` : `role="img" aria-label="${opts.label ?? ''}"`}>
  ${defs(u, c)}
  <g transform="matrix(${NARROW} 0 0 1 ${NX.toFixed(2)} 0)">
  <g clip-path="url(#${u}-body)">
    <path d="${BODY}" fill="${c.base}"/>
    <g pointer-events="none">${rimBand}</g>
    <path d="${FRONT_SKATE}" fill="${d.skate}"/><path d="${FRONT_SKATE}" fill="none" stroke="${d.skateHi}" stroke-width="3" transform="translate(0 2)" clip-path="url(#${u}-body)"/>
    <!-- The front trim: the button tips, one unbroken band along the edge on each side of the notch, laid over
         the top of the skate. -->
    <g pointer-events="none"><path d="${TRIM_L}" fill="${c.base}"/><path d="${TRIM_L}" fill="${c.light}" fill-opacity=".55"/>
      <path d="${mirror(TRIM_L)}" fill="${c.base}"/><path d="${mirror(TRIM_L)}" fill="${c.shade}" fill-opacity=".35"/>
      <path d="${CREASE_L}" fill="none" stroke="${c.ink}" stroke-opacity=".7" ${sw('detail')}/><path d="${mirror(CREASE_L)}" fill="none" stroke="${c.ink}" stroke-opacity=".7" ${sw('detail')}/></g>
    <path d="${mirror(FORWARD)}" fill="${c.side}" pointer-events="none"/><path d="${mirror(BACK)}" fill="${c.side}" pointer-events="none"/>
    <path d="${REAR_SKATE}" fill="${d.skate}"/><path d="${REAR_SKATE}" fill="none" stroke="${d.skateHi}" stroke-width="3" transform="translate(0 2)"/>
    <path d="${LABEL}" fill="${d.label}"/>
    <path d="${COLUMN}" fill="${d.label}"/>
  </g>
  <!-- Clean: none of the printing on the label (model, names of the switches, their icons) is drawn. -->
  <g class="mleds" pointer-events="none">
    ${[119, 157, 195].map(x => `<circle class="mled-glow" cx="${x}" cy="549" r="13" fill="transparent" filter="url(#${u}-dotblur)"/><circle class="mled" cx="${x}" cy="549" r="6.5" fill="#2c2c31"/>`).join('')}
  </g>
  ${round('pair', 607)}
  ${round('dpi', 728)}
  <!-- The power switch, mirrored across the centre from the round buttons. Its knob is one group, so the page can
       slide it to a new stop when the connection changes. -->
  <g class="part" data-part="power">
    <rect x="566" y="598" width="74" height="136" rx="37" fill="${c.base}"/>
    <rect x="574" y="606" width="58" height="120" rx="29" fill="#000" fill-opacity=".72"/>
    <g class="knob" style="transform: translateY(${ky - KNOB_Y.dongle}px)">
      <rect x="579" y="${KNOB_Y.dongle}" width="48" height="44" rx="16" fill="${c.knob}"/>
      <rect x="591" y="${KNOB_Y.dongle + 19}" width="24" height="6" rx="3" fill="#000" fill-opacity=".4"/>
    </g>
    <rect x="566" y="598" width="74" height="136" rx="37" fill="none" stroke="${c.ink}" ${sw('detail')}/>
  </g>
  <!-- The sensor: a window in the label, a black frame, a ring in the shell's own colour, and inside it clear
       plastic over the works: the round lens at the front, the ridged light pipe behind it. -->
  <g class="part" data-part="sensor">
    <rect x="288" y="618" width="184" height="275" rx="44" fill="${c.base}"/>
    <rect x="300" y="634" width="160" height="242" rx="26" fill="#0b0b0d"/>
    <rect x="300" y="634" width="160" height="242" rx="26" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="3"/>
    <rect x="321" y="664" width="118" height="184" rx="59" fill="${c.knob}"/>
    <rect x="321" y="664" width="118" height="184" rx="59" fill="none" stroke="${c.ink}" ${sw('detail')}/>
    <rect x="331" y="674" width="98" height="164" rx="49" fill="#121317"/>
    <circle cx="380" cy="714" r="25" fill="#1d1e24"/><circle cx="380" cy="714" r="25" fill="none" stroke="#4a4c56" stroke-width="3"/>
    <circle cx="380" cy="714" r="13" fill="#08080a"/><circle cx="380" cy="714" r="13" fill="none" stroke="#5c5e69" stroke-width="2"/>
    <circle cx="375" cy="709" r="3.5" fill="#cfd1da" fill-opacity=".8"/>
    <rect x="352" y="752" width="56" height="54" rx="6" fill="#26272e"/>
    ${[760, 770, 780, 790].map(y => `<rect x="357" y="${y}" width="46" height="5" rx="2.5" fill="#08080a"/>`).join('')}
    <rect x="352" y="752" width="56" height="54" rx="6" fill="none" stroke="#4a4c56" stroke-width="2"/>
    <path d="M343 742C341 712 352 688 372 680" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="5" stroke-linecap="round"/>
    <path d="M418 790C420 808 412 822 398 828" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="4" stroke-linecap="round"/>
    <rect x="288" y="618" width="184" height="275" rx="44" fill="none" stroke="${c.seam}" ${sw('seam')}/>
  </g>
  <g class="part" data-part="contacts">
    ${[336, 424].map(x => `<circle cx="${x}" cy="1051" r="42" fill="${c.base}"/><circle cx="${x}" cy="1051" r="42" fill="none" stroke="${c.seam}" ${sw('detail')}/><circle cx="${x}" cy="1051" r="29" fill="${d.goldLo}"/><circle cx="${x}" cy="1049" r="26" fill="${d.gold}"/><path d="M${x - 15} 1040A18 18 0 0 1 ${x + 2} 1031" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="4" stroke-linecap="round"/>`).join('')}
  </g>
  <g class="part" data-part="bay">
    <rect x="255" y="1189" width="250" height="133" rx="12" fill="${c.base}"/>
    <rect x="305" y="1203" width="150" height="10" rx="5" fill="#000" fill-opacity=".5"/>
    <rect x="255" y="1189" width="250" height="133" rx="12" fill="none" stroke="${c.seam}" ${sw('seam')}/>
  </g>
  <!-- The port block between the button tips. The USB-C opening is in its front face, which can't be seen from
       below: only the underside of the raised collar round the opening shows, as a rounded ridge at the front
       edge. The turning mouse shows the opening itself, in its front wall. -->
  <g class="part" data-part="usbc">
    <path d="${LIP}" fill="${c.base}"/><path d="${LIP}" fill="${c.light}" fill-opacity=".4"/>
    <path d="${LIP}" fill="none" stroke="${c.ink}" stroke-opacity=".7" ${sw('detail')}/>
    <rect x="334" y="14" width="92" height="26" rx="13" fill="${c.light}" fill-opacity=".7"/>
    <path d="M338 34Q340 40 347 40L413 40Q420 40 422 34" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="5" stroke-linecap="round"/>
    <rect x="334" y="14" width="92" height="26" rx="13" fill="none" stroke="${c.ink}" stroke-opacity=".75" ${sw('detail')}/>
    ${tex ? '' : '<rect x="318" y="0" width="124" height="158" fill="transparent"/>'}
  </g>
  <g pointer-events="none" fill="none">
    <path d="${mirror(FORWARD)}" stroke="${c.ink}" ${sw('detail')}/><path d="${mirror(BACK)}" stroke="${c.ink}" ${sw('detail')}/>
    ${tex ? '' : `<path d="${BODY}" stroke="${c.ink}" ${sw('contour')}/>`}
  </g>
  ${tex ? '' : '<rect class="hit" data-part="pair" x="100" y="500" width="114" height="146" fill="transparent"/>'}
  ${tex ? '' : `<g pointer-events="none">${outlines([['usbc', 'path', `d="${LIP}"`], ['pair', 'circle', 'cx="157" cy="607" r="44"'], ['dpi', 'circle', 'cx="157" cy="728" r="44"'],
    ['sensor', 'rect', 'x="284" y="614" width="192" height="283" rx="48"'], ['power', 'rect', 'x="562" y="594" width="82" height="144" rx="41"'],
    ['contacts', 'rect', 'x="288" y="1003" width="184" height="96" rx="48"'], ['bay', 'rect', 'x="251" y="1185" width="258" height="141" rx="15"']])}</g>`}
  </g>
</svg>`;
  }

  /* ---------- Flanks, for the 3D turn ----------
     Seen from the side, length across (the front at the left) and height up, 470 units at the hump. The left
     flank fills the top half and the right flank the bottom half. hc(y) is the turning mouse's centre height at
     y, so each feature is drawn where the flank actually is: the side buttons, the seam of the main buttons and
     the strip of the bottom case. Only ever seen as a texture. */
  function side(shell = 'red', opts = {}) {
    const c = SHELLS[shell], hc = opts.hc, Z = 470, S = 3.2;
    const yAt = (half, y, f) => half * Z + Z - f * hc(y);
    const seam = half => {
      const pts = [];
      for (let y = 60; y <= 728; y += 24) pts.push(`${y} ${yAt(half, y, 0.62).toFixed(1)}`);
      return `M${pts.join('L')}L728 ${half * Z}`;
    };
    // A side button: a pill along the flank, its front end slanted like the real one, lit along its upper edge.
    // Both sit at one height above the desk, h0 to h1, so they line up one behind the other as on the mouse.
    const button = (half, y0, y1, h0, h1) => {
      const top = half * Z + Z - h1, bot = half * Z + Z - h0, r = (bot - top) / 2;
      const d = `M${y0 + r + 26} ${top}L${y1 - r} ${top}A${r} ${r} 0 0 1 ${y1 - r} ${bot}L${y0 + r} ${bot}A${r} ${r} 0 0 1 ${y0 + r + 26} ${top}Z`;
      return `<path d="${d}" fill="${c.side}"/><path d="${d}" fill="none" stroke="${c.ink}" stroke-width="${S}"/>
        <path d="M${y0 + r + 30} ${top + 3}L${y1 - r} ${top + 4}" fill="none" stroke="${c.sideEdge}" stroke-opacity=".55" stroke-width="4" stroke-linecap="round"/>
        <path d="M${y0 + r + 6} ${bot - 3}L${y1 - r} ${bot - 3}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="5" stroke-linecap="round"/>`;
    };
    const flank = (half, buttons) => `
      <rect x="0" y="${half * Z}" width="1523" height="${Z}" fill="${c.base}"/>
      <rect x="0" y="${half * Z + Z - 30}" width="1523" height="30" fill="${c.shade}"/>
      <path d="M0 ${half * Z + Z - 30}H1523" stroke="${c.seam}" stroke-width="${S}"/>
      <path d="${seam(half)}" fill="none" stroke="${c.seam}" stroke-width="${S}" stroke-linejoin="round"/>
      ${buttons ? button(half, 500, 728, 186, 236) + button(half, 746, 974, 186, 236) : ''}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1523 ${2 * Z}" width="${opts.w}" height="${opts.h}" preserveAspectRatio="none">
      ${flank(0, true)}${flank(1, false)}</svg>`;
  }

  // Where each part sits, for callouts and for the camera.
  const ANCHORS = {
    // Chosen so that no two on one side sit closer than a callout is tall: every leader can run straight across.
    left: [205, 330], right: [560, 540], wheel: [429, 317], forward: [20, 611], back: [18, 852], led: [404, 772],
    usbc: [380, 30], pair: [133, 585], dpi: [133, 750], power: [603, 666], sensor: [436, 846], contacts: [452, 1051], bay: [290, 1256],
  };
  for (const k of Object.keys(ANCHORS)) ANCHORS[k][0] = +narrowX(ANCHORS[k][0]).toFixed(1);
  return { BODY, BODY_DRAWN, NARROW, LEFT, RIGHT, SHELLS, ANCHORS, top, under, side };
})();
