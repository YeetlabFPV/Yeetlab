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
    const { mountShreddo } = await import('../assets/shreddo-hero/viewer.js?v=cosmos-v30-orientation');
    if (request.signal.aborted) return;
    const release = await mountShreddo({ section, stage, media, header, signal: request.signal });
    if (!request.signal.aborted) dispose = release;
  } catch (error) {
    console.warn('Shreddo 3D preview unavailable', error);
  }
}

let lastScroll = Math.max(0, window.scrollY);
function setNavigationHidden(hidden) {
  header.classList.toggle('site-header-hidden', hidden);
  section.toggleAttribute('data-navigation-hidden', hidden);
}

window.addEventListener('scroll', () => {
  const current = Math.max(0, window.scrollY);
  const delta = current - lastScroll;
  if (current > 0 && Math.abs(delta) < 8) return;
  lastScroll = current;
  setNavigationHidden(delta > 0 && current > header.offsetHeight && !header.contains(document.activeElement));
}, { passive: true });
header.addEventListener('focusin', () => setNavigationHidden(false));

function syncHeaderHeight() {
  const height = `${header.getBoundingClientRect().height}px`;
  section.style.setProperty('--shreddo-header', height);
  document.documentElement.style.setProperty('--shop-header-height', height);
}
new ResizeObserver(syncHeaderHeight).observe(header);
syncHeaderHeight();
motion.addEventListener('change', enableModel);
enableModel();

if (!motion.matches && 'IntersectionObserver' in window) {
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveal.unobserve(entry.target);
      if (!motion.matches) entry.target.classList.add('home-reveal');
    }
  }, { rootMargin: '0px 0px -24px 0px' });
  document.querySelectorAll('main > section:not(.shreddo-hero)').forEach(element => {
    if (element.getBoundingClientRect().top >= innerHeight) reveal.observe(element);
  });
}
