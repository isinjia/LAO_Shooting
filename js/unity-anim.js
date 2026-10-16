/**
 * Minimal Unity YAML AnimationClip parser -> sampler
 * Supports m_EulerCurves / m_PositionCurves / m_ScaleCurves with path + curve keyframes.
 */
export function parseUnityAnim(text) {
  const lines = text.split(/\r?\n/);
  const clip = { name: 'clip', length: 0, curves: [] };
  let i = 0;
  let current = null; // { path, type, keys: [{t,x,y,z}] }
  let inCurve = false;
  let expectingValue = false;

  const flush = () => {
    if (current && current.keys.length) {
      clip.curves.push(current);
      const last = current.keys[current.keys.length - 1];
      if (last.t > clip.length) clip.length = last.t;
    }
    current = null;
    inCurve = false;
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    i++;

    if (line.startsWith('m_Name:') && !clip._named) {
      clip.name = line.slice(7).trim();
      clip._named = true;
      continue;
    }

    if (line === 'm_EulerCurves:' || line.startsWith('m_EulerCurves:')) {
      flush();
      continue;
    }
    if (line === 'm_PositionCurves:' || line.startsWith('m_PositionCurves:')) {
      flush();
      continue;
    }
    if (line === 'm_ScaleCurves:' || line.startsWith('m_ScaleCurves:')) {
      flush();
      continue;
    }

    // new curve block often starts with "- curve:" under a list item that has path nearby
    if (line.startsWith('path:')) {
      // path may appear before or after curve; store pending path
      const path = line.slice(5).trim();
      if (current && !current.path) current.path = path;
      else {
        // associate with last curve without path
        const last = clip.curves[clip.curves.length - 1];
        if (last && !last.path) last.path = path;
        else {
          // start placeholder
          flush();
          current = { path, type: 'euler', keys: [] };
        }
      }
      continue;
    }

    if (line.startsWith('- curve:') || line === 'curve:') {
      flush();
      current = { path: '', type: guessType(lines, i), keys: [] };
      inCurve = true;
      continue;
    }

    // Detect section type from recent headers - look back
    if (line.startsWith('attribute:')) {
      // float curves
      continue;
    }

    if (inCurve && line.startsWith('time:')) {
      const t = parseFloat(line.slice(5).trim());
      // look ahead for value
      let value = null;
      for (let j = i; j < Math.min(i + 6, lines.length); j++) {
        const L = lines[j].trim();
        if (L.startsWith('value:')) {
          value = parseVec(L.slice(6).trim());
          break;
        }
      }
      if (value && current) {
        current.keys.push({ t, ...value });
        if (t > clip.length) clip.length = t;
      }
      continue;
    }
  }
  flush();
  delete clip._named;

  // Fix types by scanning original for which section each path is in - second pass simpler:
  return secondPassTypes(text, clip);
}

function guessType(lines, idx) {
  for (let j = idx - 1; j >= Math.max(0, idx - 40); j--) {
    const L = lines[j].trim();
    if (L.startsWith('m_EulerCurves')) return 'euler';
    if (L.startsWith('m_PositionCurves')) return 'position';
    if (L.startsWith('m_ScaleCurves')) return 'scale';
  }
  return 'euler';
}

function parseVec(s) {
  // {x: 0, y: 0, z: 0.616}
  const m = s.match(/x:\s*([^,}]+).*y:\s*([^,}]+).*z:\s*([^,}]+)/);
  if (!m) return { x: 0, y: 0, z: 0 };
  return { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) };
}

function secondPassTypes(text, clip) {
  // Rebuild with proper section awareness
  const lines = text.split(/\r?\n/);
  let section = 'euler';
  const curves = [];
  let cur = null;
  const flush = () => {
    if (cur && cur.keys.length) curves.push(cur);
    cur = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('m_EulerCurves')) { flush(); section = 'euler'; continue; }
    if (line.startsWith('m_PositionCurves')) { flush(); section = 'position'; continue; }
    if (line.startsWith('m_ScaleCurves')) { flush(); section = 'scale'; continue; }
    if (line.startsWith('m_FloatCurves') || line.startsWith('m_EditorCurves') || line.startsWith('m_RotationCurves')) {
      flush(); section = 'skip'; continue;
    }
    if (section === 'skip') continue;

    if (line.startsWith('- curve:') || (line === 'curve:' && lines[i].includes('curve'))) {
      flush();
      cur = { path: '', type: section, keys: [] };
      continue;
    }
    if (line.startsWith('path:') && cur) {
      cur.path = line.slice(5).trim();
      continue;
    }
    if (line.startsWith('time:') && cur) {
      const t = parseFloat(line.slice(5).trim());
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const L = lines[j].trim();
        if (L.startsWith('value:')) {
          const v = parseVec(L.slice(6).trim());
          cur.keys.push({ t, x: v.x, y: v.y, z: v.z });
          break;
        }
        if (L.startsWith('time:')) break;
      }
    }
  }
  flush();

  let length = 0;
  for (const c of curves) {
    if (!c.path || c.path.match(/^\d+$/)) continue;
    for (const k of c.keys) if (k.t > length) length = k.t;
  }

  return {
    name: clip.name,
    length: length || 1,
    curves: curves.filter((c) => c.path && !/^\d+$/.test(c.path) && c.keys.length > 1),
  };
}

export function sampleCurve(keys, t) {
  if (!keys.length) return { x: 0, y: 0, z: 0 };
  if (t <= keys[0].t) return { x: keys[0].x, y: keys[0].y, z: keys[0].z };
  if (t >= keys[keys.length - 1].t) {
    const k = keys[keys.length - 1];
    return { x: k.x, y: k.y, z: k.z };
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = (t - a.t) / (b.t - a.t || 1);
      return {
        x: a.x + (b.x - a.x) * u,
        y: a.y + (b.y - a.y) * u,
        z: a.z + (b.z - a.z) * u,
      };
    }
  }
  const k = keys[keys.length - 1];
  return { x: k.x, y: k.y, z: k.z };
}
