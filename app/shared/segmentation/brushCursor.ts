// Brush-cursor geometry for the mask editor (M-2.4 refinement, CL-0035):
// the circle outline drawn at the mouse must have exactly the brush's
// diameter ON THE PHOTO, so it scales with zoom (it grows and shrinks with
// the picture, not the screen). Pure arithmetic, checked in unit tests;
// the overlay that uses it is DOM-only and never touches the mask or any
// saved file.

/** The brush ring's on-screen diameter: brush diameter in photo pixels × zoom. */
export function brushCursorDiameterPx(brushSizePhotoPx: number, zoom: number): number {
  return brushSizePhotoPx * zoom;
}

/**
 * The feather ring's on-screen diameter: where the soft edge actually ends.
 * featherMask runs two box-blur passes of the chosen radius, so a hard edge
 * spreads outward by up to 2× that radius on each side.
 */
export function featherCursorDiameterPx(
  brushSizePhotoPx: number,
  featherRadiusPhotoPx: number,
  zoom: number
): number {
  return (brushSizePhotoPx + 4 * featherRadiusPhotoPx) * zoom;
}
