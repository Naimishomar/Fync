// Must run before sharp renders any SVG text: fontconfig reads this on first use.
// Without it the server (no system fonts) draws every glyph as a box.
import { fileURLToPath } from 'url';

process.env.FONTCONFIG_FILE ||= fileURLToPath(new URL('../assets/fonts/fonts.conf', import.meta.url));
