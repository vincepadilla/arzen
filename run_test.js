import { checkCompression } from './js/steel/calculations/compression.js';
import { checkFlexure } from './js/steel/calculations/flexure.js';
import { checkSeismic } from './js/steel/calculations/seismic.js';
import { checkInteraction } from './js/steel/calculations/interaction.js';
import { checkTension } from './js/steel/calculations/tension.js';

const state = {
  memberType: 'beam-column',
  designMethod: 'asd',
  designCode: 'nscp2015-aisc360-10',
  lengthUnit: 'm',
  memberLength: 3.0,
  unbracedLengthX: 3.0,
  unbracedLengthY: 3.0,
  unbracedLengthZ: 3.0,
  unbracedLengthTop: 1.0,
  unbracedLengthBot: 1.0,
  Kx: 1.0,
  Ky: 1.0,
  Kz: 1.0,
  Cb: 1.0,
  loadPc: 300,
  loadPt: 0,
  loadMux: 50,
  loadMuy: 10,
  loadVux: 0,
  loadVuy: 0,
  loadTu: 0,
  material: {
    fy: 248,
    fu: 500,
    E: 200000,
    G: 77200
  },
  section: {
    type: 'W',
    area: 8000,
    d: 300,
    bf: 200,
    tf: 12,
    tw: 8,
    h: 276,
    Ix: 200000000 / 1000000, // input is mm4, db expects 10^6 mm4 for Ix
    Iy: 40000000 / 1000000,  // db expects 10^6 mm4
    rx: 158.1139,
    ry: 70.7107,
    Sx: 1333333.333 / 1000,  // db expects 10^3 mm3
    Sy: 400000 / 1000,
    Zx: 1500000 / 1000,
    Zy: 450000 / 1000,
    J: 500000 / 1000,        // db expects 10^3 mm4
    Cw: 2000000000000 / 1e9, // db expects 10^6 mm6? Actually my code multiplies Cw by 1,000,000 so 10^6 -> mm6. 2e12 / 1e6 = 2e6. Wait, wait, let me check what compression.js does.
    h_tw: 276 / 8,
    bf_2tf: 200 / (2 * 12)
  },
  seismicEnabled: true,
  seismicParams: {
    system: 'smrf',
    sdc: 'd',
    ductility: 'high',
    compactness: 'highly-ductile'
  }
};

const comp = checkCompression(state);
const flex = checkFlexure(state);
const seis = checkSeismic(state);
const inter = checkInteraction(state, null, comp, flex, null);

console.log(JSON.stringify({ comp, flex, seis, inter }, null, 2));
