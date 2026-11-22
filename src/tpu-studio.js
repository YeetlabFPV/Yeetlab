import { heroPresets, studioParts } from './shreddo-colours.js';

import { nextRandomPreset } from './studio-random.js';

const viewport = document.querySelector('.studio-viewport');
const reset = document.querySelector('#reset-view');
const status = document.querySelector('#viewer-status');
const presetName = document.querySelector('#preset-name');
const fields = new Map();
const storageKey = 'yeetlab.tpuStudio.savedColours.v1';
let viewer;

function loadSavedColours() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(stored)) {
      return [...new Set(stored.filter(c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))
        .map(c => c.toLowerCase()))];
    }
  } catch {
    // A browser with local storage disabled can still use the palette in this tab.
  }
  return [];
}
const savedColours = loadSavedColours();

const collection = document.querySelector('#hero-presets');
const collectionStatus = document.querySelector('#collection-status');
const emptyCollection = document.querySelector('#collection-empty');
const addDesign = document.querySelector('#add-to-collection');
const previewAdd = document.querySelector('#preview-add');
let activeCard;

function selectCard(radio) {
  if (activeCard) activeCard.checked = false;
  activeCard = radio;
  if (radio) radio.checked = true;
}

function createCard(name, thumbnail, onSelect) {
  const card = document.createElement('div');
  card.className = 'collection-item';
  const label = document.createElement('label');
  label.className = 'preset-card';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'colour-preset';
  radio.value = name;
  const image = new Image(320, 176);
  image.src = thumbnail;
  image.alt = '';
  image.loading = 'lazy';
  const caption = document.createElement('span');
  caption.textContent = name;
  label.append(radio, image, caption);
  radio.addEventListener('change', () => {
    collectionStatus.textContent = '';
    onSelect(radio);
  });

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-card';
  remove.textContent = '×';
  remove.title = 'Remove ' + name + ' from collection';
  remove.setAttribute('aria-label', remove.title);
  remove.addEventListener('click', () => {
    const neighbour = card.nextElementSibling || card.previousElementSibling;
    if (radio === activeCard) selectCard(null);
    card.remove();
    emptyCollection.hidden = Boolean(collection.childElementCount);
    collectionStatus.textContent = name + ' removed until refresh.';
    (neighbour?.querySelector('input') || addDesign).focus();
  });
  card.append(label, remove);
  return card;
}

for (const preset of heroPresets) {
  const name = preset[0];
  const thumbnail = 'assets/tpu-presets/' + name.toLowerCase().replace(' & ', '-').replaceAll(' ', '-') + '.webp';
  const card = createCard(name, thumbnail, radio => {
    selectCard(radio);
    applyPreset(preset);
  });
  collection.append(card);
  if (preset === heroPresets[0]) selectCard(card.querySelector('input'));
}

function displayColour(id, colour) {
  const field = fields.get(id);
  field.input.value = colour;
  field.value.textContent = colour.toUpperCase();
  field.chip.style.backgroundColor = colour;
  const saved = savedColours.includes(colour);
  field.save.disabled = saved;
  field.save.textContent = saved ? 'Colour saved' : 'Save colour';
}

function setPartColour(id, colour) {
  displayColour(id, colour);
  selectCard(null);
  presetName.textContent = 'Custom colours';
  viewer.setColours({[id]: colour});
}

function refreshPalette() {
  for (const [id, field] of fields) {
    const swatches = savedColours.map(colour => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'saved-swatch';
      button.style.backgroundColor = colour;
      button.title = 'Apply ' + colour.toUpperCase() + ' to ' + field.name;
      button.setAttribute('aria-label', button.title);
      button.addEventListener('click', () => setPartColour(id, colour));
      return button;
    });
    field.list.replaceChildren(...swatches);
    field.savedSection.hidden = !swatches.length;
    displayColour(id, field.input.value);
  }
}

for (const part of studioParts) {
  const details = document.createElement('details');
  details.className = 'part-editor';
  details.name = 'studio-part';
  const summary = document.createElement('summary');
  summary.className = 'part-row';
  const name = document.createElement('span');
  name.textContent = part.name;
  const value = document.createElement('span');
  value.className = 'hex';
  const chip = document.createElement('i');
  chip.className = 'part-chip';
  summary.append(name, value, chip);

  const body = document.createElement('div');
  body.className = 'colour-tools';
  const picker = document.createElement('label');
  picker.textContent = 'Pick colour';
  const input = document.createElement('input');
  input.type = 'color';
  input.id = part.id;
  input.setAttribute('aria-label', part.name + ' colour');
  picker.append(input);
  const save = document.createElement('button');
  save.type = 'button';
  const savedSection = document.createElement('div');
  savedSection.className = 'saved-section';
  savedSection.textContent = 'Saved colours';
  const list = document.createElement('div');
  list.className = 'saved-swatches';
  savedSection.append(list);
  body.append(picker, save, savedSection);
  details.append(summary, body);
  document.querySelector('#part-colours').append(details);
  fields.set(part.id, {name: part.name, title: name, input, chip, value, save, list, savedSection});
  input.addEventListener('input', () => setPartColour(part.id, input.value));
  save.addEventListener('click', () => {
    if (!savedColours.includes(input.value)) savedColours.push(input.value);
    try { localStorage.setItem(storageKey, JSON.stringify(savedColours)); } catch { /* In-memory palette remains available. */ }
    refreshPalette();
  });
}

function applyPreset([name, first, second]) {
  const colours = {};
  for (const part of studioParts) {
    colours[part.id] = part.zone === 0 ? first : second;
    displayColour(part.id, colours[part.id]);
  }
  presetName.textContent = name;
  viewer?.setColours(colours);
}

const hardwareStatus = document.querySelector('#hardware-status');
const editor = document.querySelector('#editor');
const hardwareGroups = [...document.querySelectorAll('fieldset[data-slot]')];
let hardware = {horn: false, shoes: false};
let designCount = 0;
let contextLost = false;

function showHardware() {
  for (const group of hardwareGroups) {
    const slot = group.dataset.slot;
    const option = group.querySelector(hardware[slot] ? '[value="alternative"]' : '[value="stock"]');
    option.checked = true;
    const field = fields.get(slot);
    field.name = option.parentElement.textContent.trim();
    field.title.textContent = field.name;
    field.input.setAttribute('aria-label', field.name + ' colour');
  }
  refreshPalette();
}

async function switchBuild(next, design, radio) {
  if (editor.disabled) return;
  editor.disabled = previewAdd.disabled = true;
  hardwareStatus.textContent = '';
  try {
    await viewer.setHardware(next);
    hardware = {...next};
    showHardware();
    if (design) {
      for (const [id, colour] of Object.entries(design.colours)) displayColour(id, colour);
      viewer.setColours(design.colours);
      selectCard(radio);
      presetName.textContent = radio.value;
      viewer.restoreView(design.view);
    } else if (activeCard?.hasAttribute('data-saved-build')) {
      selectCard(null);
      presetName.textContent = 'Custom design';
    }
  } catch (error) {
    if (radio) radio.checked = false;
    if (activeCard) activeCard.checked = true;
    showHardware();
    hardwareStatus.textContent = 'Could not load this build. Try again.';
    console.warn('Build unavailable', error);
  } finally {
    editor.disabled = previewAdd.disabled = contextLost;
  }
}

for (const group of hardwareGroups) {
  group.addEventListener('change', event => {
    switchBuild({...hardware, [group.dataset.slot]: event.target.value === 'alternative'});
  });
}

function addCurrentDesign() {
  const design = {
    hardware: {...hardware},
    colours: Object.fromEntries([...fields].map(([id, field]) => [id, field.input.value])),
    view: viewer.captureView(),
  };
  const name = 'Design ' + ++designCount;
  const card = createCard(name, design.view.image, radio => switchBuild(design.hardware, design, radio));
  collection.prepend(card);
  const radio = card.querySelector('input');
  radio.setAttribute('data-saved-build', '');
  selectCard(radio);
  presetName.textContent = name;
  emptyCollection.hidden = true;
  collectionStatus.textContent = name + ' added until refresh.';
}

addDesign.addEventListener('click', addCurrentDesign);
previewAdd.addEventListener('click', addCurrentDesign);

document.querySelector('#random-preset').addEventListener('click', () => {
  collectionStatus.textContent = '';
  const {preset, position, total} = nextRandomPreset();
  selectCard(null);
  applyPreset(preset);
  presetName.textContent = preset[0] + ' · ' + position + '/' + total;
});

applyPreset(heroPresets[0]);
refreshPalette();
reset.addEventListener('click', () => viewer.resetView());

const header = document.querySelector('.site-header');
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--header-height', header.getBoundingClientRect().height + 'px');
}).observe(header);

function unavailable() {
  contextLost = true;
  editor.disabled = previewAdd.disabled = reset.disabled = true;
  viewport.querySelector('canvas')?.remove();
  status.textContent = '3D preview unavailable. Reload with WebGL enabled to customise the frame.';
}

try {
  const { createStudioViewer } = await import('../assets/shreddo-hero/viewer.js?v=csp');
  viewer = await createStudioViewer(viewport);
  viewport.querySelector('canvas').addEventListener('webglcontextlost', unavailable);
  applyPreset(heroPresets[0]);
  showHardware();
  editor.disabled = previewAdd.disabled = reset.disabled = false;
  status.textContent = 'Drag to rotate · Scroll or pinch to zoom';
} catch (error) {
  console.warn('TPU Studio unavailable', error);
  unavailable();
}
