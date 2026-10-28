<script>
  // The X11 seen from above, in the user's colour, with its LED painted the colour the real one shows, and optional
  // button markers.
  import black from '../../assets/mouse/x11-black.webp';
  import red from '../../assets/mouse/x11-red.webp';
  import white from '../../assets/mouse/x11-white.webp';
  import { t } from '../i18n/index.svelte.js';
  import { look } from './look.svelte.js';

  // Each render's shape, its LED and where each button sits (percent of the image). The black and red shots come
  // from the same product photo set, so they share one layout; the white one is a different shot.
  // Wheel scroll shares the wheel; DPI is underneath.
  const SHOT = {
    ratio: '760 / 1523',
    led: { x: 49.93, y: 50.82, w: 6.32, h: 0.85 },
    spots: { left: [27, 20.4], right: [73, 20.4], wheel: [50, 20.4], forward: [3.4, 38.8], back: [3.6, 55.8] },
  };
  const RENDERS = {
    white: {
      src: white, ratio: '1167 / 2246',
      led: { x: 50.3, y: 48.65, w: 5.4, h: 0.95 },
      spots: { left: [27.9, 21], right: [72.2, 21], wheel: [49.6, 21], forward: [6.9, 39.5], back: [7.2, 54.8] },
    },
    black: { src: black, ...SHOT },
    red: { src: red, ...SHOT },
  };

  let { led = '#2a2a2e', markers = false, picked = null, alt = null } = $props();
  const spot = $derived(picked?.startsWith('wheel') ? 'wheel' : picked);
  const r = $derived(RENDERS[look.shell] ?? RENDERS.white);
</script>

<!-- Its height comes from the screen's stylesheet (.device .shot, .button-map .shot). -->
<div class="shot" style:--led={led} style:aspect-ratio={r.ratio}
  style:--led-x="{r.led.x}%" style:--led-y="{r.led.y}%" style:--led-w="{r.led.w}%" style:--led-h="{r.led.h}%">
  <img src={r.src} alt={alt ?? t('render.alt')}>
  <span class="led" aria-hidden="true"></span>
  {#if markers}
    {#each Object.entries(r.spots) as [id, [x, y]] (id)}
      <span class="marker" class:on={spot === id} style:--x="{x}%" style:--y="{y}%" aria-hidden="true"></span>
    {/each}
  {/if}
</div>
