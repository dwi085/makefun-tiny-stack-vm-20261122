// Tiny stack VM for make.fun's tiny stack ISA v1 (kit ISA.md).
// node main.ts answers every /input/<id>/program.bin (+input.bin) and
// writes /output/<id>/stdout.bin + exit.txt. Node 22, no deps.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
function run(p, inp) {
  const n = p.length, st = new Int32Array(256), mem = new Int32Array(256),
    cs = new Int32Array(64), out = Buffer.alloc(65536);
  let sp = 0, cp = 0, ol = 0, pc = 0, steps = 0, ip = 0;
  const E = (c) => [out.subarray(0, ol), c]; // end with trap/exit code c
  while (true) {
    if (steps >= 1e6) return E(10); // step limit
    if (pc < 0 || pc >= n) return E(9); // pc outside program
    const op = p[pc];
    let a, b;
    switch (op) {
      case 0x00: return E(0); // HALT
      case 0x01: // PUSH8, sign-extended
        if (pc + 1 >= n) return E(9);
        if (sp >= 256) return E(3);
        st[sp++] = (p[pc + 1] << 24) >> 24; pc += 2; break;
      case 0x02: // PUSH32, little-endian signed
        if (pc + 4 >= n) return E(9);
        if (sp >= 256) return E(3);
        st[sp++] = p[pc + 1] | (p[pc + 2] << 8) | (p[pc + 3] << 16) | (p[pc + 4] << 24);
        pc += 5; break;
      case 0x03: // POP
        if (sp < 1) return E(2);
        sp--; pc++; break;
      case 0x04: // DUP
        if (sp < 1) return E(2);
        if (sp >= 256) return E(3);
        st[sp] = st[sp - 1]; sp++; pc++; break;
      case 0x05: // SWAP
        if (sp < 2) return E(2);
        a = st[sp - 1]; st[sp - 1] = st[sp - 2]; st[sp - 2] = a; pc++; break;
      case 0x06: // OVER
        if (sp < 2) return E(2);
        if (sp >= 256) return E(3);
        st[sp] = st[sp - 2]; sp++; pc++; break;
      case 0x07: // ROT (a b c -- b c a)
        if (sp < 3) return E(2);
        a = st[sp - 3]; st[sp - 3] = st[sp - 2]; st[sp - 2] = st[sp - 1]; st[sp - 1] = a;
        pc++; break;
      case 0x10: // ADD, wraps
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = (st[sp - 1] + b) | 0; pc++; break;
      case 0x11: // SUB
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = (st[sp - 1] - b) | 0; pc++; break;
      case 0x12: // MUL, low 32 bits of exact product
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = Math.imul(st[sp - 1], b); pc++; break;
      case 0x13: // DIV, trunc toward zero; b=0 traps 4
        if (sp < 2) return E(2);
        b = st[--sp]; a = st[sp - 1];
        if (b === 0) return E(4);
        st[sp - 1] = (a / b) | 0; pc++; break; // INT_MIN/-1 -> INT_MIN via |0
      case 0x14: // MOD, sign of a; b=0 traps 4
        if (sp < 2) return E(2);
        b = st[--sp]; a = st[sp - 1];
        if (b === 0) return E(4);
        st[sp - 1] = a % b; pc++; break; // x%-1 is 0 in JS, as required
      case 0x15: // DIVU, unsigned
        if (sp < 2) return E(2);
        b = st[--sp]; a = st[sp - 1];
        if (b === 0) return E(4);
        st[sp - 1] = ((a >>> 0) / (b >>> 0)) | 0; pc++; break;
      case 0x16: // MODU, unsigned
        if (sp < 2) return E(2);
        b = st[--sp]; a = st[sp - 1];
        if (b === 0) return E(4);
        st[sp - 1] = ((a >>> 0) % (b >>> 0)) | 0; pc++; break;
      case 0x17: // NEG
        if (sp < 1) return E(2);
        st[sp - 1] = (-st[sp - 1]) | 0; pc++; break;
      case 0x18: // AND
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] & b; pc++; break;
      case 0x19: // OR
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] | b; pc++; break;
      case 0x1a: // XOR
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] ^ b; pc++; break;
      case 0x1b: // NOT
        if (sp < 1) return E(2);
        st[sp - 1] = ~st[sp - 1]; pc++; break;
      case 0x1c: // SHL, only low 5 bits of count
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] << (b & 31); pc++; break;
      case 0x1d: // SHR, arithmetic
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] >> (b & 31); pc++; break;
      case 0x1e: // SHRU, logical, read back signed
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = (st[sp - 1] >>> (b & 31)) | 0; pc++; break;
      case 0x20: // EQ
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] === b ? 1 : 0; pc++; break;
      case 0x21: // LT, signed
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = st[sp - 1] < b ? 1 : 0; pc++; break;
      case 0x22: // LTU, unsigned
        if (sp < 2) return E(2);
        b = st[--sp]; st[sp - 1] = (st[sp - 1] >>> 0) < (b >>> 0) ? 1 : 0; pc++; break;
      case 0x30: // JMP, signed 16-bit offset from next instruction
        if (pc + 2 >= n) return E(9);
        pc = pc + 3 + (((p[pc + 1] | (p[pc + 2] << 8)) << 16) >> 16); break;
      case 0x31: // JZ
        if (pc + 2 >= n) return E(9);
        if (sp < 1) return E(2);
        a = st[--sp];
        pc = a === 0 ? pc + 3 + (((p[pc + 1] | (p[pc + 2] << 8)) << 16) >> 16) : pc + 3; break;
      case 0x32: // JNZ
        if (pc + 2 >= n) return E(9);
        if (sp < 1) return E(2);
        a = st[--sp];
        pc = a !== 0 ? pc + 3 + (((p[pc + 1] | (p[pc + 2] << 8)) << 16) >> 16) : pc + 3; break;
      case 0x33: // CALL, unsigned 16-bit target; 64 held -> trap 7
        if (pc + 2 >= n) return E(9);
        if (cp >= 64) return E(7);
        cs[cp++] = pc + 3; pc = p[pc + 1] | (p[pc + 2] << 8); break;
      case 0x34: // RET; empty call stack -> trap 8
        if (cp === 0) return E(8);
        pc = cs[--cp]; break;
      case 0x40: // LOAD; addr outside 0..255 -> trap 6
        if (sp < 1) return E(2);
        a = st[sp - 1];
        if (a < 0 || a > 255) return E(6);
        st[sp - 1] = mem[a]; pc++; break;
      case 0x41: // STORE (v addr --); addr outside 0..255 -> trap 6
        if (sp < 2) return E(2);
        a = st[sp - 1]; b = st[sp - 2];
        if (a < 0 || a > 255) return E(6);
        mem[a] = b; sp -= 2; pc++; break;
      case 0x50: // PRINT, decimal ASCII; past 65536 bytes -> trap 11
        if (sp < 1) return E(2);
        a = String(st[--sp]);
        if (ol + a.length > 65536) return E(11);
        out.write(a, ol, 'ascii'); ol += a.length; pc++; break;
      case 0x51: // PUTC, one byte; past 65536 bytes -> trap 11
        if (sp < 1) return E(2);
        if (ol >= 65536) return E(11);
        out[ol++] = st[--sp] & 255; pc++; break;
      case 0x52: // IN, next input byte or -1 when used up
        if (sp >= 256) return E(3);
        st[sp++] = ip < inp.length ? inp[ip++] : -1; pc++; break;
      case 0x53: // EXIT, code is the low byte
        if (sp < 1) return E(2);
        return E(st[--sp] & 255);
      default: return E(5); // unknown opcode
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
