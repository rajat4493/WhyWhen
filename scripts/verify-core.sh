#!/usr/bin/env bash
set -euo pipefail
TMP="${TMPDIR:-/tmp}/intent-scheduler-core-check"
rm -rf "$TMP"
mkdir -p "$TMP"
tsc --target ES2022 --module commonjs --moduleResolution node --lib ES2022,DOM --strict --skipLibCheck --outDir "$TMP" \
  src/core/domain/types.ts \
  src/core/availability/calculate-slots.ts \
  src/core/integrations/calendar/adapter.ts \
  src/core/integrations/calendar/google.ts \
  src/core/integrations/calendar/microsoft.ts \
  src/core/integrations/calendar/zoho.ts
node - "$TMP" <<'NODE'
const assert=require('assert');
const tmp=process.argv[2];
const {calculateSlots}=require(`${tmp}/availability/calculate-slots.js`);
const win={start:'2026-10-20T09:00:00.000Z',end:'2026-10-20T12:00:00.000Z'};
let slots=calculateSlots(win,[],{durationMinutes:30,stepMinutes:30,bufferBeforeMinutes:0,bufferAfterMinutes:0}); assert.equal(slots.length,6);
slots=calculateSlots(win,[{start:'2026-10-20T10:00:00.000Z',end:'2026-10-20T10:30:00.000Z'}],{durationMinutes:30,stepMinutes:30,bufferBeforeMinutes:0,bufferAfterMinutes:0}); assert.equal(slots.length,5);
slots=calculateSlots(win,[{start:'2026-10-20T10:00:00.000Z',end:'2026-10-20T10:30:00.000Z'}],{durationMinutes:30,stepMinutes:30,bufferBeforeMinutes:15,bufferAfterMinutes:15}); assert(!slots.some(s=>s.start==='2026-10-20T09:30:00.000Z')); assert(!slots.some(s=>s.start==='2026-10-20T10:30:00.000Z'));
console.log('core verification: PASS');
NODE
