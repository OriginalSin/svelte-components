(function () {
	'use strict';

	function noop() {}

	function assign(tar, src) {
		for (var k in src) tar[k] = src[k];
		return tar;
	}

	function assignTrue(tar, src) {
		for (var k in src) tar[k] = 1;
		return tar;
	}

	function callAfter(fn, i) {
		if (i === 0) fn();
		return () => {
			if (!--i) fn();
		};
	}

	function addLoc(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		fn();
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor);
	}

	function detachNode(node) {
		node.parentNode.removeChild(node);
	}

	function reinsertChildren(parent, target) {
		while (parent.firstChild) target.appendChild(parent.firstChild);
	}

	function destroyEach(iterations, detach) {
		for (var i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detach);
		}
	}

	function createFragment() {
		return document.createDocumentFragment();
	}

	function createElement(name) {
		return document.createElement(name);
	}

	function createText(data) {
		return document.createTextNode(data);
	}

	function addListener(node, event, handler) {
		node.addEventListener(event, handler, false);
	}

	function removeListener(node, event, handler) {
		node.removeEventListener(event, handler, false);
	}

	function setData(text, data) {
		text.data = '' + data;
	}

	function blankObject() {
		return Object.create(null);
	}

	function destroy(detach) {
		this.destroy = noop;
		this.fire('destroy');
		this.set = noop;

		this._fragment.d(detach !== false);
		this._fragment = null;
		this._state = {};
	}

	function destroyDev(detach) {
		destroy.call(this, detach);
		this.destroy = function() {
			console.warn('Component was already destroyed');
		};
	}

	function _differs(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function fire(eventName, data) {
		var handlers =
			eventName in this._handlers && this._handlers[eventName].slice();
		if (!handlers) return;

		for (var i = 0; i < handlers.length; i += 1) {
			var handler = handlers[i];

			if (!handler.__calling) {
				try {
					handler.__calling = true;
					handler.call(this, data);
				} finally {
					handler.__calling = false;
				}
			}
		}
	}

	function flush(component) {
		component._lock = true;
		callAll(component._beforecreate);
		callAll(component._oncreate);
		callAll(component._aftercreate);
		component._lock = false;
	}

	function get() {
		return this._state;
	}

	function init(component, options) {
		component._handlers = blankObject();
		component._slots = blankObject();
		component._bind = options._bind;
		component._staged = {};

		component.options = options;
		component.root = options.root || component;
		component.store = options.store || component.root.store;

		if (!options.root) {
			component._beforecreate = [];
			component._oncreate = [];
			component._aftercreate = [];
		}
	}

	function on(eventName, handler) {
		var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
		handlers.push(handler);

		return {
			cancel: function() {
				var index = handlers.indexOf(handler);
				if (~index) handlers.splice(index, 1);
			}
		};
	}

	function set(newState) {
		this._set(assign({}, newState));
		if (this.root._lock) return;
		flush(this.root);
	}

	function _set(newState) {
		var oldState = this._state,
			changed = {},
			dirty = false;

		newState = assign(this._staged, newState);
		this._staged = {};

		for (var key in newState) {
			if (this._differs(newState[key], oldState[key])) changed[key] = dirty = true;
		}
		if (!dirty) return;

		this._state = assign(assign({}, oldState), newState);
		this._recompute(changed, this._state);
		if (this._bind) this._bind(changed, this._state);

		if (this._fragment) {
			this.fire("state", { changed: changed, current: this._state, previous: oldState });
			this._fragment.p(changed, this._state);
			this.fire("update", { changed: changed, current: this._state, previous: oldState });
		}
	}

	function _stage(newState) {
		assign(this._staged, newState);
	}

	function setDev(newState) {
		if (typeof newState !== 'object') {
			throw new Error(
				this._debugName + '.set was called without an object of data key-values to update.'
			);
		}

		this._checkReadOnly(newState);
		set.call(this, newState);
	}

	function callAll(fns) {
		while (fns && fns.length) fns.shift()();
	}

	function _mount(target, anchor) {
		this._fragment[this._fragment.i ? 'i' : 'm'](target, anchor || null);
	}

	var protoDev = {
		destroy: destroyDev,
		get,
		fire,
		on,
		set: setDev,
		_recompute: noop,
		_set,
		_stage,
		_mount,
		_differs
	};

	function no() {
	  return false
	}

	function range(len) {
	  return Array.apply(null, Array(len)).map((_, i) => i)
	}

	/**
	 * Convert the passed value to array.
	 * value == null -> []
	 * value == Array -> value
	 * otherwise -> [value]
	 */
	function arrayfy(value) {
	  // prettier-ignore
	  return value == null
	    ? []
	    : Array.isArray(value)
	      ? value
	      : [value]
	}

	function accumlateWhile(fn, condition) {
	  const res = [];
	  let i = 0;
	  let current;
	  while (condition(current, i)) {
	    current = fn(current, i);
	    res.push(current);
	    i++;
	  }
	  return res
	}

	function format(str, ...values) {
	  const placeholderRE = /\{(\d+)\}/g;
	  const escapedRE = /\\\{(\d+)\\\}/g;

	  return str
	    .replace(placeholderRE, (_, index) => {
	      const i = Number(index);
	      const value = values[i] || '';
	      return value
	    })
	    .replace(escapedRE, (_, index) => {
	      return '{' + index + '}'
	    })
	}

	const WEEK_DAYS_NUM = 7;
	const SUNDAY = 0;

	/**
	 * Meant to be passed to component setup option.
	 */
	function setupCalendar(Ctor) {
	  Ctor.setLocale = function setLocale(locale) {
	    Ctor.locale = locale;
	  };
	}

	function getDateCalendar(year, month) {
	  const target = new Date(year, month, 1);
	  const offsetOfFirstDate = SUNDAY - getWeekDay(target);

	  return accumlateWhile(
	    (prev, i) => {
	      const weekOffset = WEEK_DAYS_NUM * i;
	      return range(WEEK_DAYS_NUM).map(dayOffset => {
	        const res = new Date(
	          year,
	          month,
	          offsetOfFirstDate + weekOffset + dayOffset + 1
	        );

	        return equalsMonth(res, year, month) ? res : undefined
	      })
	    },
	    prev => {
	      if (!prev) return true

	      const last = prev[WEEK_DAYS_NUM - 1];
	      if (!last) return false

	      const next = new Date(getYear(last), getMonth(last), getDate(last) + 1);
	      return equalsMonth(next, year, month)
	    }
	  )
	}

	function equalsMonth(date, year, month) {
	  return getYear(date) === year && getMonth(date) === month
	}

	function equalsDate(a, b) {
	  return compareDateAsc(a, b) === 0
	}

	function compareDateAsc(a, b) {
	  return compareAscSeed(a, b, [getYear, getMonth, getDate])
	}

	function compareAscSeed(a, b, getters) {
	  if (getters.length === 0) {
	    return 0
	  }

	  const [getter, ...tail] = getters;
	  const res = compareAsc(getter(a), getter(b));

	  if (res === 0) {
	    return compareAscSeed(a, b, tail)
	  } else {
	    return res
	  }
	}

	function compareAsc(a, b) {
	  if (a < b) {
	    return -1
	  } else if (a > b) {
	    return 1
	  } else {
	    return 0
	  }
	}

	/**
	 * Low level helpers to get date elements
	 */
	function getYear(d) {
	  return d.getFullYear()
	}

	function getMonth(d) {
	  return d.getMonth()
	}

	function getDate(d) {
	  return d.getDate()
	}

	function getWeekDay(d) {
	  return d.getDay()
	}

	/* src\DateCalendar\CellButton.html generated by Svelte v2.13.4 */

	function stateClass(selected, highlighted) {
	  const res = [];

	  if (selected) {
	    res.push('selected');
	  }

	  if (highlighted) {
	    res.push('highlighted');
	  }

	  return res.join(' ')
	}



	const file = "src\\DateCalendar\\CellButton.html";

	function create_main_fragment(component, ctx) {
		var button, slot_content_default = component._slotted.default, button_class_value, current;

		function click_handler(event) {
			component.fire('click', event);
		}

		function mouseenter_handler(event) {
			component.fire('mouseenter', event);
		}

		return {
			c: function create() {
				button = createElement("button");
				addListener(button, "click", click_handler);
				addListener(button, "mouseenter", mouseenter_handler);
				button.type = "button";
				button.className = button_class_value = "calendar-cell-button " + stateClass(ctx.selected, ctx.highlighted) + " svelte-qzvb2b";
				addLoc(button, file, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, button, anchor);

				if (slot_content_default) {
					append(button, slot_content_default);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if ((changed.selected || changed.highlighted) && button_class_value !== (button_class_value = "calendar-cell-button " + stateClass(ctx.selected, ctx.highlighted) + " svelte-qzvb2b")) {
					button.className = button_class_value;
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: run,

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(button);
				}

				if (slot_content_default) {
					reinsertChildren(button, slot_content_default);
				}

				removeListener(button, "click", click_handler);
				removeListener(button, "mouseenter", mouseenter_handler);
			}
		};
	}

	function CellButton(options) {
		this._debugName = '<CellButton>';
		if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
		init(this, options);
		this._state = assign({}, options.data);
		if (!('selected' in this._state)) console.warn("<CellButton> was created without expected data property 'selected'");
		if (!('highlighted' in this._state)) console.warn("<CellButton> was created without expected data property 'highlighted'");
		this._intro = !!options.intro;

		this._slotted = options.slots || {};

		this._fragment = create_main_fragment(this, this._state);

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);
		}

		this._intro = true;
	}

	assign(CellButton.prototype, protoDev);

	CellButton.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	/* src\DateCalendar\CalendarHeader.html generated by Svelte v2.13.4 */



	const file$1 = "src\\DateCalendar\\CalendarHeader.html";

	function create_main_fragment$1(component, ctx) {
		var p, text, current;

		var if_block = (ctx.year != null) && create_if_block(component, ctx);

		var if_block_1 = (ctx.month != null) && create_if_block_1(component, ctx);

		return {
			c: function create() {
				p = createElement("p");
				if (if_block) if_block.c();
				text = createText(" ");
				if (if_block_1) if_block_1.c();
				p.className = "calendar-header svelte-1jc1x0b";
				addLoc(p, file$1, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, p, anchor);
				if (if_block) if_block.m(p, null);
				append(p, text);
				if (if_block_1) if_block_1.m(p, null);
				current = true;
			},

			p: function update(changed, ctx) {
				if (ctx.year != null) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block(component, ctx);
						if_block.c();
						if_block.m(p, text);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if (ctx.month != null) {
					if (if_block_1) {
						if_block_1.p(changed, ctx);
					} else {
						if_block_1 = create_if_block_1(component, ctx);
						if_block_1.c();
						if_block_1.m(p, null);
					}
				} else if (if_block_1) {
					if_block_1.d(1);
					if_block_1 = null;
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: run,

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(p);
				}

				if (if_block) if_block.d();
				if (if_block_1) if_block_1.d();
			}
		};
	}

	// (2:2) {#if year != null }
	function create_if_block(component, ctx) {
		var span, text_value = format(ctx.locale.year, ctx.year), text;

		return {
			c: function create() {
				span = createElement("span");
				text = createText(text_value);
				span.className = "calendar-year";
				addLoc(span, file$1, 2, 2, 54);
			},

			m: function mount(target, anchor) {
				insert(target, span, anchor);
				append(span, text);
			},

			p: function update(changed, ctx) {
				if ((changed.locale || changed.year) && text_value !== (text_value = format(ctx.locale.year, ctx.year))) {
					setData(text, text_value);
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(span);
				}
			}
		};
	}

	// (6:8) {#if month != null }
	function create_if_block_1(component, ctx) {
		var span, text_value = format(ctx.locale.months[ctx.month]), text;

		return {
			c: function create() {
				span = createElement("span");
				text = createText(text_value);
				span.className = "calendar-month";
				addLoc(span, file$1, 6, 2, 162);
			},

			m: function mount(target, anchor) {
				insert(target, span, anchor);
				append(span, text);
			},

			p: function update(changed, ctx) {
				if ((changed.locale || changed.month) && text_value !== (text_value = format(ctx.locale.months[ctx.month]))) {
					setData(text, text_value);
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(span);
				}
			}
		};
	}

	function CalendarHeader(options) {
		this._debugName = '<CalendarHeader>';
		if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
		init(this, options);
		this._state = assign({}, options.data);
		if (!('year' in this._state)) console.warn("<CalendarHeader> was created without expected data property 'year'");
		if (!('locale' in this._state)) console.warn("<CalendarHeader> was created without expected data property 'locale'");
		if (!('month' in this._state)) console.warn("<CalendarHeader> was created without expected data property 'month'");
		this._intro = !!options.intro;

		this._fragment = create_main_fragment$1(this, this._state);

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);
		}

		this._intro = true;
	}

	assign(CalendarHeader.prototype, protoDev);

	CalendarHeader.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	/* src\DateCalendar\DateCalendar.html generated by Svelte v2.13.4 */

	function isSelected(date, selected) {
	  return arrayfy(selected).reduce((acc, s) => {
	    return acc || equalsDate(date, s)
	  }, false)
	}

	function weekClass(week) {
	  if (week === 0) {
	    return 'sunday'
	  }

	  if (week === 6) {
	    return 'saturday'
	  }

	  return ''
	}

	function calendar({ current }) {
	  return getDateCalendar(current.year, current.month)
	}

	function data() {
	  const today = new Date();

	  return {
	    current: {
	      year: today.getFullYear(),
	      month: today.getMonth()
	    },
	    isHighlighted: no
	  }
	}
	var methods = {
	  onClickCell(date) {
	    if (!date) return
	    this.fire('select', date);
	  },

	  onHoverCell(date) {
	    this.fire('hover', date);
	  },

	  onHoverOut() {
	    this.fire('hover', null);
	  }
	};

	function oncreate() {
	  const { locale } = this.get();
	  if (!locale) {
	    this.set({
	      locale: this.constructor.locale
	    });
	  }
	}
	var setup = setupCalendar;

	const file$2 = "src\\DateCalendar\\DateCalendar.html";

	function create_main_fragment$2(component, ctx) {
		var div, current;

		var if_block = (ctx.locale) && create_if_block$1(component, ctx);

		return {
			c: function create() {
				div = createElement("div");
				if (if_block) if_block.c();
				div.className = "date-calendar svelte-10y99q";
				addLoc(div, file$2, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				if (if_block) if_block.m(div, null);
				current = true;
			},

			p: function update(changed, ctx) {
				if (ctx.locale) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block$1(component, ctx);
						if (if_block) if_block.c();
					}

					if_block.i(div, null);
				} else if (if_block) {
					if_block.o(function() {
						if_block.d(1);
						if_block = null;
					});
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				if (if_block) if_block.o(outrocallback);
				else outrocallback();

				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				if (if_block) if_block.d();
			}
		};
	}

	// (8:8) {#each locale.weekDays as weekDay, i}
	function create_each_block(component, ctx) {
		var th, text_value = format(ctx.weekDay), text;

		return {
			c: function create() {
				th = createElement("th");
				text = createText(text_value);
				th.scope = "col";
				th.className = "date-calendar-cell heading " + weekClass(ctx.i) + " svelte-10y99q";
				addLoc(th, file$2, 8, 8, 258);
			},

			m: function mount(target, anchor) {
				insert(target, th, anchor);
				append(th, text);
			},

			p: function update(changed, ctx) {
				if ((changed.locale) && text_value !== (text_value = format(ctx.weekDay))) {
					setData(text, text_value);
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(th);
				}
			}
		};
	}

	// (17:6) {#each calendar as row}
	function create_each_block_1(component, ctx) {
		var tr, current;

		var each_value_2 = ctx.row;

		var each_blocks = [];

		for (var i = 0; i < each_value_2.length; i += 1) {
			each_blocks[i] = create_each_block_2(component, get_each_context_1(ctx, each_value_2, i));
		}

		function outroBlock(i, detach, fn) {
			if (each_blocks[i]) {
				each_blocks[i].o(() => {
					if (detach) {
						each_blocks[i].d(detach);
						each_blocks[i] = null;
					}
					if (fn) fn();
				});
			}
		}

		return {
			c: function create() {
				tr = createElement("tr");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				addLoc(tr, file$2, 17, 6, 499);
			},

			m: function mount(target, anchor) {
				insert(target, tr, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].i(tr, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (changed.getClass || changed.calendar || changed.selected || changed.isHighlighted) {
					each_value_2 = ctx.row;

					for (var i = 0; i < each_value_2.length; i += 1) {
						const child_ctx = get_each_context_1(ctx, each_value_2, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_2(component, child_ctx);
							each_blocks[i].c();
						}
						each_blocks[i].i(tr, null);
					}
					for (; i < each_blocks.length; i += 1) outroBlock(i, 1);
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				each_blocks = each_blocks.filter(Boolean);
				const countdown = callAfter(outrocallback, each_blocks.length);
				for (let i = 0; i < each_blocks.length; i += 1) outroBlock(i, 0, countdown);

				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(tr);
				}

				destroyEach(each_blocks, detach);
			}
		};
	}

	// (19:8) {#each row as cell, i}
	function create_each_block_2(component, ctx) {
		var td, td_class_value, current;

		var if_block = (ctx.cell) && create_if_block_1$1(component, ctx);

		return {
			c: function create() {
				td = createElement("td");
				if (if_block) if_block.c();
				td.className = td_class_value = "date-calendar-cell " + weekClass(ctx.i) + " " + (ctx.getClass && ctx.cell ? ctx.getClass(ctx.cell) : '') + " svelte-10y99q";
				addLoc(td, file$2, 19, 8, 545);
			},

			m: function mount(target, anchor) {
				insert(target, td, anchor);
				if (if_block) if_block.m(td, null);
				current = true;
			},

			p: function update(changed, ctx) {
				if (ctx.cell) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block_1$1(component, ctx);
						if (if_block) if_block.c();
					}

					if_block.i(td, null);
				} else if (if_block) {
					if_block.o(function() {
						if_block.d(1);
						if_block = null;
					});
				}

				if ((!current || changed.getClass || changed.calendar) && td_class_value !== (td_class_value = "date-calendar-cell " + weekClass(ctx.i) + " " + (ctx.getClass && ctx.cell ? ctx.getClass(ctx.cell) : '') + " svelte-10y99q")) {
					td.className = td_class_value;
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				if (if_block) if_block.o(outrocallback);
				else outrocallback();

				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(td);
				}

				if (if_block) if_block.d();
			}
		};
	}

	// (21:10) {#if cell}
	function create_if_block_1$1(component, ctx) {
		var text, text_1_value = ctx.cell.getDate(), text_1, text_2, current;

		var cellbutton_initial_data = {
		 	selected: isSelected(ctx.cell, ctx.selected),
		 	highlighted: ctx.isHighlighted(ctx.cell, ctx.selected)
		 };
		var cellbutton = new CellButton({
			root: component.root,
			store: component.store,
			slots: { default: createFragment() },
			data: cellbutton_initial_data
		});

		cellbutton.on("click", function(event) {
			component.onClickCell(ctx.cell);
		});
		cellbutton.on("mouseenter", function(event) {
			component.onHoverCell(ctx.cell);
		});

		return {
			c: function create() {
				text = createText("\r\n            ");
				text_1 = createText(text_1_value);
				text_2 = createText("\r\n          ");
				cellbutton._fragment.c();
			},

			m: function mount(target, anchor) {
				append(cellbutton._slotted.default, text);
				append(cellbutton._slotted.default, text_1);
				append(cellbutton._slotted.default, text_2);
				cellbutton._mount(target, anchor);
				current = true;
			},

			p: function update(changed, _ctx) {
				ctx = _ctx;
				if ((!current || changed.calendar) && text_1_value !== (text_1_value = ctx.cell.getDate())) {
					setData(text_1, text_1_value);
				}

				var cellbutton_changes = {};
				if (changed.calendar || changed.selected) cellbutton_changes.selected = isSelected(ctx.cell, ctx.selected);
				if (changed.isHighlighted || changed.calendar || changed.selected) cellbutton_changes.highlighted = ctx.isHighlighted(ctx.cell, ctx.selected);
				cellbutton._set(cellbutton_changes);
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				if (cellbutton) cellbutton._fragment.o(outrocallback);
				current = false;
			},

			d: function destroy$$1(detach) {
				cellbutton.destroy(detach);
			}
		};
	}

	// (2:2) {#if locale}
	function create_if_block$1(component, ctx) {
		var text, table, thead, tr, text_3, tbody, current;

		var calendarheader_initial_data = {
		 	locale: ctx.locale,
		 	year: ctx.current.year,
		 	month: ctx.current.month
		 };
		var calendarheader = new CalendarHeader({
			root: component.root,
			store: component.store,
			data: calendarheader_initial_data
		});

		var each_value = ctx.locale.weekDays;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(component, get_each_context(ctx, each_value, i));
		}

		var each_value_1 = ctx.calendar;

		var each_1_blocks = [];

		for (var i = 0; i < each_value_1.length; i += 1) {
			each_1_blocks[i] = create_each_block_1(component, get_each_1_context(ctx, each_value_1, i));
		}

		function outroBlock(i, detach, fn) {
			if (each_1_blocks[i]) {
				each_1_blocks[i].o(() => {
					if (detach) {
						each_1_blocks[i].d(detach);
						each_1_blocks[i] = null;
					}
					if (fn) fn();
				});
			}
		}

		function mouseleave_handler(event) {
			component.onHoverOut();
		}

		return {
			c: function create() {
				calendarheader._fragment.c();
				text = createText("\r\n\r\n  ");
				table = createElement("table");
				thead = createElement("thead");
				tr = createElement("tr");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				text_3 = createText("\r\n\r\n    ");
				tbody = createElement("tbody");

				for (var i = 0; i < each_1_blocks.length; i += 1) {
					each_1_blocks[i].c();
				}
				addLoc(tr, file$2, 6, 6, 197);
				addLoc(thead, file$2, 5, 4, 182);
				addListener(tbody, "mouseleave", mouseleave_handler);
				addLoc(tbody, file$2, 15, 4, 424);
				table.className = "date-calendar-table svelte-10y99q";
				addLoc(table, file$2, 4, 2, 141);
			},

			m: function mount(target, anchor) {
				calendarheader._mount(target, anchor);
				insert(target, text, anchor);
				insert(target, table, anchor);
				append(table, thead);
				append(thead, tr);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(tr, null);
				}

				append(table, text_3);
				append(table, tbody);

				for (var i = 0; i < each_1_blocks.length; i += 1) {
					each_1_blocks[i].i(tbody, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				var calendarheader_changes = {};
				if (changed.locale) calendarheader_changes.locale = ctx.locale;
				if (changed.current) calendarheader_changes.year = ctx.current.year;
				if (changed.current) calendarheader_changes.month = ctx.current.month;
				calendarheader._set(calendarheader_changes);

				if (changed.locale) {
					each_value = ctx.locale.weekDays;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(tr, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}

				if (changed.calendar || changed.getClass || changed.selected || changed.isHighlighted) {
					each_value_1 = ctx.calendar;

					for (var i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_1_context(ctx, each_value_1, i);

						if (each_1_blocks[i]) {
							each_1_blocks[i].p(changed, child_ctx);
						} else {
							each_1_blocks[i] = create_each_block_1(component, child_ctx);
							each_1_blocks[i].c();
						}
						each_1_blocks[i].i(tbody, null);
					}
					for (; i < each_1_blocks.length; i += 1) outroBlock(i, 1);
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				outrocallback = callAfter(outrocallback, 2);

				if (calendarheader) calendarheader._fragment.o(outrocallback);

				each_1_blocks = each_1_blocks.filter(Boolean);
				const countdown = callAfter(outrocallback, each_1_blocks.length);
				for (let i = 0; i < each_1_blocks.length; i += 1) outroBlock(i, 0, countdown);

				current = false;
			},

			d: function destroy$$1(detach) {
				calendarheader.destroy(detach);
				if (detach) {
					detachNode(text);
					detachNode(table);
				}

				destroyEach(each_blocks, detach);

				destroyEach(each_1_blocks, detach);

				removeListener(tbody, "mouseleave", mouseleave_handler);
			}
		};
	}

	function get_each_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.weekDay = list[i];
		child_ctx.each_value = list;
		child_ctx.i = i;
		return child_ctx;
	}

	function get_each_1_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.row = list[i];
		child_ctx.each_value_1 = list;
		child_ctx.row_index = i;
		return child_ctx;
	}

	function get_each_context_1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.cell = list[i];
		child_ctx.each_value_2 = list;
		child_ctx.i = i;
		return child_ctx;
	}

	function DateCalendar(options) {
		this._debugName = '<DateCalendar>';
		if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
		init(this, options);
		this._state = assign(data(), options.data);
		this._recompute({ current: 1 }, this._state);
		if (!('current' in this._state)) console.warn("<DateCalendar> was created without expected data property 'current'");
		if (!('locale' in this._state)) console.warn("<DateCalendar> was created without expected data property 'locale'");

		if (!('getClass' in this._state)) console.warn("<DateCalendar> was created without expected data property 'getClass'");
		if (!('selected' in this._state)) console.warn("<DateCalendar> was created without expected data property 'selected'");
		if (!('isHighlighted' in this._state)) console.warn("<DateCalendar> was created without expected data property 'isHighlighted'");
		this._intro = !!options.intro;

		this._fragment = create_main_fragment$2(this, this._state);

		this.root._oncreate.push(() => {
			oncreate.call(this);
			this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
		});

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(DateCalendar.prototype, protoDev);
	assign(DateCalendar.prototype, methods);

	DateCalendar.prototype._checkReadOnly = function _checkReadOnly(newState) {
		if ('calendar' in newState && !this._updatingReadonlyProperty) throw new Error("<DateCalendar>: Cannot set read-only property 'calendar'");
	};

	DateCalendar.prototype._recompute = function _recompute(changed, state) {
		if (changed.current) {
			if (this._differs(state.calendar, (state.calendar = calendar(state)))) changed.calendar = true;
		}
	};

	setup(DateCalendar);

	new DateCalendar({
		target: document.getElementById('app'),
		data: {
			total: 16
		}
	});

}());
//# sourceMappingURL=bundle.js.map
