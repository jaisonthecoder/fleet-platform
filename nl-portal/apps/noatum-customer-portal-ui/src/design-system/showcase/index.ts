/**
 * The showcase's public surface.
 *
 * Everything else under showcase/ is private to the design system. The app
 * references this path and nothing deeper, so removing the design system means
 * deleting this folder and the one route that imports from here.
 */
export { Gallery } from './Gallery';
