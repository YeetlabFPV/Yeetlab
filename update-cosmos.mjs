import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { MeshoptEncoder } from 'meshoptimizer/encoder';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const path = 'assets/shreddo-hero/shreddo.glb';
const file = execFileSync('git', ['show', '9efe8d7:' + path]);
const length = file.readUInt32LE(12);
const doc = JSON.parse(file.toString('utf8', 20, 20 + length));
const binary = file.subarray(28 + length);
const horn = doc.nodes.find(node => node.extras?.group === 'horn');
const primitive = doc.meshes[horn.mesh].primitives[0];
const source = Uint8Array.from(fs.readFileSync(process.argv[2]));
const geometry = new STLLoader().parse(source.buffer);
const chunks = [binary];
let offset = binary.length;
let fallback = doc.buffers[1].byteLength;
await MeshoptEncoder.ready;
function add(array, type, componentType, count, target, bounds) {
  const raw = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  const stride = raw.length / count;
  const attributes = target === 34962;
  const bytes = attributes
    ? MeshoptEncoder.encodeVertexBufferLevel(raw, count, stride, 2, 0)
    : MeshoptEncoder.encodeIndexBuffer(raw, count, stride);
  const view = doc.bufferViews.push({
    buffer: 1, byteOffset: fallback, byteLength: raw.length, target,
    ...(attributes ? {byteStride: stride} : {}),
    extensions: {EXT_meshopt_compression: {
      buffer: 0, byteOffset: offset, byteLength: bytes.length, byteStride: stride,
      count, mode: attributes ? 'ATTRIBUTES' : 'TRIANGLES',
    }},
  }) - 1;
  fallback += raw.length;
  const padding = Buffer.alloc((4 - bytes.length % 4) % 4);
  chunks.push(bytes, padding);
  offset += bytes.length + padding.length;
  return doc.accessors.push({bufferView: view, componentType, count, type, ...bounds}) - 1;
}
// STL print coordinates map to the assembly's millimetre axes.
geometry.rotateX(-Math.PI / 2);
geometry.rotateY(Math.PI / 2);
geometry.translate(-48.135, 24, 0);
geometry.translate(...horn.translation.map(value => -value));
geometry.scale(...horn.scale.map(value => 1 / value));
geometry.normalizeNormals();
const indexed = mergeVertices(geometry);
indexed.computeBoundingBox();
const {position, normal} = indexed.attributes;
primitive.attributes = {
  POSITION: add(position.array, 'VEC3', 5126, position.count, 34962, {
    min: indexed.boundingBox.min.toArray(), max: indexed.boundingBox.max.toArray(),
  }),
  NORMAL: add(normal.array, 'VEC3', 5126, normal.count, 34962),
};
const indices = indexed.index.array;
primitive.indices = add(indices, 'SCALAR', indices.BYTES_PER_ELEMENT === 2 ? 5123 : 5125, indices.length, 34963);
horn.name = 'Cosmos-v30';
doc.buffers[0].byteLength = offset;
doc.buffers[1].byteLength = fallback;
const json = Buffer.from(JSON.stringify(doc));
const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const header = Buffer.from(file.subarray(0, 20));
header.writeUInt32LE(28 + padded.length + offset, 8);
header.writeUInt32LE(padded.length, 12);
const binHeader = Buffer.from(file.subarray(20 + length, 28 + length));
binHeader.writeUInt32LE(offset);
fs.writeFileSync(path, Buffer.concat([header, padded, binHeader, ...chunks]));
