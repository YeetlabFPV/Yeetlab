// First colour is used on the canopy, horn and rear braces.
export const heroPresets = [
  ['Violet & graphite', '#8528c9', '#41434b'],
  ['Hot pink & turquoise', '#ed1687', '#03b8b3'],
  ['Natural white & racing red', '#eae9e3', '#d3283d'],
  ['Turquoise & graphite', '#09a7ad', '#393d45'],
  ['Cobalt & signal yellow', '#1955bb', '#f0d414'],
  ['Cherry red & midnight blue', '#cf193b', '#192e51'],
];

export const studioParts = [
  { id: 'horn', name: 'LiPo Saver Horns', groups: ['horn'], zone: 0 },
  { id: 'plates', name: 'Cam Plates', groups: ['cameraSide'], zone: 1 },
  { id: 'canopy', name: 'Canopy', groups: ['cage', 'softLock'], zone: 0 },
  { id: 'shoes', name: 'Bando Shoes', groups: ['guard'], zone: 1 },
  { id: 'protectors', name: 'Arm Protectors', groups: ['armProtector'], zone: 1 },
  { id: 'holder', name: 'Buzzer & Cap Holder', groups: ['bumper'], zone: 1 },
  { id: 'vtx', name: 'VTX Side Plates', groups: ['rearSide'], zone: 1 },
  { id: 'rear', name: 'Rear Braces', groups: ['rearTop', 'rearBottom'], zone: 0 },
];

export const studioAccessories = [
  { id: 'motors', name: 'Motor colour', colour: '#04bcb7' },
  { id: 'props', name: 'Propeller colour', colour: '#8642e8' },
];
