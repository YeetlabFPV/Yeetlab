const section = document.querySelector('.shreddo-hero');
const stage = section.querySelector('.shreddo-stage');
const media = section.querySelector('.shreddo-media');
const header = document.querySelector('.site-header');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let pending;
let dispose;

async function enableModel() {
  pending?.abort();
  const request = new AbortController();
  pending = request;
  dispose?.();
  dispose = undefined;
  if (motion.matches) return;

  try {
    const { mountShreddo } = await import('../assets/shreddo-hero/viewer.js?v=csp');
    if (request.signal.aborted) return;
    const release = await mountShreddo({ section, stage, media, header, signal: request.signal });
    if (!request.signal.aborted) dispose = release;
  } catch (error) {
    console.warn('Shreddo 3D preview unavailable', error);
  }
}

new ResizeObserver(() => {
  section.style.setProperty('--shreddo-header', `${header.getBoundingClientRect().height}px`);
}).observe(header);
section.style.setProperty('--shreddo-header', `${header.getBoundingClientRect().height}px`);
motion.addEventListener('change', enableModel);
enableModel();
