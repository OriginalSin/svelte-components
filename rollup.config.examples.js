import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default [
  {
	input: 'examples/Pagination/main.js',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'app',
		file: 'examples/Pagination/bundle.js'
	},
	plugins: [
		svelte({
			// opt in to v3 behaviour today
			skipIntroByDefault: true,
			nestedTransitions: true,

			// enable run-time checks when not in production
			dev: !production,
			// we'll extract any component CSS out into
			// a separate file — better for performance
			css: css => {
				css.write('examples/Pagination/bundle.css');
			}
		}),

		// If you have external dependencies installed from
		// npm, you'll most likely need these plugins. In
		// some cases you'll need additional configuration —
		// consult the documentation for details:
		// https://github.com/rollup/rollup-plugin-commonjs
		resolve(),
		commonjs(),

		// If we're building for production (npm run build
		// instead of npm run dev), minify
		production && terser()
	]
  },
  {
	  
	input: 'examples/DateCalendar/main.js',
    output: {
 		sourcemap: true,
		format: 'iife',
		name: 'DateCalendar',
		file: 'examples/DateCalendar/bundle.js'
    },
    plugins: [
		svelte({
			skipIntroByDefault: true,
			nestedTransitions: true,
			dev: !production,
			css: css => {
				css.write('examples/DateCalendar/bundle.css');
			}
		}),
		resolve(),
		commonjs(),
		production && terser()
    ]
  }
]
