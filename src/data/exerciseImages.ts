/** 3D-Render-Bilder der Standardübungen (erzeugt mit Higgsfield / GPT Image), als WebP gebündelt */
const files = import.meta.glob('../assets/exercises/*.webp', { eager: true, import: 'default' }) as Record<string, string>;

const byId: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const id = path.split('/').pop()!.replace('.webp', '');
  byId[id] = url;
}

/** Übungen ohne eigenes Rendering, die das Bild einer gleichen Bewegung nutzen */
const ALIAS: Record<string, string> = { 'lat-pulldown-bar': 'lat-pulldown' };

export function exerciseImage(id: string | undefined): string | undefined {
  return id ? byId[id] ?? (ALIAS[id] ? byId[ALIAS[id]] : undefined) : undefined;
}

/** Hintergrundfarbe der Renderings, damit Kacheln nahtlos wirken */
export const IMAGE_BG = '#262628';
