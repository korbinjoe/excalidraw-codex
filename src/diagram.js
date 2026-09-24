import {
  convertToExcalidrawElements,
  restoreElements,
  newElementWith,
} from "@excalidraw/excalidraw";
// Keep untouched elements intact, and let Excalidraw measure labels and bind arrows.
export function applyPatch(current, patch) {
  for (const key of ["create", "update", "delete"])
    if (patch[key] !== undefined && !Array.isArray(patch[key]))
      throw new Error(`${key} must be an array`);
  const source = structuredClone(current),
    map = new Map(source.map((e) => [e.id, e]));
  const touched = new Set(),
    removed = new Set(patch.delete || []),
    relabel = new Set(),
    geometry = new Set();
  for (const id of removed)
    if (!map.has(id)) throw new Error(`Element not found: ${id}`);
  for (const item of patch.update || []) {
    const el = map.get(item.id);
    if (!el || el.isDeleted) throw new Error(`Element not found: ${item.id}`);
    const set = { ...item.set };
    if ("id" in set || "type" in set || "isDeleted" in set)
      throw new Error("Cannot change id/type/isDeleted through update.");
    if ("text" in set && el.type !== "text") {
      set.label = { text: set.text };
      delete set.text;
    }
    if (set.label) relabel.add(el.id);
    if (["x", "y", "width", "height"].some((k) => k in set))
      geometry.add(el.id);
    Object.assign(el, set);
    touched.add(el.id);
  }
  for (const el of source) {
    if (el.containerId && removed.has(el.containerId)) removed.add(el.id);
    if (
      removed.has(el.startBinding?.elementId) ||
      removed.has(el.endBinding?.elementId)
    )
      removed.add(el.id);
  }
  for (const el of source)
    if (el.containerId && removed.has(el.containerId)) removed.add(el.id);
  for (const el of source) {
    if (removed.has(el.id)) continue;
    if (geometry.has(el.id) || relabel.has(el.id)) {
      const text = source.find((t) => t.containerId === el.id && !t.isDeleted);
      if (text) {
        touched.add(text.id);
        el.label = {
          id: text.id,
          text: text.originalText || text.text,
          fontSize: text.fontSize,
          fontFamily: text.fontFamily,
          ...el.label,
        };
        removed.add(text.id);
        el.boundElements = (el.boundElements || []).filter(
          (b) => b.id !== text.id,
        );
      }
    }
    if (
      el.type === "arrow" &&
      (geometry.has(el.startBinding?.elementId) ||
        geometry.has(el.endBinding?.elementId))
    ) {
      if (el.startBinding) el.start = { id: el.startBinding.elementId };
      if (el.endBinding) el.end = { id: el.endBinding.elementId };
      touched.add(el.id);
    }
  }
  const additions = (patch.create || []).map((item) => {
    const el = {
      fillStyle: "solid",
      roughness: 1,
      strokeWidth: 2,
      fontFamily: 2,
      fontSize: 20,
      ...item,
    };
    el.id ||= crypto.randomUUID();
    if (map.has(el.id)) throw new Error(`Duplicate ID: ${el.id}`);
    if (
      ![
        "rectangle",
        "ellipse",
        "diamond",
        "text",
        "arrow",
        "line",
        "frame",
      ].includes(el.type)
    )
      throw new Error(`Unsupported create type: ${el.type}`);
    if (el.type !== "text" && typeof el.text === "string") {
      el.label = {
        text: el.text,
        fontFamily: el.fontFamily,
        fontSize: el.fontSize,
      };
      delete el.text;
    }
    if (el.type === "arrow") {
      el.x ??= 0;
      el.y ??= 0;
      if (el.startElementId) el.start = { id: el.startElementId };
      if (el.endElementId) el.end = { id: el.endElementId };
      delete el.startElementId;
      delete el.endElementId;
    }
    map.set(el.id, el);
    touched.add(el.id);
    return el;
  });
  const live = [
    ...source.filter((e) => !e.isDeleted && !removed.has(e.id)),
    ...additions,
  ];
  for (const el of live)
    for (const binding of [el.start, el.end])
      if (binding?.id && !live.some((e) => e.id === binding.id))
        throw new Error(`Missing arrow endpoint: ${binding.id}`);
  // Binding establishes relationships; it does not calculate the initial route.
  for (const arrow of live)
    if (arrow.type === "arrow" && arrow.start?.id && arrow.end?.id) {
      const a = map.get(arrow.start.id),
        b = map.get(arrow.end.id);
      const ax = a.x + (a.width || 100) / 2,
        ay = a.y + (a.height || 100) / 2,
        bx = b.x + (b.width || 100) / 2,
        by = b.y + (b.height || 100) / 2;
      let sx, sy, ex, ey;
      if (Math.abs(bx - ax) > Math.abs(by - ay)) {
        const sign = bx >= ax ? 1 : -1;
        sx = ax + sign * ((a.width || 100) / 2 + 10);
        sy = ay;
        ex = bx - sign * ((b.width || 100) / 2 + 10);
        ey = by;
      } else {
        const sign = by >= ay ? 1 : -1;
        sx = ax;
        sy = ay + sign * ((a.height || 100) / 2 + 10);
        ex = bx;
        ey = by - sign * ((b.height || 100) / 2 + 10);
      }
      arrow.x = sx;
      arrow.y = sy;
      arrow.points = [
        [0, 0],
        [ex - sx, ey - sy],
      ];
      arrow.width = Math.abs(ex - sx);
      arrow.height = Math.abs(ey - sy);
    }
  const converted = convertToExcalidrawElements(live, { regenerateIds: false });
  const original = new Map(current.map((e) => [e.id, e]));
  const result = converted.map((el) => {
    const prior = original.get(el.id);
    if (!prior) return el;
    const bindingChanged =
      JSON.stringify(prior.boundElements) !== JSON.stringify(el.boundElements);
    if (touched.has(el.id))
      return newElementWith(prior, { ...el, version: prior.version + 1 });
    if (bindingChanged)
      return newElementWith(prior, { boundElements: el.boundElements });
    return prior;
  });
  for (const el of current)
    if (
      (removed.has(el.id) || el.isDeleted) &&
      !result.some((n) => n.id === el.id)
    )
      result.push(newElementWith(el, { isDeleted: true }));
  return restoreElements(result, null, {
    repairBindings: true,
    refreshDimensions: true,
  });
}
