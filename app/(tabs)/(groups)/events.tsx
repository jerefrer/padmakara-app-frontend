// Re-export the public events list screen under the (groups) stack
// so navigating to "Teachings & Talks" stays within the home tab.
// The _events directory uses underscore prefix to exclude it from
// Expo Router's file-based routing (prevents URL collision on web).
export { default } from '../_events/index';
