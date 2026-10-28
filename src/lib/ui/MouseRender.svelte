<script>
  // The X11 from above, drawn as vectors (our own illustration, not a product photo). Every part is its own shape,
  // so it can light up, press or spin with what the real mouse does. One drawing serves every shell colour: the
  // colours are CSS variables. Light falls from the upper left; the gradients are in user space so the shading runs
  // continuously across the shell and the buttons.
  import { t } from '../i18n/index.svelte.js';
  import { look } from './look.svelte.js';

  // Frame 760 x 1523. The halves are mirror images around x = 380 (see the shape notes in the paths).
  const BODY = 'M380 64L402 64C426 64 435 66 435 76L436 10C436 3 441 0 448 2C540 38 650 80 719 110C736 117 750 140 751 200C752 330 737 470 737 640C737 820 759 960 759 1100C759 1250 705 1350 605 1435C535 1493 460 1523 380 1523C300 1523 225 1493 155 1435C55 1350 1 1250 1 1100C1 960 23 820 23 640C23 470 8 330 9 200C10 140 24 117 41 110C110 80 220 38 312 2C319 0 324 3 324 10L325 76C325 66 334 64 358 64L380 64Z';
  const RIGHT = 'M383 446L383 728L676 728C704 728 719 712 720 684L722 134C722 124 717 114 707 108C640 77 545 37 448 2C441 0 436 3 436 10L437 418C437 434 428 446 412 446Z';
  const LEFT = 'M377 446L377 728L84 728C56 728 41 712 40 684L38 134C38 124 43 114 53 108C120 77 215 37 312 2C319 0 324 3 324 10L323 418C323 434 332 446 348 446Z';
  // The two side buttons sit on the left flank; from above only their outer edge shows.
  const FORWARD = 'M13 516C9 560 9 664 13 706C18 711 26 712 30 708C33 660 33 562 30 514C26 509 17 510 13 516Z';
  const BACK = 'M9 752C4 800 4 908 10 952C15 958 24 959 29 954C33 904 33 802 29 750C25 744 14 745 9 752Z';

  // Where each control sits (percent of the frame), for the markers and anything else that points at a part.
  const SPOTS = { left: [27, 21.7], right: [73, 21.7], wheel: [50.1, 20.8], forward: [2.7, 40.2], back: [2.6, 56.1] };

  const OFF = '#2a2a2e';
  let { led = OFF, markers = false, picked = null, pressed = [], alt = null } = $props();
  const uid = $props.id();
  const spot = $derived(picked?.startsWith('wheel') ? 'wheel' : picked);
  const lit = $derived(led.toLowerCase() !== OFF);
  const down = id => pressed.includes(id);
  const url = name => `url(#${uid}-${name})`;
</script>

<!-- Its height comes from the screen's stylesheet (.device .shot, .button-map .shot). -->
<div class="shot x11" data-shell={look.shell} style:--led={led}>
  <svg viewBox="0 0 760 1523" role="img" aria-label={alt ?? t('render.alt')}>
    <defs>
      <radialGradient id="{uid}-shell" gradientUnits="userSpaceOnUse" cx="300" cy="420" fx="250" fy="330" r="1150">
        <stop offset="0" style:stop-color="var(--shell-hi)" />
        <stop offset=".42" style:stop-color="var(--shell)" />
        <stop offset="1" style:stop-color="var(--shell-lo)" />
      </radialGradient>
      <!-- Roundness: the shell falls away from the light towards its rim. -->
      <radialGradient id="{uid}-rim" gradientUnits="userSpaceOnUse" cx="380" cy="700" r="820">
        <stop offset=".62" stop-color="#000" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity=".42" />
      </radialGradient>
      <linearGradient id="{uid}-recess" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".55" />
        <stop offset=".5" stop-color="#000" stop-opacity=".3" />
        <stop offset="1" stop-color="#000" stop-opacity=".45" />
      </linearGradient>
      <linearGradient id="{uid}-rubber" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#0d0d0f" />
        <stop offset=".5" stop-color="#2b2b30" />
        <stop offset="1" stop-color="#0d0d0f" />
      </linearGradient>
      <!-- The wheel is a cylinder seen from above: dark where it turns away, top and bottom. -->
      <linearGradient id="{uid}-turn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".75" />
        <stop offset=".28" stop-color="#000" stop-opacity="0" />
        <stop offset=".72" stop-color="#000" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity=".75" />
      </linearGradient>
      <linearGradient id="{uid}-metal" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#7d7d86" />
        <stop offset=".5" stop-color="#ededf1" />
        <stop offset="1" stop-color="#8a8a93" />
      </linearGradient>
      <pattern id="{uid}-ribs" class="ribs" width="80" height="10" patternUnits="userSpaceOnUse" x="340">
        <path d="M0 3L80 7" stroke="#4a4a52" stroke-width="2.2" />
      </pattern>
      <linearGradient id="{uid}-flank" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" style:stop-color="var(--flank-lo)" />
        <stop offset=".7" style:stop-color="var(--flank)" />
        <stop offset="1" style:stop-color="var(--flank-hi)" />
      </linearGradient>
      <linearGradient id="{uid}-edge" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="760" y2="1523">
        <stop offset="0" style:stop-color="var(--edge)" stop-opacity=".9" />
        <stop offset=".55" style:stop-color="var(--edge)" stop-opacity=".15" />
        <stop offset="1" style:stop-color="var(--edge)" stop-opacity="0" />
      </linearGradient>
      <filter id="{uid}-blur-led" x="-80%" y="-400%" width="260%" height="900%"><feGaussianBlur stdDeviation="9" /></filter>
      <filter id="{uid}-blur-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="38" /></filter>
      <clipPath id="{uid}-clip"><path d={BODY} /></clipPath>
    </defs>

    <g clip-path={url('clip')}>
      <path d={BODY} fill={url('shell')} />
      <!-- Soft sheen on the palm and on the left button, where the light lands. -->
      <ellipse cx="250" cy="1000" rx="120" ry="260" class="sheen" filter={url('blur-soft')} />

      <path class="part" class:down={down('left')} d={LEFT} fill={url('shell')} />
      <path class="part" class:down={down('right')} d={RIGHT} fill={url('shell')} />
      <ellipse cx="190" cy="330" rx="80" ry="190" class="sheen" filter={url('blur-soft')} />

      <!-- Wheel housing, the wheel and its metal rims. -->
      <rect x="325" y="64" width="110" height="382" rx="22" fill={url('recess')} />
      <g class="part wheel" class:down={down('wheel')}>
        <rect x="331" y="194" width="98" height="246" rx="18" fill={url('rubber')} />
        <rect x="341" y="194" width="78" height="246" fill={url('ribs')} />
        <rect x="331" y="194" width="11" height="246" rx="5" fill={url('metal')} />
        <rect x="418" y="194" width="11" height="246" rx="5" fill={url('metal')} />
        <rect x="331" y="194" width="98" height="246" rx="18" fill={url('turn')} />
      </g>

      <path d={BODY} fill={url('rim')} pointer-events="none" />
    </g>

    <!-- Rim light: the edge facing the light catches it, which also lifts a dark shell off a dark page. -->
    <path d={BODY} fill="none" stroke={url('edge')} stroke-width="3" />

    <!-- Side buttons stand out from the left flank, so from above they show over its edge. -->
    <path class="part" class:down={down('forward')} d={FORWARD} fill={url('flank')} />
    <path class="part" class:down={down('back')} d={BACK} fill={url('flank')} />

    <!-- Seams: a dark cut with a faint lit lip below it. -->
    <g class="seams" fill="none" stroke-linejoin="round">
      <path d={LEFT} class="lip" transform="translate(0 1.6)" />
      <path d={RIGHT} class="lip" transform="translate(0 1.6)" />
      <path d={LEFT} class="cut" />
      <path d={RIGHT} class="cut" />
    </g>

    <!-- The LED, with its glow only while it is lit. -->
    {#if lit}<rect class="led-glow" x="350" y="760" width="60" height="25" rx="12" filter={url('blur-led')} />{/if}
    <rect class="led-chip" class:lit x="356" y="766" width="48" height="13" rx="6.5" />
  </svg>
  {#if markers}
    {#each Object.entries(SPOTS) as [id, [x, y]] (id)}
      <span class="marker" class:on={spot === id} style:--x="{x}%" style:--y="{y}%" aria-hidden="true"></span>
    {/each}
  {/if}
</div>

<style>
  .x11 { aspect-ratio: 760 / 1523; }
  .x11[data-shell='white'] {
    --shell: #e6e6ea; --shell-hi: #ffffff; --shell-lo: #a6a6b0; --edge: #ffffff;
    --flank: #d4d4da; --flank-lo: #8e8e98; --flank-hi: #f6f6f8;
    --cut: rgba(20, 20, 26, .5); --lip: rgba(255, 255, 255, .7); --sheen: #ffffff; --sheen-a: .4;
  }
  .x11[data-shell='black'] {
    --shell: #26272c; --shell-hi: #4a4b53; --shell-lo: #0c0c0f; --edge: #9a9ca8;
    --flank: #2c2c31; --flank-lo: #0b0b0d; --flank-hi: #57575f;
    --cut: rgba(0, 0, 0, .85); --lip: rgba(255, 255, 255, .09); --sheen: #8d8f9b; --sheen-a: .12;
  }
  .x11[data-shell='red'] {
    --shell: #d3221f; --shell-hi: #f8584f; --shell-lo: #8c110f; --edge: #ff9a90;
    --flank: #2c2c31; --flank-lo: #0b0b0d; --flank-hi: #57575f;
    --cut: rgba(40, 0, 0, .75); --lip: rgba(255, 210, 205, .22); --sheen: #ff8f85; --sheen-a: .2;
  }
  svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .sheen { fill: var(--sheen); opacity: var(--sheen-a); }
  .cut { stroke: var(--cut); stroke-width: 3; }
  .lip { stroke: var(--lip); stroke-width: 1.4; }
  .led-chip { fill: #2a2a2e; transition: fill .4s ease; }
  .led-chip.lit { fill: var(--led); }
  .led-glow { fill: var(--led); opacity: .9; transition: fill .4s ease; }
  /* A pressed part sinks a little and darkens, like the real one. */
  .part { transform-box: fill-box; transform-origin: center; transition: transform .12s ease-out, filter .12s ease-out; }
  .part.down { transform: translateY(3px) scale(.995); filter: brightness(.86); }
  @media (prefers-reduced-motion: reduce) {
    .part, .led-chip, .led-glow { transition: none; }
  }
</style>
