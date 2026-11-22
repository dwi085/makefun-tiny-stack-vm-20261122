# Tiny Stack VM

[![make.fun](https://img.shields.io/badge/make.fun-bounty-blue)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![Node](https://img.shields.io/badge/node-22-green)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A tiny stack virtual machine for make.fun's tiny stack ISA v1: 32-bit wrapping integers, a 256-value stack, branches, calls, 256 words of memory, input/output, and ten traps — in one dependency-free `main.ts`, under 8 KB total. `node main.ts` answers every instance in `/input`, writing `/output/<id>/stdout.bin` + `exit.txt`.
