<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChannelData, Note } from '$lib/types';
  import {
    MIN_PITCH, MAX_PITCH, KEY_H, STEP_W, GRID_TOTAL_H, DEFAULT_CENTER_PITCH,
    patternWidth, stepToX, pitchToY, xToStep, yToPitch, clampPitch, isBlackKey, isCNote,
  } from '$lib/pianoroll/pitch';

  let {
    channel,
    tool,
    selectedNoteIds = $bindable(),
    patternLength,
    activeStep = -1,
    currentStepFraction = -1,
    onScroll,
    onViewportResize,
  }: {
    channel: ChannelData;
    tool: 'draw' | 'select';
    selectedNoteIds: Set<number>;
    patternLength: number;
    activeStep?: number;
    currentStepFraction?: number;
    onScroll: (scrollLeft: number, scrollTop: number) => void;
    onViewportResize?: (width: number) => void;
  } = $props();

  const pitches = Array.from({ length: MAX_PITCH - MIN_PITCH + 1 }, (_, i) => MAX_PITCH - i);

  let viewportEl = $state<HTMLElement | null>(null);
  let contentEl  = $state<HTMLElement | null>(null);

  let nextNoteId = 1;
  $effect(() => {
    for (const n of channel.notes) if (n.id >= nextNoteId) nextNoteId = n.id + 1;
  });

  function localPos(e: MouseEvent | PointerEvent): { x: number; y: number } {
    const rect = contentEl!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function noteAt(step: number, pitch: number): Note | undefined {
    return channel.notes.find(n => n.pitch === pitch && step >= n.start && step < n.start + n.length);
  }

  function createNote(step: number, pitch: number): Note {
    const note: Note = { id: nextNoteId++, pitch, start: step, length: 1, velocity: 0.8 };
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
  type DrawDrag =
    | { mode: 'resize-new';      noteId: number }
    | { mode: 'resize-existing'; noteId: number; anchorStep: number; origLength: number }
    | { mode: 'move';            noteId: number; pointerStep: number; pointerPitch: number; origStart: number; origPitch: number }
    | { mode: 'paint';           lastCell: string | null };

  let drawDrag: DrawDrag | null = null;

  function drawMousedown(e: MouseEvent) {
    if (e.button !== 0) return;
    const { x, y } = localPos(e);
    const step = xToStep(x);
    const pitch = yToPitch(y);
    if (step >= patternLength) return;

    const existing = noteAt(step, pitch);
    if (existing) {
      const rightEdge = stepToX(existing.start + existing.length);
      if (x >= rightEdge - 6) {
        drawDrag = { mode: 'resize-existing', noteId: existing.id, anchorStep: step, origLength: existing.length };
      } else {
        drawDrag = { mode: 'move', noteId: existing.id, pointerStep: step, pointerPitch: pitch, origStart: existing.start, origPitch: existing.pitch };
      }
      return;
    }

    const note = createNote(step, pitch);
    drawDrag = { mode: 'resize-new', noteId: note.id };
  }

  function drawPointermove(e: PointerEvent) {
    if (!drawDrag) return;
    if (e.buttons === 0) { drawDrag = null; return; }
    const { x, y } = localPos(e);
    const step = xToStep(x);
    const pitch = yToPitch(y);

    if (drawDrag.mode === 'resize-new') {
      const noteId = drawDrag.noteId;
      const note = channel.notes.find(n => n.id === noteId);
      if (!note) return;
      if (pitch !== note.pitch) {
        // dragged into a different row before resizing — switch to painting
        // 1-step notes across whichever cells the pointer enters next
        if (!noteAt(step, pitch)) createNote(step, pitch);
        drawDrag = { mode: 'paint', lastCell: `${step},${pitch}` };
        return;
      }
      note.length = Math.max(1, Math.min(patternLength - note.start, step - note.start + 1));
    } else if (drawDrag.mode === 'resize-existing') {
      const noteId = drawDrag.noteId;
      const note = channel.notes.find(n => n.id === noteId);
      if (!note) return;
      note.length = Math.max(1, Math.min(patternLength - note.start, drawDrag.origLength + (step - drawDrag.anchorStep)));
    } else if (drawDrag.mode === 'move') {
      const noteId = drawDrag.noteId;
      const note = channel.notes.find(n => n.id === noteId);
      if (!note) return;
      const deltaStep = step - drawDrag.pointerStep;
      const deltaPitch = pitch - drawDrag.pointerPitch;
      note.start = Math.max(0, Math.min(patternLength - note.length, drawDrag.origStart + deltaStep));
      note.pitch = clampPitch(drawDrag.origPitch + deltaPitch);
    } else if (drawDrag.mode === 'paint') {
      const cellKey = `${step},${pitch}`;
      if (cellKey !== drawDrag.lastCell) {
        if (!noteAt(step, pitch)) createNote(step, pitch);
        drawDrag = { mode: 'paint', lastCell: cellKey };
      }
    }
  }

  function drawPointerup() { drawDrag = null; }

  // ── Select tool ───────────────────────────────────────────────────
  let marquee = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  let marqueeMode: 'replace' | 'add' | 'toggle' = 'replace';

  type MoveDrag = { pointerStep: number; pointerPitch: number; origins: Map<number, { start: number; pitch: number }> };
  let moveDrag: MoveDrag | null = null;

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
      const origins = new Map<number, { start: number; pitch: number }>();
      for (const n of channel.notes) if (selectedNoteIds.has(n.id)) origins.set(n.id, { start: n.start, pitch: n.pitch });
      moveDrag = { pointerStep: step, pointerPitch: pitch, origins };
    } else {
      marqueeMode = (e.ctrlKey || e.metaKey) ? 'toggle' : e.shiftKey ? 'add' : 'replace';
      marquee = { x0: x, y0: y, x1: x, y1: y };
    }
  }

  function selectPointermove(e: PointerEvent) {
    if (e.buttons === 0) { marquee = null; moveDrag = null; return; }
    const { x, y } = localPos(e);
    if (marquee) {
      marquee = { ...marquee, x1: x, y1: y };
    } else if (moveDrag) {
      const step = xToStep(x);
      const pitch = yToPitch(y);
      const deltaStep = step - moveDrag.pointerStep;
      const deltaPitch = pitch - moveDrag.pointerPitch;
      for (const n of channel.notes) {
        const origin = moveDrag.origins.get(n.id);
        if (!origin) continue;
        n.start = Math.max(0, Math.min(patternLength - n.length, origin.start + deltaStep));
        n.pitch = clampPitch(origin.pitch + deltaPitch);
      }
    }
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
    moveDrag = null;
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
        start: n.start + offset,
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

    {#each channel.notes as note (note.id)}
      <div
        class="note"
        class:note--selected={selectedNoteIds.has(note.id)}
        style="left:{stepToX(note.start)}px; top:{pitchToY(note.pitch)}px; width:{note.length * STEP_W - 1}px; height:{KEY_H - 1}px;"
      ></div>
    {/each}

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
    border-radius: 2px;
    z-index: 3;
    cursor: default;
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
