// Tiny stack VM: make.fun tiny stack ISA v1. node main.ts answers every
// /input/<id>/program.bin (+input.bin), writing /output/<id>/stdout.bin + exit.txt.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
function run(p, inp) {
  const n = p.length, st = new Int32Array(256), mem = new Int32Array(256),
    cs = new Int32Array(64), out = Buffer.alloc(65536);
  let sp = 0, cp = 0, ol = 0, pc = 0, steps = 0, ip = 0;
  const E = (c) => [out.subarray(0, ol), c];
  while (true) {
    if (steps >= 1e6) return E(10);
    if (pc < 0 || pc >= n) return E(9);
    const op = p[pc];
    let a, b;
    switch (op) {
      case 0: return E(0);
      case 1:
        if (pc + 1 >= n) return E(9);
        if (sp >= 256) return E(3);
        st[sp++] = (p[pc + 1] << 24) >> 24; pc += 2; break;
      case 2:
        if (pc + 4 >= n) return E(9);
        if (sp >= 256) return E(3);
        st[sp++] = p[pc + 1] | (p[pc + 2] << 8) | (p[pc + 3] << 16) | (p[pc + 4] << 24);
        pc += 5; break;
      case 3:
        if (sp < 1) return E(2);
        sp--; pc++; break;
      case 4:
        if (sp < 1) return E(2);
        if (sp >= 256) return E(3);
        st[sp] = st[sp - 1]; sp++; pc++; break;
      case 5:
        if (sp < 2) return E(2);
        a = st[sp - 1]; st[sp - 1] = st[sp - 2]; st[sp - 2] = a; pc++; break;
      case 6:
        if (sp < 2) return E(2);
        if (sp >= 256) return E(3);
        st[sp] = st[sp - 2]; sp++; pc++; break;
      case 7:
        if (sp < 3) return E(2);
        a = st[sp - 3]; st[sp - 3] = st[sp - 2]; st[sp - 2] = st[sp - 1]; st[sp - 1] = a;
        pc++; break;
      case 16:
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = (st[sp - 1] + b) | 0; pc++; break;
      case 17:
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = (st[sp - 1] - b) | 0; pc++; break;
      case 18:
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = Math.imul(st[sp - 1], b); pc++; break;
      case 19:
        if (sp < 2) return E(2);
        b = st[--sp]; a = st[sp - 1];
        if (b === 0) return E(4);
        st[sp - 1] = (a / b) | 0; pc++; break;
      case 20:
        if (sp < 2) return E(2);
        b = st[--sp]; a = st[sp - 1];
        if (b === 0) return E(4);
        st[sp - 1] = a % b; pc++; break;
      case 21:
        if (sp < 2) return E(2);
        b = st[--sp]; a = st[sp - 1];
        if (b === 0) return E(4);
        st[sp - 1] = ((a >>> 0) / (b >>> 0)) | 0; pc++; break;
      case 22:
        if (sp < 2) return E(2);
        b = st[--sp]; a = st[sp - 1];
        if (b === 0) return E(4);
        st[sp - 1] = ((a >>> 0) % (b >>> 0)) | 0; pc++; break;
      case 23:
        if (sp < 1) return E(2);
        st[sp - 1] = (-st[sp - 1]) | 0; pc++; break;
      case 24:
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] & b; pc++; break;
      case 25:
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] | b; pc++; break;
      case 26:
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] ^ b; pc++; break;
      case 27:
        if (sp < 1) return E(2);
        st[sp - 1] = ~st[sp - 1]; pc++; break;
      case 28:
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] << (b & 31); pc++; break;
      case 29:
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] >> (b & 31); pc++; break;
      case 30:
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = (st[sp - 1] >>> (b & 31)) | 0; pc++; break;
      case 32:
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] === b ? 1 : 0; pc++; break;
      case 33:
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] < b ? 1 : 0; pc++; break;
      case 34:
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = (st[sp - 1] >>> 0) < (b >>> 0) ? 1 : 0; pc++; break;
      case 48:
        if (pc + 2 >= n) return E(9);
        pc = pc + 3 + (((p[pc + 1] | (p[pc + 2] << 8)) << 16) >> 16); break;
      case 49:
        if (pc + 2 >= n) return E(9);
        if (sp < 1) return E(2);
        a = st[--sp];
        pc = a === 0 ? pc + 3 + (((p[pc + 1] | (p[pc + 2] << 8)) << 16) >> 16) : pc + 3; break;
      case 50:
        if (pc + 2 >= n) return E(9);
        if (sp < 1) return E(2);
        a = st[--sp];
        pc = a !== 0 ? pc + 3 + (((p[pc + 1] | (p[pc + 2] << 8)) << 16) >> 16) : pc + 3; break;
      case 51:
        if (pc + 2 >= n) return E(9);
        if (cp >= 64) return E(7);
        cs[cp++] = pc + 3; pc = p[pc + 1] | (p[pc + 2] << 8); break;
      case 52:
        if (cp === 0) return E(8);
        pc = cs[--cp]; break;
      case 64:
        if (sp < 1) return E(2);
        a = st[sp - 1];
        if (a < 0 || a > 255) return E(6);
        st[sp - 1] = mem[a]; pc++; break;
      case 65:
        if (sp < 2) return E(2);
        a = st[sp - 1]; b = st[sp - 2];
        if (a < 0 || a > 255) return E(6);
        mem[a] = b; sp -= 2; pc++; break;
      case 80:
        if (sp < 1) return E(2);
        a = String(st[--sp]);
        if (ol + a.length > 65536) return E(11);
        out.write(a, ol, 'ascii'); ol += a.length; pc++; break;
      case 81:
        if (sp < 1) return E(2);
        if (ol >= 65536) return E(11);
        out[ol++] = st[--sp] & 255; pc++; break;
      case 82:
        if (sp >= 256) return E(3);
        st[sp++] = ip < inp.length ? inp[ip++] : -1; pc++; break;
      case 83:
        if (sp < 1) return E(2);
        return E(st[--sp] & 255);
      default: return E(5);
    }
    steps++;
  }
}

for (const id of readdirSync(IN, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  const dir = join(IN, id);
  let prog; try { prog = readFileSync(join(dir, 'program.bin')); } catch { prog = Buffer.alloc(0); }
  let inp; try { inp = readFileSync(join(dir, 'input.bin')); } catch { inp = Buffer.alloc(0); }
  const [stdout, code] = run(prog, inp);
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'stdout.bin'), stdout);
  writeFileSync(join(OUT, id, 'exit.txt'), String(code) + '\n');
}
