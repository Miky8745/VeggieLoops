<script lang="ts">
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import type { ChannelData, Note } from '$lib/types';
  import {
    MIN_PITCH, MAX_PITCH, KEY_H, STEP_W, GRID_TOTAL_H, DEFAULT_CENTER_PITCH,
    patternWidth, stepToX, pitchToY, xToStep, xToStepFree, yToPitch, clampPitch, isBlackKey, isCNote, pitchName,
  } from '$lib/pianoroll/pitch';
  import { audioEngine } from '$lib/audioEngine';

  let {
    channel,
    tool,
    selectedNoteIds = $bindable(),
    patternLength,
    activeStep = -1,
    currentStepFraction = -1,
    onScroll,
    onViewportResize,
    onDragPitchesChange,
  }: {
    channel: ChannelData;
    tool: 'draw' | 'select';
    selectedNoteIds: Set<number>;
    patternLength: number;
    activeStep?: number;
    currentStepFraction?: number;
    onScroll: (scrollLeft: number, scrollTop: number) => void;
    onViewportResize?: (width: number) => void;
    onDragPitchesChange?: (pitches: Set<number>) => void;
  } = $props();

  const pitches = Array.from({ length: MAX_PITCH - MIN_PITCH + 1 }, (_, i) => MAX_PITCH - i);

  let viewportEl = $state<HTMLElement | null>(null);
  let contentEl  = $state<HTMLElement | null>(null);

  let nextNoteId = 1;
  $effect(() => {
    for (const n of channel.notes) if (n.id >= nextNoteId) nextNoteId = n.id + 1;
  });

  const DEFAULT_NOTE_LENGTH = 8; // 2 beats × 4 steps/beat — default length before any note has been clicked
  const MIN_FREE_LENGTH = 0.05;  // steps — floor for Shift-free resize so length never hits 0/negative

  // Remembers the last note created/clicked/moved/resized, so the next
  // newly-placed note reuses its length. Plain bookkeeping (same category as
  // nextNoteId/clipboard below) — never read from a template, so it doesn't
  // need to be $state.
  let lastLength = DEFAULT_NOTE_LENGTH;

  function localPos(e: MouseEvent | PointerEvent): { x: number; y: number } {
    const rect = contentEl!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function noteAt(step: number, pitch: number): Note | undefined {
    return channel.notes.find(n => n.pitch === pitch && step >= n.start && step < n.start + n.length);
  }

  function createNote(step: number, pitch: number, length: number): Note {
    const note: Note = { id: nextNoteId++, pitch, start: step, length, velocity: 0.8 };
    channel.notes.push(note);
    return note;
  }

  function deleteNote(note: Note) {
    const idx = channel.notes.indexOf(note);
    if (idx !== -1) channel.notes.splice(idx, 1);
    if (selectedNoteIds.has(note.id)) {
      const next = new Set(selectedNoteIds);
      next.delete(note.id);
      selectedNoteIds = next;
    }
  }

  // ── Draw tool ─────────────────────────────────────────────────────
  // Classic click-to-place model: a click on empty space places one note of
  // lastLength; dragging right from that same click resizes just that note's
  // length, locked to the row it was created on (vertical pointer movement is
  // never read during create/resize — there is no "paint across rows" mode).
  type DrawDrag =
    | { mode: 'create';          noteId: number; anchorStepSnapped: number; anchorStepFree: number; anchorPitch: number }
    | { mode: 'resize-existing'; noteId: number; anchorStepSnapped: number; anchorStepFree: number; origLength: number }
    | { mode: 'move';            noteId: number; anchorStepSnapped: number; anchorStepFree: number; anchorPitch: number;
        origStart: number; origPitch: number; lastPreviewPitch: number };

  // $state (not a plain let) so the highlightPitches derivation below can
  // react to the live drag.
  let drawDrag = $state<DrawDrag | null>(null);

  function drawMousedown(e: MouseEvent) {
    if (e.button !== 0) return;
    const { x, y } = localPos(e);
    const stepSnapped = xToStep(x);
    const stepFree = xToStepFree(x);
    const pitch = yToPitch(y);
    if (stepSnapped >= patternLength) return;

    const existing = noteAt(stepSnapped, pitch);
    if (existing) {
      audioEngine.previewNote(channel, existing.pitch);
      const rightEdge = stepToX(existing.start + existing.length);
      if (x >= rightEdge - 6) {
        drawDrag = {
          mode: 'resize-existing', noteId: existing.id,
          anchorStepSnapped: stepSnapped, anchorStepFree: stepFree, origLength: existing.length,
        };
      } else {
        lastLength = existing.length; // clicking/selecting an existing note updates the remembered length
        drawDrag = {
          mode: 'move', noteId: existing.id,
          anchorStepSnapped: stepSnapped, anchorStepFree: stepFree, anchorPitch: pitch,
          origStart: existing.start, origPitch: existing.pitch, lastPreviewPitch: pitch,
        };
      }
      return;
    }

    const len = Math.max(1, Math.min(patternLength - stepSnapped, lastLength));
    const note = createNote(stepSnapped, pitch, len);
    audioEngine.previewNote(channel, pitch);
    drawDrag = {
      mode: 'create', noteId: note.id,
      anchorStepSnapped: stepSnapped, anchorStepFree: stepFree, anchorPitch: pitch,
    };
  }

  function drawPointermove(e: PointerEvent) {
    if (!drawDrag) return;
    if (e.buttons === 0) { commitDrawDrag(); return; }
    const { x, y } = localPos(e);
    const free = e.shiftKey;
    const current = free ? xToStepFree(x) : xToStep(x);
    const minLen = free ? MIN_FREE_LENGTH : 1;

    if (drawDrag.mode === 'create' || drawDrag.mode === 'resize-existing') {
      const note = channel.notes.find(n => n.id === drawDrag!.noteId);
      if (!note) return;
      const anchor = free ? drawDrag.anchorStepFree : drawDrag.anchorStepSnapped;
      if (drawDrag.mode === 'create') {
        note.length = Math.max(minLen, Math.min(patternLength - note.start, current - anchor + 1));
      } else {
        note.length = Math.max(minLen, Math.min(patternLength - note.start, drawDrag.origLength + (current - anchor)));
      }
      // pitch/y intentionally never read here — length-only, row locked to
      // the pitch the note was created/clicked on regardless of vertical
      // pointer movement.
    } else if (drawDrag.mode === 'move') {
      const note = channel.notes.find(n => n.id === drawDrag!.noteId);
      if (!note) return;
      const anchor = free ? drawDrag.anchorStepFree : drawDrag.anchorStepSnapped;
      const pitch = yToPitch(y); // Y always snapped — Shift only frees the X axis
      note.start = Math.max(0, Math.min(patternLength - note.length, drawDrag.origStart + (current - anchor)));
      note.pitch = clampPitch(drawDrag.origPitch + (pitch - drawDrag.anchorPitch));
      if (pitch !== drawDrag.lastPreviewPitch) {
        audioEngine.previewNote(channel, note.pitch);
        drawDrag.lastPreviewPitch = pitch;
      }
    }
  }

  function commitDrawDrag() {
    if (drawDrag) {
      const note = channel.notes.find(n => n.id === drawDrag!.noteId);
      if (note) lastLength = note.length;
    }
    drawDrag = null;
  }

  function drawPointerup() { commitDrawDrag(); }

  // ── Select tool ───────────────────────────────────────────────────
  let marquee = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  let marqueeMode: 'replace' | 'add' | 'toggle' = 'replace';

  type MoveDrag = {
    pointerStepSnapped: number; pointerStepFree: number; pointerPitch: number;
    origins: Map<number, { start: number; pitch: number }>;
    primaryNoteId: number;   // the note actually clicked — drives preview retrigger + lastLength
    lastPreviewPitch: number;
  };
  // $state (not a plain let) so the highlightPitches derivation below can
  // react to the live drag.
  let moveDrag = $state<MoveDrag | null>(null);

  function noteOverlapsRect(n: Note, minX: number, maxX: number, minY: number, maxY: number): boolean {
    const nx0 = stepToX(n.start), nx1 = stepToX(n.start + n.length);
    const ny0 = pitchToY(n.pitch), ny1 = ny0 + KEY_H;
    return nx0 < maxX && nx1 > minX && ny0 < maxY && ny1 > minY;
  }

  function selectMousedown(e: MouseEvent) {
    if (e.button !== 0) return;
    const { x, y } = localPos(e);
    const step = xToStep(x);
    const pitch = yToPitch(y);
    const hit = noteAt(step, pitch);

    if (hit) {
      const additive = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      if (additive) {
        const next = new Set(selectedNoteIds);
        if (next.has(hit.id)) next.delete(hit.id); else next.add(hit.id);
        selectedNoteIds = next;
      } else if (shift) {
        selectedNoteIds = new Set([...selectedNoteIds, hit.id]);
      } else if (!selectedNoteIds.has(hit.id)) {
        selectedNoteIds = new Set([hit.id]);
      }
      if (!selectedNoteIds.has(hit.id)) return;
      lastLength = hit.length;
      audioEngine.previewNote(channel, hit.pitch);
      const origins = new Map<number, { start: number; pitch: number }>();
      for (const n of channel.notes) if (selectedNoteIds.has(n.id)) origins.set(n.id, { start: n.start, pitch: n.pitch });
      moveDrag = {
        pointerStepSnapped: step, pointerStepFree: xToStepFree(x), pointerPitch: pitch,
        origins, primaryNoteId: hit.id, lastPreviewPitch: pitch,
      };
    } else {
      marqueeMode = (e.ctrlKey || e.metaKey) ? 'toggle' : e.shiftKey ? 'add' : 'replace';
      marquee = { x0: x, y0: y, x1: x, y1: y };
    }
  }

  function selectPointermove(e: PointerEvent) {
    if (e.buttons === 0) { marquee = null; commitMoveDrag(); return; }
    const { x, y } = localPos(e);
    if (marquee) {
      marquee = { ...marquee, x1: x, y1: y };
    } else if (moveDrag) {
      const free = e.shiftKey;
      const current = free ? xToStepFree(x) : xToStep(x);
      const anchor = free ? moveDrag.pointerStepFree : moveDrag.pointerStepSnapped;
      const deltaStep = current - anchor;
      const pitch = yToPitch(y); // Y always snapped — Shift only frees the X axis
      const deltaPitch = pitch - moveDrag.pointerPitch;
      for (const n of channel.notes) {
        const origin = moveDrag.origins.get(n.id);
        if (!origin) continue;
        n.start = Math.max(0, Math.min(patternLength - n.length, origin.start + deltaStep));
        n.pitch = clampPitch(origin.pitch + deltaPitch);
      }
      if (pitch !== moveDrag.lastPreviewPitch) {
        const primary = channel.notes.find(n => n.id === moveDrag!.primaryNoteId);
        if (primary) audioEngine.previewNote(channel, primary.pitch);
        moveDrag.lastPreviewPitch = pitch;
      }
    }
  }

  function commitMoveDrag() {
    if (moveDrag) {
      const primary = channel.notes.find(n => n.id === moveDrag!.primaryNoteId);
      if (primary) lastLength = primary.length;
    }
    moveDrag = null;
  }

  function selectPointerup() {
    if (marquee) {
      const minX = Math.min(marquee.x0, marquee.x1), maxX = Math.max(marquee.x0, marquee.x1);
      const minY = Math.min(marquee.y0, marquee.y1), maxY = Math.max(marquee.y0, marquee.y1);
      const hitIds = channel.notes.filter(n => noteOverlapsRect(n, minX, maxX, minY, maxY)).map(n => n.id);
      if (marqueeMode === 'replace') {
        selectedNoteIds = new Set(hitIds);
      } else if (marqueeMode === 'add') {
        selectedNoteIds = new Set([...selectedNoteIds, ...hitIds]);
      } else {
        const next = new Set(selectedNoteIds);
        for (const id of hitIds) { if (next.has(id)) next.delete(id); else next.add(id); }
        selectedNoteIds = next;
      }
      marquee = null;
    }
    commitMoveDrag();
  }

  // ── Drag deleting (right mouse button) ────────────────────────────
  // Works in both tools, mirrors the paint gesture: right-click deletes
  // the note under the cursor, and holding the button while dragging
  // deletes every note the cursor passes over.
  let deleteDragging = false;

  function deleteAt(x: number, y: number) {
    const hit = noteAt(xToStep(x), yToPitch(y));
    if (hit) deleteNote(hit);
  }

  function deleteDragStart(e: MouseEvent) {
    deleteDragging = true;
    const { x, y } = localPos(e);
    deleteAt(x, y);
  }

  // ── Piano-key highlight while a create/resize/move gesture is active ──
  // Right-click delete-drag is intentionally excluded — only create/resize/
  // move gestures highlight a key.
  let activeGestureNoteIds = $derived.by(() => {
    if (drawDrag) return new Set<number>([drawDrag.noteId]);
    if (moveDrag) return new Set<number>(moveDrag.origins.keys());
    return new Set<number>();
  });

  let highlightPitches = $derived.by(() => {
    if (activeGestureNoteIds.size === 0) return new Set<number>();
    const s = new Set<number>();
    for (const n of channel.notes) if (activeGestureNoteIds.has(n.id)) s.add(n.pitch);
    return s;
  });

  function setsEqual(a: Set<number>, b: Set<number>): boolean {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  // $derived.by returns a new Set every recompute even when its contents are
  // unchanged (e.g. every pointermove tick during a pure length-resize,
  // where pitch never changes) — guard against forcing a needless re-render
  // of PianoKeys' 128 rows on every such tick.
  let lastSentHighlight = new Set<number>();
  $effect(() => {
    const next = highlightPitches;
    if (!setsEqual(next, lastSentHighlight)) {
      lastSentHighlight = next;
      onDragPitchesChange?.(next);
    }
  });

  // ── Dispatch by active tool ──────────────────────────────────────
  function gridMousedown(e: MouseEvent) {
    if (e.button === 2) { deleteDragStart(e); return; }
    if (tool === 'draw') drawMousedown(e); else selectMousedown(e);
  }
  function gridPointermove(e: PointerEvent) {
    if (deleteDragging) {
      if (!(e.buttons & 2)) { deleteDragging = false; return; }
      const { x, y } = localPos(e);
      deleteAt(x, y);
      return;
    }
    if (tool === 'draw') drawPointermove(e); else selectPointermove(e);
  }
  function gridPointerup() {
    deleteDragging = false;
    drawPointerup();
    selectPointerup();
  }
  function gridContextmenu(e: MouseEvent) {
    e.preventDefault();
  }

  // ── Keyboard: delete / copy / paste ──────────────────────────────
  let clipboard: Note[] = [];

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNoteIds.size === 0) return;
      channel.notes = channel.notes.filter(n => !selectedNoteIds.has(n.id));
      selectedNoteIds = new Set();
      e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      const sel = channel.notes.filter(n => selectedNoteIds.has(n.id));
      if (sel.length === 0) return;
      clipboard = sel.map(n => ({ ...n }));
      e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      if (clipboard.length === 0) return;
      const minStart = Math.min(...clipboard.map(n => n.start));
      const maxEnd   = Math.max(...clipboard.map(n => n.start + n.length));
      const offset   = maxEnd - minStart;
      const pasted: Note[] = clipboard.map(n => ({
        id: nextNoteId++,
        pitch: n.pitch,
        start: Math.max(0, Math.min(patternLength - n.length, n.start + offset)),
        length: n.length,
        velocity: n.velocity,
      }));
      channel.notes.push(...pasted);
      selectedNoteIds = new Set(pasted.map(n => n.id));
      e.preventDefault();
    }
  }

  function onGridScroll(e: Event) {
    const el = e.currentTarget as HTMLElement;
    onScroll(el.scrollLeft, el.scrollTop);
  }

  // Lets a parent (e.g. the minimap/overview panel) teleport this viewport's
  // scroll position from outside — setting scrollLeft/scrollTop fires the
  // native onscroll handler above, so callers get their own scroll state
  // (and any overlay derived from it) corrected to the real post-clamp value
  // for free, with no extra plumbing.
  export function scrollTo(x: number, y: number) {
    if (!viewportEl) return;
    viewportEl.scrollLeft = x;
    viewportEl.scrollTop = y;
  }

  onMount(() => {
    if (!viewportEl) return;
    const target = Math.max(0, pitchToY(DEFAULT_CENTER_PITCH) - viewportEl.clientHeight / 2);
    viewportEl.scrollTop = target;
    onScroll(viewportEl.scrollLeft, viewportEl.scrollTop);
    onViewportResize?.(viewportEl.clientWidth);
  });

  $effect(() => {
    if (!viewportEl) return;
    const el = viewportEl;
    const ro = new ResizeObserver(() => onViewportResize?.(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  });
</script>

<svelte:window onpointermove={gridPointermove} onpointerup={gridPointerup} onkeydown={handleKeydown} />

<div class="grid-viewport" bind:this={viewportEl} onscroll={onGridScroll} role="grid" aria-label="Note grid" tabindex="-1">
  <div
    class="grid-content"
    bind:this={contentEl}
    style="width:{patternWidth(patternLength)}px; height:{GRID_TOTAL_H}px;"
    onmousedown={gridMousedown}
    oncontextmenu={gridContextmenu}
    role="presentation"
  >
    {#each pitches as p (p)}
      <div
        class="grid-row"
        class:grid-row--black={isBlackKey(p)}
        class:grid-row--c={isCNote(p)}
        style="top:{pitchToY(p)}px; height:{KEY_H}px;"
      ></div>
    {/each}

    {#each Array(patternLength) as _, i}
      <div
        class="grid-col"
        class:grid-col--orange={Math.floor(i / 4) % 2 === 1}
        style="left:{stepToX(i)}px; width:{STEP_W}px;"
      ></div>
    {/each}

    {#if activeStep >= 0}
      <div class="playhead" style="left:{stepToX(activeStep)}px; width:{STEP_W}px;"></div>
    {/if}

    {#if currentStepFraction >= 0}
      <div class="playhead-line" style="left:{currentStepFraction * STEP_W}px;"></div>
    {/if}

    {#key channel.id}
      {#each channel.notes as note (note.id)}
        <div
          class="note"
          class:note--selected={selectedNoteIds.has(note.id)}
          style="left:{stepToX(note.start)}px; top:{pitchToY(note.pitch)}px; width:{note.length * STEP_W - 1}px; height:{KEY_H - 1}px;"
          out:scale={{ duration: 140, start: 0.85 }}
        >
          <span class="note-label">{pitchName(note.pitch)}</span>
        </div>
      {/each}
    {/key}

    {#if marquee}
      {@const mx = Math.min(marquee.x0, marquee.x1)}
      {@const my = Math.min(marquee.y0, marquee.y1)}
      {@const mw = Math.abs(marquee.x1 - marquee.x0)}
      {@const mh = Math.abs(marquee.y1 - marquee.y0)}
      <div class="marquee" style="left:{mx}px; top:{my}px; width:{mw}px; height:{mh}px;"></div>
    {/if}
  </div>
</div>

<style>
  .grid-viewport {
    height: 100%;
    overflow: auto;
    overflow-anchor: none;
    position: relative;
    background: #141414;
  }

  .grid-content {
    position: relative;
    cursor: crosshair;
  }

  .grid-row {
    position: absolute;
    left: 0;
    right: 0;
    box-sizing: border-box;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .grid-row--black { background: rgba(0,0,0,0.22); }
  .grid-row--c { border-bottom: 1px solid rgba(255,255,255,0.1); }

  .grid-col {
    position: absolute;
    top: 0;
    bottom: 0;
    box-sizing: border-box;
    border-right: 1px solid rgba(255,255,255,0.04);
  }

  .grid-col--orange { background: rgba(144,195,150,0.03); }

  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(255,255,255,0.08);
    outline: 1px solid rgba(255,255,255,0.3);
    pointer-events: none;
    z-index: 2;
  }

  .note {
    position: absolute;
    box-sizing: border-box;
    background: var(--accent, #90c396);
    border: 1px solid rgba(0,0,0,0.4);
    border-radius: 5px;
    z-index: 3;
    cursor: default;
    display: flex;
    align-items: center;
    overflow: hidden;
  }

  .note-label {
    padding-left: 3px;
    font-size: 9px;
    font-family: 'DM Mono', monospace;
    color: rgba(0,0,0,0.55);
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
  }

  .playhead-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: #fff;
    box-shadow: 0 0 4px rgba(255,255,255,0.6);
    pointer-events: none;
    z-index: 4;
  }

  .note--selected {
    background: var(--accent-hover, #a1cca6);
    outline: 1px solid #fff;
    outline-offset: -1px;
  }

  .marquee {
    position: absolute;
    background: rgba(144,195,150,0.15);
    border: 1px solid var(--accent, #90c396);
    z-index: 4;
    pointer-events: none;
  }
</style>
