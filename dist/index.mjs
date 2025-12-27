var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/@opentelemetry/context-async-hooks/build/src/AbstractAsyncHooksContextManager.js
var require_AbstractAsyncHooksContextManager = __commonJS({
  "node_modules/@opentelemetry/context-async-hooks/build/src/AbstractAsyncHooksContextManager.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AbstractAsyncHooksContextManager = void 0;
    var events_1 = __require("events");
    var ADD_LISTENER_METHODS = [
      "addListener",
      "on",
      "once",
      "prependListener",
      "prependOnceListener"
    ];
    var AbstractAsyncHooksContextManager = class {
      constructor() {
        this._kOtListeners = /* @__PURE__ */ Symbol("OtListeners");
        this._wrapped = false;
      }
      /**
       * Binds a the certain context or the active one to the target function and then returns the target
       * @param context A context (span) to be bind to target
       * @param target a function or event emitter. When target or one of its callbacks is called,
       *  the provided context will be used as the active context for the duration of the call.
       */
      bind(context8, target) {
        if (target instanceof events_1.EventEmitter) {
          return this._bindEventEmitter(context8, target);
        }
        if (typeof target === "function") {
          return this._bindFunction(context8, target);
        }
        return target;
      }
      _bindFunction(context8, target) {
        const manager = this;
        const contextWrapper = function(...args) {
          return manager.with(context8, () => target.apply(this, args));
        };
        Object.defineProperty(contextWrapper, "length", {
          enumerable: false,
          configurable: true,
          writable: false,
          value: target.length
        });
        return contextWrapper;
      }
      /**
       * By default, EventEmitter call their callback with their context, which we do
       * not want, instead we will bind a specific context to all callbacks that
       * go through it.
       * @param context the context we want to bind
       * @param ee EventEmitter an instance of EventEmitter to patch
       */
      _bindEventEmitter(context8, ee) {
        const map = this._getPatchMap(ee);
        if (map !== void 0)
          return ee;
        this._createPatchMap(ee);
        ADD_LISTENER_METHODS.forEach((methodName) => {
          if (ee[methodName] === void 0)
            return;
          ee[methodName] = this._patchAddListener(ee, ee[methodName], context8);
        });
        if (typeof ee.removeListener === "function") {
          ee.removeListener = this._patchRemoveListener(ee, ee.removeListener);
        }
        if (typeof ee.off === "function") {
          ee.off = this._patchRemoveListener(ee, ee.off);
        }
        if (typeof ee.removeAllListeners === "function") {
          ee.removeAllListeners = this._patchRemoveAllListeners(ee, ee.removeAllListeners);
        }
        return ee;
      }
      /**
       * Patch methods that remove a given listener so that we match the "patched"
       * version of that listener (the one that propagate context).
       * @param ee EventEmitter instance
       * @param original reference to the patched method
       */
      _patchRemoveListener(ee, original) {
        const contextManager = this;
        return function(event, listener) {
          var _a;
          const events = (_a = contextManager._getPatchMap(ee)) === null || _a === void 0 ? void 0 : _a[event];
          if (events === void 0) {
            return original.call(this, event, listener);
          }
          const patchedListener = events.get(listener);
          return original.call(this, event, patchedListener || listener);
        };
      }
      /**
       * Patch methods that remove all listeners so we remove our
       * internal references for a given event.
       * @param ee EventEmitter instance
       * @param original reference to the patched method
       */
      _patchRemoveAllListeners(ee, original) {
        const contextManager = this;
        return function(event) {
          const map = contextManager._getPatchMap(ee);
          if (map !== void 0) {
            if (arguments.length === 0) {
              contextManager._createPatchMap(ee);
            } else if (map[event] !== void 0) {
              delete map[event];
            }
          }
          return original.apply(this, arguments);
        };
      }
      /**
       * Patch methods on an event emitter instance that can add listeners so we
       * can force them to propagate a given context.
       * @param ee EventEmitter instance
       * @param original reference to the patched method
       * @param [context] context to propagate when calling listeners
       */
      _patchAddListener(ee, original, context8) {
        const contextManager = this;
        return function(event, listener) {
          if (contextManager._wrapped) {
            return original.call(this, event, listener);
          }
          let map = contextManager._getPatchMap(ee);
          if (map === void 0) {
            map = contextManager._createPatchMap(ee);
          }
          let listeners = map[event];
          if (listeners === void 0) {
            listeners = /* @__PURE__ */ new WeakMap();
            map[event] = listeners;
          }
          const patchedListener = contextManager.bind(context8, listener);
          listeners.set(listener, patchedListener);
          contextManager._wrapped = true;
          try {
            return original.call(this, event, patchedListener);
          } finally {
            contextManager._wrapped = false;
          }
        };
      }
      _createPatchMap(ee) {
        const map = /* @__PURE__ */ Object.create(null);
        ee[this._kOtListeners] = map;
        return map;
      }
      _getPatchMap(ee) {
        return ee[this._kOtListeners];
      }
    };
    exports.AbstractAsyncHooksContextManager = AbstractAsyncHooksContextManager;
  }
});

// node_modules/@opentelemetry/context-async-hooks/build/src/AsyncHooksContextManager.js
var require_AsyncHooksContextManager = __commonJS({
  "node_modules/@opentelemetry/context-async-hooks/build/src/AsyncHooksContextManager.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AsyncHooksContextManager = void 0;
    var api_1 = __require("@opentelemetry/api");
    var asyncHooks = __require("async_hooks");
    var AbstractAsyncHooksContextManager_1 = require_AbstractAsyncHooksContextManager();
    var AsyncHooksContextManager = class extends AbstractAsyncHooksContextManager_1.AbstractAsyncHooksContextManager {
      constructor() {
        super();
        this._contexts = /* @__PURE__ */ new Map();
        this._stack = [];
        this._asyncHook = asyncHooks.createHook({
          init: this._init.bind(this),
          before: this._before.bind(this),
          after: this._after.bind(this),
          destroy: this._destroy.bind(this),
          promiseResolve: this._destroy.bind(this)
        });
      }
      active() {
        var _a;
        return (_a = this._stack[this._stack.length - 1]) !== null && _a !== void 0 ? _a : api_1.ROOT_CONTEXT;
      }
      with(context8, fn, thisArg, ...args) {
        this._enterContext(context8);
        try {
          return fn.call(thisArg, ...args);
        } finally {
          this._exitContext();
        }
      }
      enable() {
        this._asyncHook.enable();
        return this;
      }
      disable() {
        this._asyncHook.disable();
        this._contexts.clear();
        this._stack = [];
        return this;
      }
      /**
       * Init hook will be called when userland create a async context, setting the
       * context as the current one if it exist.
       * @param uid id of the async context
       * @param type the resource type
       */
      _init(uid, type) {
        if (type === "TIMERWRAP")
          return;
        const context8 = this._stack[this._stack.length - 1];
        if (context8 !== void 0) {
          this._contexts.set(uid, context8);
        }
      }
      /**
       * Destroy hook will be called when a given context is no longer used so we can
       * remove its attached context.
       * @param uid uid of the async context
       */
      _destroy(uid) {
        this._contexts.delete(uid);
      }
      /**
       * Before hook is called just before executing a async context.
       * @param uid uid of the async context
       */
      _before(uid) {
        const context8 = this._contexts.get(uid);
        if (context8 !== void 0) {
          this._enterContext(context8);
        }
      }
      /**
       * After hook is called just after completing the execution of a async context.
       */
      _after() {
        this._exitContext();
      }
      /**
       * Set the given context as active
       */
      _enterContext(context8) {
        this._stack.push(context8);
      }
      /**
       * Remove the context at the root of the stack
       */
      _exitContext() {
        this._stack.pop();
      }
    };
    exports.AsyncHooksContextManager = AsyncHooksContextManager;
  }
});

// node_modules/@opentelemetry/context-async-hooks/build/src/AsyncLocalStorageContextManager.js
var require_AsyncLocalStorageContextManager = __commonJS({
  "node_modules/@opentelemetry/context-async-hooks/build/src/AsyncLocalStorageContextManager.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AsyncLocalStorageContextManager = void 0;
    var api_1 = __require("@opentelemetry/api");
    var async_hooks_1 = __require("async_hooks");
    var AbstractAsyncHooksContextManager_1 = require_AbstractAsyncHooksContextManager();
    var AsyncLocalStorageContextManager = class extends AbstractAsyncHooksContextManager_1.AbstractAsyncHooksContextManager {
      constructor() {
        super();
        this._asyncLocalStorage = new async_hooks_1.AsyncLocalStorage();
      }
      active() {
        var _a;
        return (_a = this._asyncLocalStorage.getStore()) !== null && _a !== void 0 ? _a : api_1.ROOT_CONTEXT;
      }
      with(context8, fn, thisArg, ...args) {
        const cb = thisArg == null ? fn : fn.bind(thisArg);
        return this._asyncLocalStorage.run(context8, cb, ...args);
      }
      enable() {
        return this;
      }
      disable() {
        this._asyncLocalStorage.disable();
        return this;
      }
    };
    exports.AsyncLocalStorageContextManager = AsyncLocalStorageContextManager;
  }
});

// node_modules/@opentelemetry/context-async-hooks/build/src/index.js
var require_src = __commonJS({
  "node_modules/@opentelemetry/context-async-hooks/build/src/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AsyncLocalStorageContextManager = exports.AsyncHooksContextManager = void 0;
    var AsyncHooksContextManager_1 = require_AsyncHooksContextManager();
    Object.defineProperty(exports, "AsyncHooksContextManager", { enumerable: true, get: function() {
      return AsyncHooksContextManager_1.AsyncHooksContextManager;
    } });
    var AsyncLocalStorageContextManager_1 = require_AsyncLocalStorageContextManager();
    Object.defineProperty(exports, "AsyncLocalStorageContextManager", { enumerable: true, get: function() {
      return AsyncLocalStorageContextManager_1.AsyncLocalStorageContextManager;
    } });
  }
});

// node_modules/@opentelemetry/propagator-b3/build/esm/common.js
import { createContextKey } from "@opentelemetry/api";
var B3_DEBUG_FLAG_KEY;
var init_common = __esm({
  "node_modules/@opentelemetry/propagator-b3/build/esm/common.js"() {
    "use strict";
    B3_DEBUG_FLAG_KEY = createContextKey("OpenTelemetry Context Key B3 Debug Flag");
  }
});

// node_modules/@opentelemetry/propagator-b3/build/esm/constants.js
var B3_CONTEXT_HEADER, X_B3_TRACE_ID, X_B3_SPAN_ID, X_B3_SAMPLED, X_B3_PARENT_SPAN_ID, X_B3_FLAGS;
var init_constants = __esm({
  "node_modules/@opentelemetry/propagator-b3/build/esm/constants.js"() {
    "use strict";
    B3_CONTEXT_HEADER = "b3";
    X_B3_TRACE_ID = "x-b3-traceid";
    X_B3_SPAN_ID = "x-b3-spanid";
    X_B3_SAMPLED = "x-b3-sampled";
    X_B3_PARENT_SPAN_ID = "x-b3-parentspanid";
    X_B3_FLAGS = "x-b3-flags";
  }
});

// node_modules/@opentelemetry/propagator-b3/build/esm/B3MultiPropagator.js
import { isSpanContextValid, isValidSpanId, isValidTraceId, trace as trace3, TraceFlags } from "@opentelemetry/api";
import { isTracingSuppressed } from "@opentelemetry/core";
function isValidSampledValue(sampled) {
  return sampled === TraceFlags.SAMPLED || sampled === TraceFlags.NONE;
}
function parseHeader(header) {
  return Array.isArray(header) ? header[0] : header;
}
function getHeaderValue(carrier, getter, key) {
  var header = getter.get(carrier, key);
  return parseHeader(header);
}
function getTraceId(carrier, getter) {
  var traceId = getHeaderValue(carrier, getter, X_B3_TRACE_ID);
  if (typeof traceId === "string") {
    return traceId.padStart(32, "0");
  }
  return "";
}
function getSpanId(carrier, getter) {
  var spanId = getHeaderValue(carrier, getter, X_B3_SPAN_ID);
  if (typeof spanId === "string") {
    return spanId;
  }
  return "";
}
function getDebug(carrier, getter) {
  var debug = getHeaderValue(carrier, getter, X_B3_FLAGS);
  return debug === "1" ? "1" : void 0;
}
function getTraceFlags(carrier, getter) {
  var traceFlags = getHeaderValue(carrier, getter, X_B3_SAMPLED);
  var debug = getDebug(carrier, getter);
  if (debug === "1" || VALID_SAMPLED_VALUES.has(traceFlags)) {
    return TraceFlags.SAMPLED;
  }
  if (traceFlags === void 0 || VALID_UNSAMPLED_VALUES.has(traceFlags)) {
    return TraceFlags.NONE;
  }
  return;
}
var VALID_SAMPLED_VALUES, VALID_UNSAMPLED_VALUES, B3MultiPropagator;
var init_B3MultiPropagator = __esm({
  "node_modules/@opentelemetry/propagator-b3/build/esm/B3MultiPropagator.js"() {
    "use strict";
    init_common();
    init_constants();
    VALID_SAMPLED_VALUES = /* @__PURE__ */ new Set([true, "true", "True", "1", 1]);
    VALID_UNSAMPLED_VALUES = /* @__PURE__ */ new Set([false, "false", "False", "0", 0]);
    B3MultiPropagator = /** @class */
    (function() {
      function B3MultiPropagator2() {
      }
      B3MultiPropagator2.prototype.inject = function(context8, carrier, setter) {
        var spanContext = trace3.getSpanContext(context8);
        if (!spanContext || !isSpanContextValid(spanContext) || isTracingSuppressed(context8))
          return;
        var debug = context8.getValue(B3_DEBUG_FLAG_KEY);
        setter.set(carrier, X_B3_TRACE_ID, spanContext.traceId);
        setter.set(carrier, X_B3_SPAN_ID, spanContext.spanId);
        if (debug === "1") {
          setter.set(carrier, X_B3_FLAGS, debug);
        } else if (spanContext.traceFlags !== void 0) {
          setter.set(carrier, X_B3_SAMPLED, (TraceFlags.SAMPLED & spanContext.traceFlags) === TraceFlags.SAMPLED ? "1" : "0");
        }
      };
      B3MultiPropagator2.prototype.extract = function(context8, carrier, getter) {
        var traceId = getTraceId(carrier, getter);
        var spanId = getSpanId(carrier, getter);
        var traceFlags = getTraceFlags(carrier, getter);
        var debug = getDebug(carrier, getter);
        if (isValidTraceId(traceId) && isValidSpanId(spanId) && isValidSampledValue(traceFlags)) {
          context8 = context8.setValue(B3_DEBUG_FLAG_KEY, debug);
          return trace3.setSpanContext(context8, {
            traceId,
            spanId,
            isRemote: true,
            traceFlags
          });
        }
        return context8;
      };
      B3MultiPropagator2.prototype.fields = function() {
        return [
          X_B3_TRACE_ID,
          X_B3_SPAN_ID,
          X_B3_FLAGS,
          X_B3_SAMPLED,
          X_B3_PARENT_SPAN_ID
        ];
      };
      return B3MultiPropagator2;
    })();
  }
});

// node_modules/@opentelemetry/propagator-b3/build/esm/B3SinglePropagator.js
import { isSpanContextValid as isSpanContextValid2, isValidSpanId as isValidSpanId2, isValidTraceId as isValidTraceId2, trace as trace4, TraceFlags as TraceFlags2 } from "@opentelemetry/api";
import { isTracingSuppressed as isTracingSuppressed2 } from "@opentelemetry/core";
function convertToTraceId128(traceId) {
  return traceId.length === 32 ? traceId : "" + PADDING + traceId;
}
function convertToTraceFlags(samplingState) {
  if (samplingState && SAMPLED_VALUES.has(samplingState)) {
    return TraceFlags2.SAMPLED;
  }
  return TraceFlags2.NONE;
}
var __read2, B3_CONTEXT_REGEX, PADDING, SAMPLED_VALUES, DEBUG_STATE, B3SinglePropagator;
var init_B3SinglePropagator = __esm({
  "node_modules/@opentelemetry/propagator-b3/build/esm/B3SinglePropagator.js"() {
    "use strict";
    init_common();
    init_constants();
    __read2 = function(o, n) {
      var m = typeof Symbol === "function" && o[Symbol.iterator];
      if (!m) return o;
      var i = m.call(o), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m = i["return"])) m.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    B3_CONTEXT_REGEX = /((?:[0-9a-f]{16}){1,2})-([0-9a-f]{16})(?:-([01d](?![0-9a-f])))?(?:-([0-9a-f]{16}))?/;
    PADDING = "0".repeat(16);
    SAMPLED_VALUES = /* @__PURE__ */ new Set(["d", "1"]);
    DEBUG_STATE = "d";
    B3SinglePropagator = /** @class */
    (function() {
      function B3SinglePropagator2() {
      }
      B3SinglePropagator2.prototype.inject = function(context8, carrier, setter) {
        var spanContext = trace4.getSpanContext(context8);
        if (!spanContext || !isSpanContextValid2(spanContext) || isTracingSuppressed2(context8))
          return;
        var samplingState = context8.getValue(B3_DEBUG_FLAG_KEY) || spanContext.traceFlags & 1;
        var value = spanContext.traceId + "-" + spanContext.spanId + "-" + samplingState;
        setter.set(carrier, B3_CONTEXT_HEADER, value);
      };
      B3SinglePropagator2.prototype.extract = function(context8, carrier, getter) {
        var header = getter.get(carrier, B3_CONTEXT_HEADER);
        var b3Context = Array.isArray(header) ? header[0] : header;
        if (typeof b3Context !== "string")
          return context8;
        var match = b3Context.match(B3_CONTEXT_REGEX);
        if (!match)
          return context8;
        var _a = __read2(match, 4), extractedTraceId = _a[1], spanId = _a[2], samplingState = _a[3];
        var traceId = convertToTraceId128(extractedTraceId);
        if (!isValidTraceId2(traceId) || !isValidSpanId2(spanId))
          return context8;
        var traceFlags = convertToTraceFlags(samplingState);
        if (samplingState === DEBUG_STATE) {
          context8 = context8.setValue(B3_DEBUG_FLAG_KEY, samplingState);
        }
        return trace4.setSpanContext(context8, {
          traceId,
          spanId,
          isRemote: true,
          traceFlags
        });
      };
      B3SinglePropagator2.prototype.fields = function() {
        return [B3_CONTEXT_HEADER];
      };
      return B3SinglePropagator2;
    })();
  }
});

// node_modules/@opentelemetry/propagator-b3/build/esm/types.js
var B3InjectEncoding;
var init_types = __esm({
  "node_modules/@opentelemetry/propagator-b3/build/esm/types.js"() {
    "use strict";
    (function(B3InjectEncoding2) {
      B3InjectEncoding2[B3InjectEncoding2["SINGLE_HEADER"] = 0] = "SINGLE_HEADER";
      B3InjectEncoding2[B3InjectEncoding2["MULTI_HEADER"] = 1] = "MULTI_HEADER";
    })(B3InjectEncoding || (B3InjectEncoding = {}));
  }
});

// node_modules/@opentelemetry/propagator-b3/build/esm/B3Propagator.js
import { isTracingSuppressed as isTracingSuppressed3 } from "@opentelemetry/core";
var B3Propagator;
var init_B3Propagator = __esm({
  "node_modules/@opentelemetry/propagator-b3/build/esm/B3Propagator.js"() {
    "use strict";
    init_B3MultiPropagator();
    init_B3SinglePropagator();
    init_constants();
    init_types();
    B3Propagator = /** @class */
    (function() {
      function B3Propagator2(config) {
        if (config === void 0) {
          config = {};
        }
        this._b3MultiPropagator = new B3MultiPropagator();
        this._b3SinglePropagator = new B3SinglePropagator();
        if (config.injectEncoding === B3InjectEncoding.MULTI_HEADER) {
          this._inject = this._b3MultiPropagator.inject;
          this._fields = this._b3MultiPropagator.fields();
        } else {
          this._inject = this._b3SinglePropagator.inject;
          this._fields = this._b3SinglePropagator.fields();
        }
      }
      B3Propagator2.prototype.inject = function(context8, carrier, setter) {
        if (isTracingSuppressed3(context8)) {
          return;
        }
        this._inject(context8, carrier, setter);
      };
      B3Propagator2.prototype.extract = function(context8, carrier, getter) {
        var header = getter.get(carrier, B3_CONTEXT_HEADER);
        var b3Context = Array.isArray(header) ? header[0] : header;
        if (b3Context) {
          return this._b3SinglePropagator.extract(context8, carrier, getter);
        } else {
          return this._b3MultiPropagator.extract(context8, carrier, getter);
        }
      };
      B3Propagator2.prototype.fields = function() {
        return this._fields;
      };
      return B3Propagator2;
    })();
  }
});

// node_modules/@opentelemetry/propagator-b3/build/esm/index.js
var esm_exports = {};
__export(esm_exports, {
  B3InjectEncoding: () => B3InjectEncoding,
  B3Propagator: () => B3Propagator,
  B3_CONTEXT_HEADER: () => B3_CONTEXT_HEADER,
  X_B3_FLAGS: () => X_B3_FLAGS,
  X_B3_PARENT_SPAN_ID: () => X_B3_PARENT_SPAN_ID,
  X_B3_SAMPLED: () => X_B3_SAMPLED,
  X_B3_SPAN_ID: () => X_B3_SPAN_ID,
  X_B3_TRACE_ID: () => X_B3_TRACE_ID
});
var init_esm = __esm({
  "node_modules/@opentelemetry/propagator-b3/build/esm/index.js"() {
    "use strict";
    init_B3Propagator();
    init_constants();
    init_types();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/enums.js
var ExceptionEventName;
var init_enums = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/enums.js"() {
    "use strict";
    ExceptionEventName = "exception";
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/Span.js
import { diag as diag2, SpanStatusCode as SpanStatusCode2 } from "@opentelemetry/api";
import { addHrTimes, millisToHrTime, getTimeOrigin, hrTime, hrTimeDuration, isAttributeValue, isTimeInput, isTimeInputHrTime, otperformance, sanitizeAttributes } from "@opentelemetry/core";
import { SEMATTRS_EXCEPTION_MESSAGE, SEMATTRS_EXCEPTION_STACKTRACE, SEMATTRS_EXCEPTION_TYPE } from "@opentelemetry/semantic-conventions";
var __assign2, __values, __read3, __spreadArray, Span2;
var init_Span = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/Span.js"() {
    "use strict";
    init_enums();
    __assign2 = function() {
      __assign2 = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
        }
        return t;
      };
      return __assign2.apply(this, arguments);
    };
    __values = function(o) {
      var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
      if (m) return m.call(o);
      if (o && typeof o.length === "number") return {
        next: function() {
          if (o && i >= o.length) o = void 0;
          return { value: o && o[i++], done: !o };
        }
      };
      throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    __read3 = function(o, n) {
      var m = typeof Symbol === "function" && o[Symbol.iterator];
      if (!m) return o;
      var i = m.call(o), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m = i["return"])) m.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    __spreadArray = function(to, from, pack) {
      if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
      return to.concat(ar || Array.prototype.slice.call(from));
    };
    Span2 = /** @class */
    (function() {
      function Span3(parentTracer, context8, spanName, spanContext, kind, parentSpanId, links, startTime, _deprecatedClock, attributes) {
        if (links === void 0) {
          links = [];
        }
        this.attributes = {};
        this.links = [];
        this.events = [];
        this._droppedAttributesCount = 0;
        this._droppedEventsCount = 0;
        this._droppedLinksCount = 0;
        this.status = {
          code: SpanStatusCode2.UNSET
        };
        this.endTime = [0, 0];
        this._ended = false;
        this._duration = [-1, -1];
        this.name = spanName;
        this._spanContext = spanContext;
        this.parentSpanId = parentSpanId;
        this.kind = kind;
        this.links = links;
        var now = Date.now();
        this._performanceStartTime = otperformance.now();
        this._performanceOffset = now - (this._performanceStartTime + getTimeOrigin());
        this._startTimeProvided = startTime != null;
        this.startTime = this._getTime(startTime !== null && startTime !== void 0 ? startTime : now);
        this.resource = parentTracer.resource;
        this.instrumentationLibrary = parentTracer.instrumentationLibrary;
        this._spanLimits = parentTracer.getSpanLimits();
        this._attributeValueLengthLimit = this._spanLimits.attributeValueLengthLimit || 0;
        if (attributes != null) {
          this.setAttributes(attributes);
        }
        this._spanProcessor = parentTracer.getActiveSpanProcessor();
        this._spanProcessor.onStart(this, context8);
      }
      Span3.prototype.spanContext = function() {
        return this._spanContext;
      };
      Span3.prototype.setAttribute = function(key, value) {
        if (value == null || this._isSpanEnded())
          return this;
        if (key.length === 0) {
          diag2.warn("Invalid attribute key: " + key);
          return this;
        }
        if (!isAttributeValue(value)) {
          diag2.warn("Invalid attribute value set for key: " + key);
          return this;
        }
        if (Object.keys(this.attributes).length >= this._spanLimits.attributeCountLimit && !Object.prototype.hasOwnProperty.call(this.attributes, key)) {
          this._droppedAttributesCount++;
          return this;
        }
        this.attributes[key] = this._truncateToSize(value);
        return this;
      };
      Span3.prototype.setAttributes = function(attributes) {
        var e_1, _a;
        try {
          for (var _b = __values(Object.entries(attributes)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = __read3(_c.value, 2), k = _d[0], v = _d[1];
            this.setAttribute(k, v);
          }
        } catch (e_1_1) {
          e_1 = { error: e_1_1 };
        } finally {
          try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
          } finally {
            if (e_1) throw e_1.error;
          }
        }
        return this;
      };
      Span3.prototype.addEvent = function(name, attributesOrStartTime, timeStamp) {
        if (this._isSpanEnded())
          return this;
        if (this._spanLimits.eventCountLimit === 0) {
          diag2.warn("No events allowed.");
          this._droppedEventsCount++;
          return this;
        }
        if (this.events.length >= this._spanLimits.eventCountLimit) {
          if (this._droppedEventsCount === 0) {
            diag2.debug("Dropping extra events.");
          }
          this.events.shift();
          this._droppedEventsCount++;
        }
        if (isTimeInput(attributesOrStartTime)) {
          if (!isTimeInput(timeStamp)) {
            timeStamp = attributesOrStartTime;
          }
          attributesOrStartTime = void 0;
        }
        var attributes = sanitizeAttributes(attributesOrStartTime);
        this.events.push({
          name,
          attributes,
          time: this._getTime(timeStamp),
          droppedAttributesCount: 0
        });
        return this;
      };
      Span3.prototype.addLink = function(link) {
        this.links.push(link);
        return this;
      };
      Span3.prototype.addLinks = function(links) {
        var _a;
        (_a = this.links).push.apply(_a, __spreadArray([], __read3(links), false));
        return this;
      };
      Span3.prototype.setStatus = function(status) {
        if (this._isSpanEnded())
          return this;
        this.status = __assign2({}, status);
        if (this.status.message != null && typeof status.message !== "string") {
          diag2.warn("Dropping invalid status.message of type '" + typeof status.message + "', expected 'string'");
          delete this.status.message;
        }
        return this;
      };
      Span3.prototype.updateName = function(name) {
        if (this._isSpanEnded())
          return this;
        this.name = name;
        return this;
      };
      Span3.prototype.end = function(endTime) {
        if (this._isSpanEnded()) {
          diag2.error(this.name + " " + this._spanContext.traceId + "-" + this._spanContext.spanId + " - You can only call end() on a span once.");
          return;
        }
        this._ended = true;
        this.endTime = this._getTime(endTime);
        this._duration = hrTimeDuration(this.startTime, this.endTime);
        if (this._duration[0] < 0) {
          diag2.warn("Inconsistent start and end time, startTime > endTime. Setting span duration to 0ms.", this.startTime, this.endTime);
          this.endTime = this.startTime.slice();
          this._duration = [0, 0];
        }
        if (this._droppedEventsCount > 0) {
          diag2.warn("Dropped " + this._droppedEventsCount + " events because eventCountLimit reached");
        }
        this._spanProcessor.onEnd(this);
      };
      Span3.prototype._getTime = function(inp) {
        if (typeof inp === "number" && inp <= otperformance.now()) {
          return hrTime(inp + this._performanceOffset);
        }
        if (typeof inp === "number") {
          return millisToHrTime(inp);
        }
        if (inp instanceof Date) {
          return millisToHrTime(inp.getTime());
        }
        if (isTimeInputHrTime(inp)) {
          return inp;
        }
        if (this._startTimeProvided) {
          return millisToHrTime(Date.now());
        }
        var msDuration = otperformance.now() - this._performanceStartTime;
        return addHrTimes(this.startTime, millisToHrTime(msDuration));
      };
      Span3.prototype.isRecording = function() {
        return this._ended === false;
      };
      Span3.prototype.recordException = function(exception, time) {
        var attributes = {};
        if (typeof exception === "string") {
          attributes[SEMATTRS_EXCEPTION_MESSAGE] = exception;
        } else if (exception) {
          if (exception.code) {
            attributes[SEMATTRS_EXCEPTION_TYPE] = exception.code.toString();
          } else if (exception.name) {
            attributes[SEMATTRS_EXCEPTION_TYPE] = exception.name;
          }
          if (exception.message) {
            attributes[SEMATTRS_EXCEPTION_MESSAGE] = exception.message;
          }
          if (exception.stack) {
            attributes[SEMATTRS_EXCEPTION_STACKTRACE] = exception.stack;
          }
        }
        if (attributes[SEMATTRS_EXCEPTION_TYPE] || attributes[SEMATTRS_EXCEPTION_MESSAGE]) {
          this.addEvent(ExceptionEventName, attributes, time);
        } else {
          diag2.warn("Failed to record an exception " + exception);
        }
      };
      Object.defineProperty(Span3.prototype, "duration", {
        get: function() {
          return this._duration;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Span3.prototype, "ended", {
        get: function() {
          return this._ended;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Span3.prototype, "droppedAttributesCount", {
        get: function() {
          return this._droppedAttributesCount;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Span3.prototype, "droppedEventsCount", {
        get: function() {
          return this._droppedEventsCount;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Span3.prototype, "droppedLinksCount", {
        get: function() {
          return this._droppedLinksCount;
        },
        enumerable: false,
        configurable: true
      });
      Span3.prototype._isSpanEnded = function() {
        if (this._ended) {
          diag2.warn("Can not execute the operation on ended Span {traceId: " + this._spanContext.traceId + ", spanId: " + this._spanContext.spanId + "}");
        }
        return this._ended;
      };
      Span3.prototype._truncateToLimitUtil = function(value, limit) {
        if (value.length <= limit) {
          return value;
        }
        return value.substring(0, limit);
      };
      Span3.prototype._truncateToSize = function(value) {
        var _this = this;
        var limit = this._attributeValueLengthLimit;
        if (limit <= 0) {
          diag2.warn("Attribute value limit must be positive, got " + limit);
          return value;
        }
        if (typeof value === "string") {
          return this._truncateToLimitUtil(value, limit);
        }
        if (Array.isArray(value)) {
          return value.map(function(val) {
            return typeof val === "string" ? _this._truncateToLimitUtil(val, limit) : val;
          });
        }
        return value;
      };
      return Span3;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/Sampler.js
var SamplingDecision;
var init_Sampler = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/Sampler.js"() {
    "use strict";
    (function(SamplingDecision3) {
      SamplingDecision3[SamplingDecision3["NOT_RECORD"] = 0] = "NOT_RECORD";
      SamplingDecision3[SamplingDecision3["RECORD"] = 1] = "RECORD";
      SamplingDecision3[SamplingDecision3["RECORD_AND_SAMPLED"] = 2] = "RECORD_AND_SAMPLED";
    })(SamplingDecision || (SamplingDecision = {}));
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/AlwaysOffSampler.js
var AlwaysOffSampler;
var init_AlwaysOffSampler = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/AlwaysOffSampler.js"() {
    "use strict";
    init_Sampler();
    AlwaysOffSampler = /** @class */
    (function() {
      function AlwaysOffSampler3() {
      }
      AlwaysOffSampler3.prototype.shouldSample = function() {
        return {
          decision: SamplingDecision.NOT_RECORD
        };
      };
      AlwaysOffSampler3.prototype.toString = function() {
        return "AlwaysOffSampler";
      };
      return AlwaysOffSampler3;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/AlwaysOnSampler.js
var AlwaysOnSampler;
var init_AlwaysOnSampler = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/AlwaysOnSampler.js"() {
    "use strict";
    init_Sampler();
    AlwaysOnSampler = /** @class */
    (function() {
      function AlwaysOnSampler3() {
      }
      AlwaysOnSampler3.prototype.shouldSample = function() {
        return {
          decision: SamplingDecision.RECORD_AND_SAMPLED
        };
      };
      AlwaysOnSampler3.prototype.toString = function() {
        return "AlwaysOnSampler";
      };
      return AlwaysOnSampler3;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/ParentBasedSampler.js
import { isSpanContextValid as isSpanContextValid3, TraceFlags as TraceFlags3, trace as trace5 } from "@opentelemetry/api";
import { globalErrorHandler } from "@opentelemetry/core";
var ParentBasedSampler;
var init_ParentBasedSampler = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/ParentBasedSampler.js"() {
    "use strict";
    init_AlwaysOffSampler();
    init_AlwaysOnSampler();
    ParentBasedSampler = /** @class */
    (function() {
      function ParentBasedSampler3(config) {
        var _a, _b, _c, _d;
        this._root = config.root;
        if (!this._root) {
          globalErrorHandler(new Error("ParentBasedSampler must have a root sampler configured"));
          this._root = new AlwaysOnSampler();
        }
        this._remoteParentSampled = (_a = config.remoteParentSampled) !== null && _a !== void 0 ? _a : new AlwaysOnSampler();
        this._remoteParentNotSampled = (_b = config.remoteParentNotSampled) !== null && _b !== void 0 ? _b : new AlwaysOffSampler();
        this._localParentSampled = (_c = config.localParentSampled) !== null && _c !== void 0 ? _c : new AlwaysOnSampler();
        this._localParentNotSampled = (_d = config.localParentNotSampled) !== null && _d !== void 0 ? _d : new AlwaysOffSampler();
      }
      ParentBasedSampler3.prototype.shouldSample = function(context8, traceId, spanName, spanKind, attributes, links) {
        var parentContext = trace5.getSpanContext(context8);
        if (!parentContext || !isSpanContextValid3(parentContext)) {
          return this._root.shouldSample(context8, traceId, spanName, spanKind, attributes, links);
        }
        if (parentContext.isRemote) {
          if (parentContext.traceFlags & TraceFlags3.SAMPLED) {
            return this._remoteParentSampled.shouldSample(context8, traceId, spanName, spanKind, attributes, links);
          }
          return this._remoteParentNotSampled.shouldSample(context8, traceId, spanName, spanKind, attributes, links);
        }
        if (parentContext.traceFlags & TraceFlags3.SAMPLED) {
          return this._localParentSampled.shouldSample(context8, traceId, spanName, spanKind, attributes, links);
        }
        return this._localParentNotSampled.shouldSample(context8, traceId, spanName, spanKind, attributes, links);
      };
      ParentBasedSampler3.prototype.toString = function() {
        return "ParentBased{root=" + this._root.toString() + ", remoteParentSampled=" + this._remoteParentSampled.toString() + ", remoteParentNotSampled=" + this._remoteParentNotSampled.toString() + ", localParentSampled=" + this._localParentSampled.toString() + ", localParentNotSampled=" + this._localParentNotSampled.toString() + "}";
      };
      return ParentBasedSampler3;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/TraceIdRatioBasedSampler.js
import { isValidTraceId as isValidTraceId3 } from "@opentelemetry/api";
var TraceIdRatioBasedSampler;
var init_TraceIdRatioBasedSampler = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/TraceIdRatioBasedSampler.js"() {
    "use strict";
    init_Sampler();
    TraceIdRatioBasedSampler = /** @class */
    (function() {
      function TraceIdRatioBasedSampler3(_ratio) {
        if (_ratio === void 0) {
          _ratio = 0;
        }
        this._ratio = _ratio;
        this._ratio = this._normalize(_ratio);
        this._upperBound = Math.floor(this._ratio * 4294967295);
      }
      TraceIdRatioBasedSampler3.prototype.shouldSample = function(context8, traceId) {
        return {
          decision: isValidTraceId3(traceId) && this._accumulate(traceId) < this._upperBound ? SamplingDecision.RECORD_AND_SAMPLED : SamplingDecision.NOT_RECORD
        };
      };
      TraceIdRatioBasedSampler3.prototype.toString = function() {
        return "TraceIdRatioBased{" + this._ratio + "}";
      };
      TraceIdRatioBasedSampler3.prototype._normalize = function(ratio) {
        if (typeof ratio !== "number" || isNaN(ratio))
          return 0;
        return ratio >= 1 ? 1 : ratio <= 0 ? 0 : ratio;
      };
      TraceIdRatioBasedSampler3.prototype._accumulate = function(traceId) {
        var accumulation = 0;
        for (var i = 0; i < traceId.length / 8; i++) {
          var pos = i * 8;
          var part = parseInt(traceId.slice(pos, pos + 8), 16);
          accumulation = (accumulation ^ part) >>> 0;
        }
        return accumulation;
      };
      return TraceIdRatioBasedSampler3;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/config.js
import { diag as diag3 } from "@opentelemetry/api";
import { getEnv, TracesSamplerValues } from "@opentelemetry/core";
function loadDefaultConfig() {
  var env = getEnv();
  return {
    sampler: buildSamplerFromEnv(env),
    forceFlushTimeoutMillis: 3e4,
    generalLimits: {
      attributeValueLengthLimit: env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT,
      attributeCountLimit: env.OTEL_ATTRIBUTE_COUNT_LIMIT
    },
    spanLimits: {
      attributeValueLengthLimit: env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT,
      attributeCountLimit: env.OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT,
      linkCountLimit: env.OTEL_SPAN_LINK_COUNT_LIMIT,
      eventCountLimit: env.OTEL_SPAN_EVENT_COUNT_LIMIT,
      attributePerEventCountLimit: env.OTEL_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT,
      attributePerLinkCountLimit: env.OTEL_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT
    },
    mergeResourceWithDefaults: true
  };
}
function buildSamplerFromEnv(environment) {
  if (environment === void 0) {
    environment = getEnv();
  }
  switch (environment.OTEL_TRACES_SAMPLER) {
    case TracesSamplerValues.AlwaysOn:
      return new AlwaysOnSampler();
    case TracesSamplerValues.AlwaysOff:
      return new AlwaysOffSampler();
    case TracesSamplerValues.ParentBasedAlwaysOn:
      return new ParentBasedSampler({
        root: new AlwaysOnSampler()
      });
    case TracesSamplerValues.ParentBasedAlwaysOff:
      return new ParentBasedSampler({
        root: new AlwaysOffSampler()
      });
    case TracesSamplerValues.TraceIdRatio:
      return new TraceIdRatioBasedSampler(getSamplerProbabilityFromEnv(environment));
    case TracesSamplerValues.ParentBasedTraceIdRatio:
      return new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(getSamplerProbabilityFromEnv(environment))
      });
    default:
      diag3.error('OTEL_TRACES_SAMPLER value "' + environment.OTEL_TRACES_SAMPLER + " invalid, defaulting to " + FALLBACK_OTEL_TRACES_SAMPLER + '".');
      return new AlwaysOnSampler();
  }
}
function getSamplerProbabilityFromEnv(environment) {
  if (environment.OTEL_TRACES_SAMPLER_ARG === void 0 || environment.OTEL_TRACES_SAMPLER_ARG === "") {
    diag3.error("OTEL_TRACES_SAMPLER_ARG is blank, defaulting to " + DEFAULT_RATIO + ".");
    return DEFAULT_RATIO;
  }
  var probability = Number(environment.OTEL_TRACES_SAMPLER_ARG);
  if (isNaN(probability)) {
    diag3.error("OTEL_TRACES_SAMPLER_ARG=" + environment.OTEL_TRACES_SAMPLER_ARG + " was given, but it is invalid, defaulting to " + DEFAULT_RATIO + ".");
    return DEFAULT_RATIO;
  }
  if (probability < 0 || probability > 1) {
    diag3.error("OTEL_TRACES_SAMPLER_ARG=" + environment.OTEL_TRACES_SAMPLER_ARG + " was given, but it is out of range ([0..1]), defaulting to " + DEFAULT_RATIO + ".");
    return DEFAULT_RATIO;
  }
  return probability;
}
var FALLBACK_OTEL_TRACES_SAMPLER, DEFAULT_RATIO;
var init_config = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/config.js"() {
    "use strict";
    init_AlwaysOffSampler();
    init_AlwaysOnSampler();
    init_ParentBasedSampler();
    init_TraceIdRatioBasedSampler();
    FALLBACK_OTEL_TRACES_SAMPLER = TracesSamplerValues.AlwaysOn;
    DEFAULT_RATIO = 1;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/utility.js
import { DEFAULT_ATTRIBUTE_COUNT_LIMIT, DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT, getEnvWithoutDefaults } from "@opentelemetry/core";
function mergeConfig(userConfig) {
  var perInstanceDefaults = {
    sampler: buildSamplerFromEnv()
  };
  var DEFAULT_CONFIG = loadDefaultConfig();
  var target = Object.assign({}, DEFAULT_CONFIG, perInstanceDefaults, userConfig);
  target.generalLimits = Object.assign({}, DEFAULT_CONFIG.generalLimits, userConfig.generalLimits || {});
  target.spanLimits = Object.assign({}, DEFAULT_CONFIG.spanLimits, userConfig.spanLimits || {});
  return target;
}
function reconfigureLimits(userConfig) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
  var spanLimits = Object.assign({}, userConfig.spanLimits);
  var parsedEnvConfig = getEnvWithoutDefaults();
  spanLimits.attributeCountLimit = (_f = (_e = (_d = (_b = (_a = userConfig.spanLimits) === null || _a === void 0 ? void 0 : _a.attributeCountLimit) !== null && _b !== void 0 ? _b : (_c = userConfig.generalLimits) === null || _c === void 0 ? void 0 : _c.attributeCountLimit) !== null && _d !== void 0 ? _d : parsedEnvConfig.OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT) !== null && _e !== void 0 ? _e : parsedEnvConfig.OTEL_ATTRIBUTE_COUNT_LIMIT) !== null && _f !== void 0 ? _f : DEFAULT_ATTRIBUTE_COUNT_LIMIT;
  spanLimits.attributeValueLengthLimit = (_m = (_l = (_k = (_h = (_g = userConfig.spanLimits) === null || _g === void 0 ? void 0 : _g.attributeValueLengthLimit) !== null && _h !== void 0 ? _h : (_j = userConfig.generalLimits) === null || _j === void 0 ? void 0 : _j.attributeValueLengthLimit) !== null && _k !== void 0 ? _k : parsedEnvConfig.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT) !== null && _l !== void 0 ? _l : parsedEnvConfig.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT) !== null && _m !== void 0 ? _m : DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT;
  return Object.assign({}, userConfig, { spanLimits });
}
var init_utility = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/utility.js"() {
    "use strict";
    init_config();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/export/BatchSpanProcessorBase.js
import { context as context4, diag as diag4, TraceFlags as TraceFlags4 } from "@opentelemetry/api";
import { BindOnceFuture, ExportResultCode, getEnv as getEnv2, globalErrorHandler as globalErrorHandler2, suppressTracing, unrefTimer } from "@opentelemetry/core";
var BatchSpanProcessorBase;
var init_BatchSpanProcessorBase = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/export/BatchSpanProcessorBase.js"() {
    "use strict";
    BatchSpanProcessorBase = /** @class */
    (function() {
      function BatchSpanProcessorBase2(_exporter, config) {
        this._exporter = _exporter;
        this._isExporting = false;
        this._finishedSpans = [];
        this._droppedSpansCount = 0;
        var env = getEnv2();
        this._maxExportBatchSize = typeof (config === null || config === void 0 ? void 0 : config.maxExportBatchSize) === "number" ? config.maxExportBatchSize : env.OTEL_BSP_MAX_EXPORT_BATCH_SIZE;
        this._maxQueueSize = typeof (config === null || config === void 0 ? void 0 : config.maxQueueSize) === "number" ? config.maxQueueSize : env.OTEL_BSP_MAX_QUEUE_SIZE;
        this._scheduledDelayMillis = typeof (config === null || config === void 0 ? void 0 : config.scheduledDelayMillis) === "number" ? config.scheduledDelayMillis : env.OTEL_BSP_SCHEDULE_DELAY;
        this._exportTimeoutMillis = typeof (config === null || config === void 0 ? void 0 : config.exportTimeoutMillis) === "number" ? config.exportTimeoutMillis : env.OTEL_BSP_EXPORT_TIMEOUT;
        this._shutdownOnce = new BindOnceFuture(this._shutdown, this);
        if (this._maxExportBatchSize > this._maxQueueSize) {
          diag4.warn("BatchSpanProcessor: maxExportBatchSize must be smaller or equal to maxQueueSize, setting maxExportBatchSize to match maxQueueSize");
          this._maxExportBatchSize = this._maxQueueSize;
        }
      }
      BatchSpanProcessorBase2.prototype.forceFlush = function() {
        if (this._shutdownOnce.isCalled) {
          return this._shutdownOnce.promise;
        }
        return this._flushAll();
      };
      BatchSpanProcessorBase2.prototype.onStart = function(_span, _parentContext) {
      };
      BatchSpanProcessorBase2.prototype.onEnd = function(span) {
        if (this._shutdownOnce.isCalled) {
          return;
        }
        if ((span.spanContext().traceFlags & TraceFlags4.SAMPLED) === 0) {
          return;
        }
        this._addToBuffer(span);
      };
      BatchSpanProcessorBase2.prototype.shutdown = function() {
        return this._shutdownOnce.call();
      };
      BatchSpanProcessorBase2.prototype._shutdown = function() {
        var _this = this;
        return Promise.resolve().then(function() {
          return _this.onShutdown();
        }).then(function() {
          return _this._flushAll();
        }).then(function() {
          return _this._exporter.shutdown();
        });
      };
      BatchSpanProcessorBase2.prototype._addToBuffer = function(span) {
        if (this._finishedSpans.length >= this._maxQueueSize) {
          if (this._droppedSpansCount === 0) {
            diag4.debug("maxQueueSize reached, dropping spans");
          }
          this._droppedSpansCount++;
          return;
        }
        if (this._droppedSpansCount > 0) {
          diag4.warn("Dropped " + this._droppedSpansCount + " spans because maxQueueSize reached");
          this._droppedSpansCount = 0;
        }
        this._finishedSpans.push(span);
        this._maybeStartTimer();
      };
      BatchSpanProcessorBase2.prototype._flushAll = function() {
        var _this = this;
        return new Promise(function(resolve, reject) {
          var promises = [];
          var count = Math.ceil(_this._finishedSpans.length / _this._maxExportBatchSize);
          for (var i = 0, j = count; i < j; i++) {
            promises.push(_this._flushOneBatch());
          }
          Promise.all(promises).then(function() {
            resolve();
          }).catch(reject);
        });
      };
      BatchSpanProcessorBase2.prototype._flushOneBatch = function() {
        var _this = this;
        this._clearTimer();
        if (this._finishedSpans.length === 0) {
          return Promise.resolve();
        }
        return new Promise(function(resolve, reject) {
          var timer = setTimeout(function() {
            reject(new Error("Timeout"));
          }, _this._exportTimeoutMillis);
          context4.with(suppressTracing(context4.active()), function() {
            var spans;
            if (_this._finishedSpans.length <= _this._maxExportBatchSize) {
              spans = _this._finishedSpans;
              _this._finishedSpans = [];
            } else {
              spans = _this._finishedSpans.splice(0, _this._maxExportBatchSize);
            }
            var doExport = function() {
              return _this._exporter.export(spans, function(result) {
                var _a;
                clearTimeout(timer);
                if (result.code === ExportResultCode.SUCCESS) {
                  resolve();
                } else {
                  reject((_a = result.error) !== null && _a !== void 0 ? _a : new Error("BatchSpanProcessor: span export failed"));
                }
              });
            };
            var pendingResources = null;
            for (var i = 0, len = spans.length; i < len; i++) {
              var span = spans[i];
              if (span.resource.asyncAttributesPending && span.resource.waitForAsyncAttributes) {
                pendingResources !== null && pendingResources !== void 0 ? pendingResources : pendingResources = [];
                pendingResources.push(span.resource.waitForAsyncAttributes());
              }
            }
            if (pendingResources === null) {
              doExport();
            } else {
              Promise.all(pendingResources).then(doExport, function(err) {
                globalErrorHandler2(err);
                reject(err);
              });
            }
          });
        });
      };
      BatchSpanProcessorBase2.prototype._maybeStartTimer = function() {
        var _this = this;
        if (this._isExporting)
          return;
        var flush = function() {
          _this._isExporting = true;
          _this._flushOneBatch().finally(function() {
            _this._isExporting = false;
            if (_this._finishedSpans.length > 0) {
              _this._clearTimer();
              _this._maybeStartTimer();
            }
          }).catch(function(e) {
            _this._isExporting = false;
            globalErrorHandler2(e);
          });
        };
        if (this._finishedSpans.length >= this._maxExportBatchSize) {
          return flush();
        }
        if (this._timer !== void 0)
          return;
        this._timer = setTimeout(function() {
          return flush();
        }, this._scheduledDelayMillis);
        unrefTimer(this._timer);
      };
      BatchSpanProcessorBase2.prototype._clearTimer = function() {
        if (this._timer !== void 0) {
          clearTimeout(this._timer);
          this._timer = void 0;
        }
      };
      return BatchSpanProcessorBase2;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/node/export/BatchSpanProcessor.js
var __extends, BatchSpanProcessor;
var init_BatchSpanProcessor = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/node/export/BatchSpanProcessor.js"() {
    "use strict";
    init_BatchSpanProcessorBase();
    __extends = /* @__PURE__ */ (function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    })();
    BatchSpanProcessor = /** @class */
    (function(_super) {
      __extends(BatchSpanProcessor3, _super);
      function BatchSpanProcessor3() {
        return _super !== null && _super.apply(this, arguments) || this;
      }
      BatchSpanProcessor3.prototype.onShutdown = function() {
      };
      return BatchSpanProcessor3;
    })(BatchSpanProcessorBase);
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/node/RandomIdGenerator.js
function getIdGenerator(bytes) {
  return function generateId() {
    for (var i = 0; i < bytes / 4; i++) {
      SHARED_BUFFER.writeUInt32BE(Math.random() * Math.pow(2, 32) >>> 0, i * 4);
    }
    for (var i = 0; i < bytes; i++) {
      if (SHARED_BUFFER[i] > 0) {
        break;
      } else if (i === bytes - 1) {
        SHARED_BUFFER[bytes - 1] = 1;
      }
    }
    return SHARED_BUFFER.toString("hex", 0, bytes);
  };
}
var SPAN_ID_BYTES, TRACE_ID_BYTES, RandomIdGenerator, SHARED_BUFFER;
var init_RandomIdGenerator = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/node/RandomIdGenerator.js"() {
    "use strict";
    SPAN_ID_BYTES = 8;
    TRACE_ID_BYTES = 16;
    RandomIdGenerator = /** @class */
    /* @__PURE__ */ (function() {
      function RandomIdGenerator2() {
        this.generateTraceId = getIdGenerator(TRACE_ID_BYTES);
        this.generateSpanId = getIdGenerator(SPAN_ID_BYTES);
      }
      return RandomIdGenerator2;
    })();
    SHARED_BUFFER = Buffer.allocUnsafe(TRACE_ID_BYTES);
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/node/index.js
var init_node = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/node/index.js"() {
    "use strict";
    init_BatchSpanProcessor();
    init_RandomIdGenerator();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/index.js
var init_platform = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/index.js"() {
    "use strict";
    init_node();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/Tracer.js
import * as api from "@opentelemetry/api";
import { sanitizeAttributes as sanitizeAttributes2, isTracingSuppressed as isTracingSuppressed4 } from "@opentelemetry/core";
var Tracer;
var init_Tracer = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/Tracer.js"() {
    "use strict";
    init_Span();
    init_utility();
    init_platform();
    Tracer = /** @class */
    (function() {
      function Tracer2(instrumentationLibrary, config, _tracerProvider) {
        this._tracerProvider = _tracerProvider;
        var localConfig = mergeConfig(config);
        this._sampler = localConfig.sampler;
        this._generalLimits = localConfig.generalLimits;
        this._spanLimits = localConfig.spanLimits;
        this._idGenerator = config.idGenerator || new RandomIdGenerator();
        this.resource = _tracerProvider.resource;
        this.instrumentationLibrary = instrumentationLibrary;
      }
      Tracer2.prototype.startSpan = function(name, options, context8) {
        var _a, _b, _c;
        if (options === void 0) {
          options = {};
        }
        if (context8 === void 0) {
          context8 = api.context.active();
        }
        if (options.root) {
          context8 = api.trace.deleteSpan(context8);
        }
        var parentSpan = api.trace.getSpan(context8);
        if (isTracingSuppressed4(context8)) {
          api.diag.debug("Instrumentation suppressed, returning Noop Span");
          var nonRecordingSpan = api.trace.wrapSpanContext(api.INVALID_SPAN_CONTEXT);
          return nonRecordingSpan;
        }
        var parentSpanContext = parentSpan === null || parentSpan === void 0 ? void 0 : parentSpan.spanContext();
        var spanId = this._idGenerator.generateSpanId();
        var traceId;
        var traceState;
        var parentSpanId;
        if (!parentSpanContext || !api.trace.isSpanContextValid(parentSpanContext)) {
          traceId = this._idGenerator.generateTraceId();
        } else {
          traceId = parentSpanContext.traceId;
          traceState = parentSpanContext.traceState;
          parentSpanId = parentSpanContext.spanId;
        }
        var spanKind = (_a = options.kind) !== null && _a !== void 0 ? _a : api.SpanKind.INTERNAL;
        var links = ((_b = options.links) !== null && _b !== void 0 ? _b : []).map(function(link) {
          return {
            context: link.context,
            attributes: sanitizeAttributes2(link.attributes)
          };
        });
        var attributes = sanitizeAttributes2(options.attributes);
        var samplingResult = this._sampler.shouldSample(context8, traceId, name, spanKind, attributes, links);
        traceState = (_c = samplingResult.traceState) !== null && _c !== void 0 ? _c : traceState;
        var traceFlags = samplingResult.decision === api.SamplingDecision.RECORD_AND_SAMPLED ? api.TraceFlags.SAMPLED : api.TraceFlags.NONE;
        var spanContext = { traceId, spanId, traceFlags, traceState };
        if (samplingResult.decision === api.SamplingDecision.NOT_RECORD) {
          api.diag.debug("Recording is off, propagating context in a non-recording span");
          var nonRecordingSpan = api.trace.wrapSpanContext(spanContext);
          return nonRecordingSpan;
        }
        var initAttributes = sanitizeAttributes2(Object.assign(attributes, samplingResult.attributes));
        var span = new Span2(this, context8, name, spanContext, spanKind, parentSpanId, links, options.startTime, void 0, initAttributes);
        return span;
      };
      Tracer2.prototype.startActiveSpan = function(name, arg2, arg3, arg4) {
        var opts;
        var ctx;
        var fn;
        if (arguments.length < 2) {
          return;
        } else if (arguments.length === 2) {
          fn = arg2;
        } else if (arguments.length === 3) {
          opts = arg2;
          fn = arg3;
        } else {
          opts = arg2;
          ctx = arg3;
          fn = arg4;
        }
        var parentContext = ctx !== null && ctx !== void 0 ? ctx : api.context.active();
        var span = this.startSpan(name, opts, parentContext);
        var contextWithSpanSet = api.trace.setSpan(parentContext, span);
        return api.context.with(contextWithSpanSet, fn, void 0, span);
      };
      Tracer2.prototype.getGeneralLimits = function() {
        return this._generalLimits;
      };
      Tracer2.prototype.getSpanLimits = function() {
        return this._spanLimits;
      };
      Tracer2.prototype.getActiveSpanProcessor = function() {
        return this._tracerProvider.getActiveSpanProcessor();
      };
      return Tracer2;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/node_modules/@opentelemetry/resources/build/esm/platform/node/default-service-name.js
function defaultServiceName2() {
  return "unknown_service:" + process.argv0;
}
var init_default_service_name = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/node_modules/@opentelemetry/resources/build/esm/platform/node/default-service-name.js"() {
    "use strict";
  }
});

// node_modules/@opentelemetry/sdk-trace-base/node_modules/@opentelemetry/resources/build/esm/platform/node/index.js
var init_node2 = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/node_modules/@opentelemetry/resources/build/esm/platform/node/index.js"() {
    "use strict";
    init_default_service_name();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/node_modules/@opentelemetry/resources/build/esm/platform/index.js
var init_platform2 = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/node_modules/@opentelemetry/resources/build/esm/platform/index.js"() {
    "use strict";
    init_node2();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/node_modules/@opentelemetry/resources/build/esm/Resource.js
import { diag as diag6 } from "@opentelemetry/api";
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_TELEMETRY_SDK_LANGUAGE, SEMRESATTRS_TELEMETRY_SDK_NAME, SEMRESATTRS_TELEMETRY_SDK_VERSION } from "@opentelemetry/semantic-conventions";
import { SDK_INFO as SDK_INFO2 } from "@opentelemetry/core";
var __assign3, __awaiter2, __generator2, __read4, Resource2;
var init_Resource = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/node_modules/@opentelemetry/resources/build/esm/Resource.js"() {
    "use strict";
    init_platform2();
    __assign3 = function() {
      __assign3 = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
        }
        return t;
      };
      return __assign3.apply(this, arguments);
    };
    __awaiter2 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    __generator2 = function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    __read4 = function(o, n) {
      var m = typeof Symbol === "function" && o[Symbol.iterator];
      if (!m) return o;
      var i = m.call(o), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m = i["return"])) m.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    Resource2 = /** @class */
    (function() {
      function Resource3(attributes, asyncAttributesPromise) {
        var _this = this;
        var _a;
        this._attributes = attributes;
        this.asyncAttributesPending = asyncAttributesPromise != null;
        this._syncAttributes = (_a = this._attributes) !== null && _a !== void 0 ? _a : {};
        this._asyncAttributesPromise = asyncAttributesPromise === null || asyncAttributesPromise === void 0 ? void 0 : asyncAttributesPromise.then(function(asyncAttributes) {
          _this._attributes = Object.assign({}, _this._attributes, asyncAttributes);
          _this.asyncAttributesPending = false;
          return asyncAttributes;
        }, function(err) {
          diag6.debug("a resource's async attributes promise rejected: %s", err);
          _this.asyncAttributesPending = false;
          return {};
        });
      }
      Resource3.empty = function() {
        return Resource3.EMPTY;
      };
      Resource3.default = function() {
        var _a;
        return new Resource3((_a = {}, _a[SEMRESATTRS_SERVICE_NAME] = defaultServiceName2(), _a[SEMRESATTRS_TELEMETRY_SDK_LANGUAGE] = SDK_INFO2[SEMRESATTRS_TELEMETRY_SDK_LANGUAGE], _a[SEMRESATTRS_TELEMETRY_SDK_NAME] = SDK_INFO2[SEMRESATTRS_TELEMETRY_SDK_NAME], _a[SEMRESATTRS_TELEMETRY_SDK_VERSION] = SDK_INFO2[SEMRESATTRS_TELEMETRY_SDK_VERSION], _a));
      };
      Object.defineProperty(Resource3.prototype, "attributes", {
        get: function() {
          var _a;
          if (this.asyncAttributesPending) {
            diag6.error("Accessing resource attributes before async attributes settled");
          }
          return (_a = this._attributes) !== null && _a !== void 0 ? _a : {};
        },
        enumerable: false,
        configurable: true
      });
      Resource3.prototype.waitForAsyncAttributes = function() {
        return __awaiter2(this, void 0, void 0, function() {
          return __generator2(this, function(_a) {
            switch (_a.label) {
              case 0:
                if (!this.asyncAttributesPending) return [3, 2];
                return [4, this._asyncAttributesPromise];
              case 1:
                _a.sent();
                _a.label = 2;
              case 2:
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      Resource3.prototype.merge = function(other) {
        var _this = this;
        var _a;
        if (!other)
          return this;
        var mergedSyncAttributes = __assign3(__assign3({}, this._syncAttributes), (_a = other._syncAttributes) !== null && _a !== void 0 ? _a : other.attributes);
        if (!this._asyncAttributesPromise && !other._asyncAttributesPromise) {
          return new Resource3(mergedSyncAttributes);
        }
        var mergedAttributesPromise = Promise.all([
          this._asyncAttributesPromise,
          other._asyncAttributesPromise
        ]).then(function(_a2) {
          var _b;
          var _c = __read4(_a2, 2), thisAsyncAttributes = _c[0], otherAsyncAttributes = _c[1];
          return __assign3(__assign3(__assign3(__assign3({}, _this._syncAttributes), thisAsyncAttributes), (_b = other._syncAttributes) !== null && _b !== void 0 ? _b : other.attributes), otherAsyncAttributes);
        });
        return new Resource3(mergedSyncAttributes, mergedAttributesPromise);
      };
      Resource3.EMPTY = new Resource3({});
      return Resource3;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/node_modules/@opentelemetry/resources/build/esm/index.js
var init_esm2 = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/node_modules/@opentelemetry/resources/build/esm/index.js"() {
    "use strict";
    init_Resource();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/MultiSpanProcessor.js
import { globalErrorHandler as globalErrorHandler3 } from "@opentelemetry/core";
var __values2, MultiSpanProcessor;
var init_MultiSpanProcessor = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/MultiSpanProcessor.js"() {
    "use strict";
    __values2 = function(o) {
      var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
      if (m) return m.call(o);
      if (o && typeof o.length === "number") return {
        next: function() {
          if (o && i >= o.length) o = void 0;
          return { value: o && o[i++], done: !o };
        }
      };
      throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    MultiSpanProcessor = /** @class */
    (function() {
      function MultiSpanProcessor2(_spanProcessors) {
        this._spanProcessors = _spanProcessors;
      }
      MultiSpanProcessor2.prototype.forceFlush = function() {
        var e_1, _a;
        var promises = [];
        try {
          for (var _b = __values2(this._spanProcessors), _c = _b.next(); !_c.done; _c = _b.next()) {
            var spanProcessor = _c.value;
            promises.push(spanProcessor.forceFlush());
          }
        } catch (e_1_1) {
          e_1 = { error: e_1_1 };
        } finally {
          try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
          } finally {
            if (e_1) throw e_1.error;
          }
        }
        return new Promise(function(resolve) {
          Promise.all(promises).then(function() {
            resolve();
          }).catch(function(error) {
            globalErrorHandler3(error || new Error("MultiSpanProcessor: forceFlush failed"));
            resolve();
          });
        });
      };
      MultiSpanProcessor2.prototype.onStart = function(span, context8) {
        var e_2, _a;
        try {
          for (var _b = __values2(this._spanProcessors), _c = _b.next(); !_c.done; _c = _b.next()) {
            var spanProcessor = _c.value;
            spanProcessor.onStart(span, context8);
          }
        } catch (e_2_1) {
          e_2 = { error: e_2_1 };
        } finally {
          try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
          } finally {
            if (e_2) throw e_2.error;
          }
        }
      };
      MultiSpanProcessor2.prototype.onEnd = function(span) {
        var e_3, _a;
        try {
          for (var _b = __values2(this._spanProcessors), _c = _b.next(); !_c.done; _c = _b.next()) {
            var spanProcessor = _c.value;
            spanProcessor.onEnd(span);
          }
        } catch (e_3_1) {
          e_3 = { error: e_3_1 };
        } finally {
          try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
          } finally {
            if (e_3) throw e_3.error;
          }
        }
      };
      MultiSpanProcessor2.prototype.shutdown = function() {
        var e_4, _a;
        var promises = [];
        try {
          for (var _b = __values2(this._spanProcessors), _c = _b.next(); !_c.done; _c = _b.next()) {
            var spanProcessor = _c.value;
            promises.push(spanProcessor.shutdown());
          }
        } catch (e_4_1) {
          e_4 = { error: e_4_1 };
        } finally {
          try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
          } finally {
            if (e_4) throw e_4.error;
          }
        }
        return new Promise(function(resolve, reject) {
          Promise.all(promises).then(function() {
            resolve();
          }, reject);
        });
      };
      return MultiSpanProcessor2;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/export/NoopSpanProcessor.js
var NoopSpanProcessor;
var init_NoopSpanProcessor = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/export/NoopSpanProcessor.js"() {
    "use strict";
    NoopSpanProcessor = /** @class */
    (function() {
      function NoopSpanProcessor2() {
      }
      NoopSpanProcessor2.prototype.onStart = function(_span, _context) {
      };
      NoopSpanProcessor2.prototype.onEnd = function(_span) {
      };
      NoopSpanProcessor2.prototype.shutdown = function() {
        return Promise.resolve();
      };
      NoopSpanProcessor2.prototype.forceFlush = function() {
        return Promise.resolve();
      };
      return NoopSpanProcessor2;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/BasicTracerProvider.js
import { context as context6, diag as diag7, propagation as propagation2, trace as trace7 } from "@opentelemetry/api";
import { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator, getEnv as getEnv3, merge } from "@opentelemetry/core";
var __read5, __spreadArray2, ForceFlushState, BasicTracerProvider;
var init_BasicTracerProvider = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/BasicTracerProvider.js"() {
    "use strict";
    init_esm2();
    init_Tracer();
    init_config();
    init_MultiSpanProcessor();
    init_NoopSpanProcessor();
    init_platform();
    init_utility();
    __read5 = function(o, n) {
      var m = typeof Symbol === "function" && o[Symbol.iterator];
      if (!m) return o;
      var i = m.call(o), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m = i["return"])) m.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    __spreadArray2 = function(to, from, pack) {
      if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
      return to.concat(ar || Array.prototype.slice.call(from));
    };
    (function(ForceFlushState2) {
      ForceFlushState2[ForceFlushState2["resolved"] = 0] = "resolved";
      ForceFlushState2[ForceFlushState2["timeout"] = 1] = "timeout";
      ForceFlushState2[ForceFlushState2["error"] = 2] = "error";
      ForceFlushState2[ForceFlushState2["unresolved"] = 3] = "unresolved";
    })(ForceFlushState || (ForceFlushState = {}));
    BasicTracerProvider = /** @class */
    (function() {
      function BasicTracerProvider2(config) {
        if (config === void 0) {
          config = {};
        }
        var _a, _b;
        this._registeredSpanProcessors = [];
        this._tracers = /* @__PURE__ */ new Map();
        var mergedConfig = merge({}, loadDefaultConfig(), reconfigureLimits(config));
        this.resource = (_a = mergedConfig.resource) !== null && _a !== void 0 ? _a : Resource2.empty();
        if (mergedConfig.mergeResourceWithDefaults) {
          this.resource = Resource2.default().merge(this.resource);
        }
        this._config = Object.assign({}, mergedConfig, {
          resource: this.resource
        });
        if ((_b = config.spanProcessors) === null || _b === void 0 ? void 0 : _b.length) {
          this._registeredSpanProcessors = __spreadArray2([], __read5(config.spanProcessors), false);
          this.activeSpanProcessor = new MultiSpanProcessor(this._registeredSpanProcessors);
        } else {
          var defaultExporter = this._buildExporterFromEnv();
          if (defaultExporter !== void 0) {
            var batchProcessor = new BatchSpanProcessor(defaultExporter);
            this.activeSpanProcessor = batchProcessor;
          } else {
            this.activeSpanProcessor = new NoopSpanProcessor();
          }
        }
      }
      BasicTracerProvider2.prototype.getTracer = function(name, version, options) {
        var key = name + "@" + (version || "") + ":" + ((options === null || options === void 0 ? void 0 : options.schemaUrl) || "");
        if (!this._tracers.has(key)) {
          this._tracers.set(key, new Tracer({ name, version, schemaUrl: options === null || options === void 0 ? void 0 : options.schemaUrl }, this._config, this));
        }
        return this._tracers.get(key);
      };
      BasicTracerProvider2.prototype.addSpanProcessor = function(spanProcessor) {
        if (this._registeredSpanProcessors.length === 0) {
          this.activeSpanProcessor.shutdown().catch(function(err) {
            return diag7.error("Error while trying to shutdown current span processor", err);
          });
        }
        this._registeredSpanProcessors.push(spanProcessor);
        this.activeSpanProcessor = new MultiSpanProcessor(this._registeredSpanProcessors);
      };
      BasicTracerProvider2.prototype.getActiveSpanProcessor = function() {
        return this.activeSpanProcessor;
      };
      BasicTracerProvider2.prototype.register = function(config) {
        if (config === void 0) {
          config = {};
        }
        trace7.setGlobalTracerProvider(this);
        if (config.propagator === void 0) {
          config.propagator = this._buildPropagatorFromEnv();
        }
        if (config.contextManager) {
          context6.setGlobalContextManager(config.contextManager);
        }
        if (config.propagator) {
          propagation2.setGlobalPropagator(config.propagator);
        }
      };
      BasicTracerProvider2.prototype.forceFlush = function() {
        var timeout = this._config.forceFlushTimeoutMillis;
        var promises = this._registeredSpanProcessors.map(function(spanProcessor) {
          return new Promise(function(resolve) {
            var state;
            var timeoutInterval = setTimeout(function() {
              resolve(new Error("Span processor did not completed within timeout period of " + timeout + " ms"));
              state = ForceFlushState.timeout;
            }, timeout);
            spanProcessor.forceFlush().then(function() {
              clearTimeout(timeoutInterval);
              if (state !== ForceFlushState.timeout) {
                state = ForceFlushState.resolved;
                resolve(state);
              }
            }).catch(function(error) {
              clearTimeout(timeoutInterval);
              state = ForceFlushState.error;
              resolve(error);
            });
          });
        });
        return new Promise(function(resolve, reject) {
          Promise.all(promises).then(function(results) {
            var errors = results.filter(function(result) {
              return result !== ForceFlushState.resolved;
            });
            if (errors.length > 0) {
              reject(errors);
            } else {
              resolve();
            }
          }).catch(function(error) {
            return reject([error]);
          });
        });
      };
      BasicTracerProvider2.prototype.shutdown = function() {
        return this.activeSpanProcessor.shutdown();
      };
      BasicTracerProvider2.prototype._getPropagator = function(name) {
        var _a;
        return (_a = this.constructor._registeredPropagators.get(name)) === null || _a === void 0 ? void 0 : _a();
      };
      BasicTracerProvider2.prototype._getSpanExporter = function(name) {
        var _a;
        return (_a = this.constructor._registeredExporters.get(name)) === null || _a === void 0 ? void 0 : _a();
      };
      BasicTracerProvider2.prototype._buildPropagatorFromEnv = function() {
        var _this = this;
        var uniquePropagatorNames = Array.from(new Set(getEnv3().OTEL_PROPAGATORS));
        var propagators = uniquePropagatorNames.map(function(name) {
          var propagator = _this._getPropagator(name);
          if (!propagator) {
            diag7.warn('Propagator "' + name + '" requested through environment variable is unavailable.');
          }
          return propagator;
        });
        var validPropagators = propagators.reduce(function(list, item) {
          if (item) {
            list.push(item);
          }
          return list;
        }, []);
        if (validPropagators.length === 0) {
          return;
        } else if (uniquePropagatorNames.length === 1) {
          return validPropagators[0];
        } else {
          return new CompositePropagator({
            propagators: validPropagators
          });
        }
      };
      BasicTracerProvider2.prototype._buildExporterFromEnv = function() {
        var exporterName = getEnv3().OTEL_TRACES_EXPORTER;
        if (exporterName === "none" || exporterName === "")
          return;
        var exporter = this._getSpanExporter(exporterName);
        if (!exporter) {
          diag7.error('Exporter "' + exporterName + '" requested through environment variable is unavailable.');
        }
        return exporter;
      };
      BasicTracerProvider2._registeredPropagators = /* @__PURE__ */ new Map([
        ["tracecontext", function() {
          return new W3CTraceContextPropagator();
        }],
        ["baggage", function() {
          return new W3CBaggagePropagator();
        }]
      ]);
      BasicTracerProvider2._registeredExporters = /* @__PURE__ */ new Map();
      return BasicTracerProvider2;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/export/ConsoleSpanExporter.js
import { ExportResultCode as ExportResultCode2, hrTimeToMicroseconds } from "@opentelemetry/core";
var __values3, ConsoleSpanExporter;
var init_ConsoleSpanExporter = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/export/ConsoleSpanExporter.js"() {
    "use strict";
    __values3 = function(o) {
      var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
      if (m) return m.call(o);
      if (o && typeof o.length === "number") return {
        next: function() {
          if (o && i >= o.length) o = void 0;
          return { value: o && o[i++], done: !o };
        }
      };
      throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    ConsoleSpanExporter = /** @class */
    (function() {
      function ConsoleSpanExporter2() {
      }
      ConsoleSpanExporter2.prototype.export = function(spans, resultCallback) {
        return this._sendSpans(spans, resultCallback);
      };
      ConsoleSpanExporter2.prototype.shutdown = function() {
        this._sendSpans([]);
        return this.forceFlush();
      };
      ConsoleSpanExporter2.prototype.forceFlush = function() {
        return Promise.resolve();
      };
      ConsoleSpanExporter2.prototype._exportInfo = function(span) {
        var _a;
        return {
          resource: {
            attributes: span.resource.attributes
          },
          instrumentationScope: span.instrumentationLibrary,
          traceId: span.spanContext().traceId,
          parentId: span.parentSpanId,
          traceState: (_a = span.spanContext().traceState) === null || _a === void 0 ? void 0 : _a.serialize(),
          name: span.name,
          id: span.spanContext().spanId,
          kind: span.kind,
          timestamp: hrTimeToMicroseconds(span.startTime),
          duration: hrTimeToMicroseconds(span.duration),
          attributes: span.attributes,
          status: span.status,
          events: span.events,
          links: span.links
        };
      };
      ConsoleSpanExporter2.prototype._sendSpans = function(spans, done) {
        var e_1, _a;
        try {
          for (var spans_1 = __values3(spans), spans_1_1 = spans_1.next(); !spans_1_1.done; spans_1_1 = spans_1.next()) {
            var span = spans_1_1.value;
            console.dir(this._exportInfo(span), { depth: 3 });
          }
        } catch (e_1_1) {
          e_1 = { error: e_1_1 };
        } finally {
          try {
            if (spans_1_1 && !spans_1_1.done && (_a = spans_1.return)) _a.call(spans_1);
          } finally {
            if (e_1) throw e_1.error;
          }
        }
        if (done) {
          return done({ code: ExportResultCode2.SUCCESS });
        }
      };
      return ConsoleSpanExporter2;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/export/InMemorySpanExporter.js
import { ExportResultCode as ExportResultCode3 } from "@opentelemetry/core";
var __read6, __spreadArray3, InMemorySpanExporter;
var init_InMemorySpanExporter = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/export/InMemorySpanExporter.js"() {
    "use strict";
    __read6 = function(o, n) {
      var m = typeof Symbol === "function" && o[Symbol.iterator];
      if (!m) return o;
      var i = m.call(o), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m = i["return"])) m.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    __spreadArray3 = function(to, from, pack) {
      if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
      return to.concat(ar || Array.prototype.slice.call(from));
    };
    InMemorySpanExporter = /** @class */
    (function() {
      function InMemorySpanExporter2() {
        this._finishedSpans = [];
        this._stopped = false;
      }
      InMemorySpanExporter2.prototype.export = function(spans, resultCallback) {
        var _a;
        if (this._stopped)
          return resultCallback({
            code: ExportResultCode3.FAILED,
            error: new Error("Exporter has been stopped")
          });
        (_a = this._finishedSpans).push.apply(_a, __spreadArray3([], __read6(spans), false));
        setTimeout(function() {
          return resultCallback({ code: ExportResultCode3.SUCCESS });
        }, 0);
      };
      InMemorySpanExporter2.prototype.shutdown = function() {
        this._stopped = true;
        this._finishedSpans = [];
        return this.forceFlush();
      };
      InMemorySpanExporter2.prototype.forceFlush = function() {
        return Promise.resolve();
      };
      InMemorySpanExporter2.prototype.reset = function() {
        this._finishedSpans = [];
      };
      InMemorySpanExporter2.prototype.getFinishedSpans = function() {
        return this._finishedSpans;
      };
      return InMemorySpanExporter2;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/export/SimpleSpanProcessor.js
import { TraceFlags as TraceFlags6 } from "@opentelemetry/api";
import { internal, ExportResultCode as ExportResultCode4, globalErrorHandler as globalErrorHandler4, BindOnceFuture as BindOnceFuture2 } from "@opentelemetry/core";
var __awaiter3, __generator3, SimpleSpanProcessor;
var init_SimpleSpanProcessor = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/export/SimpleSpanProcessor.js"() {
    "use strict";
    __awaiter3 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    __generator3 = function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    SimpleSpanProcessor = /** @class */
    (function() {
      function SimpleSpanProcessor3(_exporter) {
        this._exporter = _exporter;
        this._shutdownOnce = new BindOnceFuture2(this._shutdown, this);
        this._unresolvedExports = /* @__PURE__ */ new Set();
      }
      SimpleSpanProcessor3.prototype.forceFlush = function() {
        return __awaiter3(this, void 0, void 0, function() {
          return __generator3(this, function(_a) {
            switch (_a.label) {
              case 0:
                return [4, Promise.all(Array.from(this._unresolvedExports))];
              case 1:
                _a.sent();
                if (!this._exporter.forceFlush) return [3, 3];
                return [4, this._exporter.forceFlush()];
              case 2:
                _a.sent();
                _a.label = 3;
              case 3:
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      SimpleSpanProcessor3.prototype.onStart = function(_span, _parentContext) {
      };
      SimpleSpanProcessor3.prototype.onEnd = function(span) {
        var _this = this;
        var _a, _b;
        if (this._shutdownOnce.isCalled) {
          return;
        }
        if ((span.spanContext().traceFlags & TraceFlags6.SAMPLED) === 0) {
          return;
        }
        var doExport = function() {
          return internal._export(_this._exporter, [span]).then(function(result) {
            var _a2;
            if (result.code !== ExportResultCode4.SUCCESS) {
              globalErrorHandler4((_a2 = result.error) !== null && _a2 !== void 0 ? _a2 : new Error("SimpleSpanProcessor: span export failed (status " + result + ")"));
            }
          }).catch(function(error) {
            globalErrorHandler4(error);
          });
        };
        if (span.resource.asyncAttributesPending) {
          var exportPromise_1 = (_b = (_a = span.resource).waitForAsyncAttributes) === null || _b === void 0 ? void 0 : _b.call(_a).then(function() {
            if (exportPromise_1 != null) {
              _this._unresolvedExports.delete(exportPromise_1);
            }
            return doExport();
          }, function(err) {
            return globalErrorHandler4(err);
          });
          if (exportPromise_1 != null) {
            this._unresolvedExports.add(exportPromise_1);
          }
        } else {
          void doExport();
        }
      };
      SimpleSpanProcessor3.prototype.shutdown = function() {
        return this._shutdownOnce.call();
      };
      SimpleSpanProcessor3.prototype._shutdown = function() {
        return this._exporter.shutdown();
      };
      return SimpleSpanProcessor3;
    })();
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/esm/index.js
var esm_exports2 = {};
__export(esm_exports2, {
  AlwaysOffSampler: () => AlwaysOffSampler,
  AlwaysOnSampler: () => AlwaysOnSampler,
  BasicTracerProvider: () => BasicTracerProvider,
  BatchSpanProcessor: () => BatchSpanProcessor,
  ConsoleSpanExporter: () => ConsoleSpanExporter,
  ForceFlushState: () => ForceFlushState,
  InMemorySpanExporter: () => InMemorySpanExporter,
  NoopSpanProcessor: () => NoopSpanProcessor,
  ParentBasedSampler: () => ParentBasedSampler,
  RandomIdGenerator: () => RandomIdGenerator,
  SamplingDecision: () => SamplingDecision,
  SimpleSpanProcessor: () => SimpleSpanProcessor,
  Span: () => Span2,
  TraceIdRatioBasedSampler: () => TraceIdRatioBasedSampler,
  Tracer: () => Tracer
});
var init_esm3 = __esm({
  "node_modules/@opentelemetry/sdk-trace-base/build/esm/index.js"() {
    "use strict";
    init_Tracer();
    init_BasicTracerProvider();
    init_platform();
    init_ConsoleSpanExporter();
    init_InMemorySpanExporter();
    init_SimpleSpanProcessor();
    init_NoopSpanProcessor();
    init_AlwaysOffSampler();
    init_AlwaysOnSampler();
    init_ParentBasedSampler();
    init_TraceIdRatioBasedSampler();
    init_Sampler();
    init_Span();
  }
});

// node_modules/semver/internal/constants.js
var require_constants = __commonJS({
  "node_modules/semver/internal/constants.js"(exports, module) {
    "use strict";
    var SEMVER_SPEC_VERSION = "2.0.0";
    var MAX_LENGTH = 256;
    var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
    9007199254740991;
    var MAX_SAFE_COMPONENT_LENGTH = 16;
    var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
    var RELEASE_TYPES = [
      "major",
      "premajor",
      "minor",
      "preminor",
      "patch",
      "prepatch",
      "prerelease"
    ];
    module.exports = {
      MAX_LENGTH,
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_SAFE_INTEGER,
      RELEASE_TYPES,
      SEMVER_SPEC_VERSION,
      FLAG_INCLUDE_PRERELEASE: 1,
      FLAG_LOOSE: 2
    };
  }
});

// node_modules/semver/internal/debug.js
var require_debug = __commonJS({
  "node_modules/semver/internal/debug.js"(exports, module) {
    "use strict";
    var debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
    };
    module.exports = debug;
  }
});

// node_modules/semver/internal/re.js
var require_re = __commonJS({
  "node_modules/semver/internal/re.js"(exports, module) {
    "use strict";
    var {
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_LENGTH
    } = require_constants();
    var debug = require_debug();
    exports = module.exports = {};
    var re = exports.re = [];
    var safeRe = exports.safeRe = [];
    var src = exports.src = [];
    var safeSrc = exports.safeSrc = [];
    var t = exports.t = {};
    var R = 0;
    var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    var safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    var makeSafeRegex = (value) => {
      for (const [token, max] of safeRegexReplacements) {
        value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
      }
      return value;
    };
    var createToken = (name, value, isGlobal) => {
      const safe = makeSafeRegex(value);
      const index = R++;
      debug(name, index, value);
      t[name] = index;
      src[index] = value;
      safeSrc[index] = safe;
      re[index] = new RegExp(value, isGlobal ? "g" : void 0);
      safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
    };
    createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
    createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
    createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
    createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
    createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
    createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
    createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
    createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
    createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
    createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
    createToken("FULL", `^${src[t.FULLPLAIN]}$`);
    createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
    createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
    createToken("GTLT", "((?:<|>)?=?)");
    createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
    createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
    createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
    createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COERCEPLAIN", `${"(^|[^\\d])(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
    createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
    createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
    createToken("COERCERTL", src[t.COERCE], true);
    createToken("COERCERTLFULL", src[t.COERCEFULL], true);
    createToken("LONETILDE", "(?:~>?)");
    createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
    exports.tildeTrimReplace = "$1~";
    createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
    createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("LONECARET", "(?:\\^)");
    createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
    exports.caretTrimReplace = "$1^";
    createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
    createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
    createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
    createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
    exports.comparatorTrimReplace = "$1$2$3";
    createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
    createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
    createToken("STAR", "(<|>)?=?\\s*\\*");
    createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
    createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  }
});

// node_modules/semver/internal/parse-options.js
var require_parse_options = __commonJS({
  "node_modules/semver/internal/parse-options.js"(exports, module) {
    "use strict";
    var looseOption = Object.freeze({ loose: true });
    var emptyOpts = Object.freeze({});
    var parseOptions = (options) => {
      if (!options) {
        return emptyOpts;
      }
      if (typeof options !== "object") {
        return looseOption;
      }
      return options;
    };
    module.exports = parseOptions;
  }
});

// node_modules/semver/internal/identifiers.js
var require_identifiers = __commonJS({
  "node_modules/semver/internal/identifiers.js"(exports, module) {
    "use strict";
    var numeric = /^[0-9]+$/;
    var compareIdentifiers = (a, b) => {
      if (typeof a === "number" && typeof b === "number") {
        return a === b ? 0 : a < b ? -1 : 1;
      }
      const anum = numeric.test(a);
      const bnum = numeric.test(b);
      if (anum && bnum) {
        a = +a;
        b = +b;
      }
      return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
    };
    var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
    module.exports = {
      compareIdentifiers,
      rcompareIdentifiers
    };
  }
});

// node_modules/semver/classes/semver.js
var require_semver = __commonJS({
  "node_modules/semver/classes/semver.js"(exports, module) {
    "use strict";
    var debug = require_debug();
    var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
    var { safeRe: re, t } = require_re();
    var parseOptions = require_parse_options();
    var { compareIdentifiers } = require_identifiers();
    var SemVer = class _SemVer {
      constructor(version, options) {
        options = parseOptions(options);
        if (version instanceof _SemVer) {
          if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
            return version;
          } else {
            version = version.version;
          }
        } else if (typeof version !== "string") {
          throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
        }
        if (version.length > MAX_LENGTH) {
          throw new TypeError(
            `version is longer than ${MAX_LENGTH} characters`
          );
        }
        debug("SemVer", version, options);
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
        if (!m) {
          throw new TypeError(`Invalid Version: ${version}`);
        }
        this.raw = version;
        this.major = +m[1];
        this.minor = +m[2];
        this.patch = +m[3];
        if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
          throw new TypeError("Invalid major version");
        }
        if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
          throw new TypeError("Invalid minor version");
        }
        if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
          throw new TypeError("Invalid patch version");
        }
        if (!m[4]) {
          this.prerelease = [];
        } else {
          this.prerelease = m[4].split(".").map((id) => {
            if (/^[0-9]+$/.test(id)) {
              const num = +id;
              if (num >= 0 && num < MAX_SAFE_INTEGER) {
                return num;
              }
            }
            return id;
          });
        }
        this.build = m[5] ? m[5].split(".") : [];
        this.format();
      }
      format() {
        this.version = `${this.major}.${this.minor}.${this.patch}`;
        if (this.prerelease.length) {
          this.version += `-${this.prerelease.join(".")}`;
        }
        return this.version;
      }
      toString() {
        return this.version;
      }
      compare(other) {
        debug("SemVer.compare", this.version, this.options, other);
        if (!(other instanceof _SemVer)) {
          if (typeof other === "string" && other === this.version) {
            return 0;
          }
          other = new _SemVer(other, this.options);
        }
        if (other.version === this.version) {
          return 0;
        }
        return this.compareMain(other) || this.comparePre(other);
      }
      compareMain(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.major < other.major) {
          return -1;
        }
        if (this.major > other.major) {
          return 1;
        }
        if (this.minor < other.minor) {
          return -1;
        }
        if (this.minor > other.minor) {
          return 1;
        }
        if (this.patch < other.patch) {
          return -1;
        }
        if (this.patch > other.patch) {
          return 1;
        }
        return 0;
      }
      comparePre(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.prerelease.length && !other.prerelease.length) {
          return -1;
        } else if (!this.prerelease.length && other.prerelease.length) {
          return 1;
        } else if (!this.prerelease.length && !other.prerelease.length) {
          return 0;
        }
        let i = 0;
        do {
          const a = this.prerelease[i];
          const b = other.prerelease[i];
          debug("prerelease compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      compareBuild(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        let i = 0;
        do {
          const a = this.build[i];
          const b = other.build[i];
          debug("build compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      // preminor will bump the version up to the next minor release, and immediately
      // down to pre-release. premajor and prepatch work the same way.
      inc(release, identifier, identifierBase) {
        if (release.startsWith("pre")) {
          if (!identifier && identifierBase === false) {
            throw new Error("invalid increment argument: identifier is empty");
          }
          if (identifier) {
            const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
            if (!match || match[1] !== identifier) {
              throw new Error(`invalid identifier: ${identifier}`);
            }
          }
        }
        switch (release) {
          case "premajor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor = 0;
            this.major++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "preminor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "prepatch":
            this.prerelease.length = 0;
            this.inc("patch", identifier, identifierBase);
            this.inc("pre", identifier, identifierBase);
            break;
          // If the input is a non-prerelease version, this acts the same as
          // prepatch.
          case "prerelease":
            if (this.prerelease.length === 0) {
              this.inc("patch", identifier, identifierBase);
            }
            this.inc("pre", identifier, identifierBase);
            break;
          case "release":
            if (this.prerelease.length === 0) {
              throw new Error(`version ${this.raw} is not a prerelease`);
            }
            this.prerelease.length = 0;
            break;
          case "major":
            if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
              this.major++;
            }
            this.minor = 0;
            this.patch = 0;
            this.prerelease = [];
            break;
          case "minor":
            if (this.patch !== 0 || this.prerelease.length === 0) {
              this.minor++;
            }
            this.patch = 0;
            this.prerelease = [];
            break;
          case "patch":
            if (this.prerelease.length === 0) {
              this.patch++;
            }
            this.prerelease = [];
            break;
          // This probably shouldn't be used publicly.
          // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
          case "pre": {
            const base = Number(identifierBase) ? 1 : 0;
            if (this.prerelease.length === 0) {
              this.prerelease = [base];
            } else {
              let i = this.prerelease.length;
              while (--i >= 0) {
                if (typeof this.prerelease[i] === "number") {
                  this.prerelease[i]++;
                  i = -2;
                }
              }
              if (i === -1) {
                if (identifier === this.prerelease.join(".") && identifierBase === false) {
                  throw new Error("invalid increment argument: identifier already exists");
                }
                this.prerelease.push(base);
              }
            }
            if (identifier) {
              let prerelease = [identifier, base];
              if (identifierBase === false) {
                prerelease = [identifier];
              }
              if (compareIdentifiers(this.prerelease[0], identifier) === 0) {
                if (isNaN(this.prerelease[1])) {
                  this.prerelease = prerelease;
                }
              } else {
                this.prerelease = prerelease;
              }
            }
            break;
          }
          default:
            throw new Error(`invalid increment argument: ${release}`);
        }
        this.raw = this.format();
        if (this.build.length) {
          this.raw += `+${this.build.join(".")}`;
        }
        return this;
      }
    };
    module.exports = SemVer;
  }
});

// node_modules/semver/functions/parse.js
var require_parse = __commonJS({
  "node_modules/semver/functions/parse.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var parse = (version, options, throwErrors = false) => {
      if (version instanceof SemVer) {
        return version;
      }
      try {
        return new SemVer(version, options);
      } catch (er) {
        if (!throwErrors) {
          return null;
        }
        throw er;
      }
    };
    module.exports = parse;
  }
});

// node_modules/semver/functions/valid.js
var require_valid = __commonJS({
  "node_modules/semver/functions/valid.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var valid = (version, options) => {
      const v = parse(version, options);
      return v ? v.version : null;
    };
    module.exports = valid;
  }
});

// node_modules/semver/functions/clean.js
var require_clean = __commonJS({
  "node_modules/semver/functions/clean.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var clean = (version, options) => {
      const s = parse(version.trim().replace(/^[=v]+/, ""), options);
      return s ? s.version : null;
    };
    module.exports = clean;
  }
});

// node_modules/semver/functions/inc.js
var require_inc = __commonJS({
  "node_modules/semver/functions/inc.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var inc = (version, release, options, identifier, identifierBase) => {
      if (typeof options === "string") {
        identifierBase = identifier;
        identifier = options;
        options = void 0;
      }
      try {
        return new SemVer(
          version instanceof SemVer ? version.version : version,
          options
        ).inc(release, identifier, identifierBase).version;
      } catch (er) {
        return null;
      }
    };
    module.exports = inc;
  }
});

// node_modules/semver/functions/diff.js
var require_diff = __commonJS({
  "node_modules/semver/functions/diff.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var diff = (version1, version2) => {
      const v1 = parse(version1, null, true);
      const v2 = parse(version2, null, true);
      const comparison = v1.compare(v2);
      if (comparison === 0) {
        return null;
      }
      const v1Higher = comparison > 0;
      const highVersion = v1Higher ? v1 : v2;
      const lowVersion = v1Higher ? v2 : v1;
      const highHasPre = !!highVersion.prerelease.length;
      const lowHasPre = !!lowVersion.prerelease.length;
      if (lowHasPre && !highHasPre) {
        if (!lowVersion.patch && !lowVersion.minor) {
          return "major";
        }
        if (lowVersion.compareMain(highVersion) === 0) {
          if (lowVersion.minor && !lowVersion.patch) {
            return "minor";
          }
          return "patch";
        }
      }
      const prefix = highHasPre ? "pre" : "";
      if (v1.major !== v2.major) {
        return prefix + "major";
      }
      if (v1.minor !== v2.minor) {
        return prefix + "minor";
      }
      if (v1.patch !== v2.patch) {
        return prefix + "patch";
      }
      return "prerelease";
    };
    module.exports = diff;
  }
});

// node_modules/semver/functions/major.js
var require_major = __commonJS({
  "node_modules/semver/functions/major.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var major = (a, loose) => new SemVer(a, loose).major;
    module.exports = major;
  }
});

// node_modules/semver/functions/minor.js
var require_minor = __commonJS({
  "node_modules/semver/functions/minor.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var minor = (a, loose) => new SemVer(a, loose).minor;
    module.exports = minor;
  }
});

// node_modules/semver/functions/patch.js
var require_patch = __commonJS({
  "node_modules/semver/functions/patch.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var patch = (a, loose) => new SemVer(a, loose).patch;
    module.exports = patch;
  }
});

// node_modules/semver/functions/prerelease.js
var require_prerelease = __commonJS({
  "node_modules/semver/functions/prerelease.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var prerelease = (version, options) => {
      const parsed = parse(version, options);
      return parsed && parsed.prerelease.length ? parsed.prerelease : null;
    };
    module.exports = prerelease;
  }
});

// node_modules/semver/functions/compare.js
var require_compare = __commonJS({
  "node_modules/semver/functions/compare.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
    module.exports = compare;
  }
});

// node_modules/semver/functions/rcompare.js
var require_rcompare = __commonJS({
  "node_modules/semver/functions/rcompare.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var rcompare = (a, b, loose) => compare(b, a, loose);
    module.exports = rcompare;
  }
});

// node_modules/semver/functions/compare-loose.js
var require_compare_loose = __commonJS({
  "node_modules/semver/functions/compare-loose.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var compareLoose = (a, b) => compare(a, b, true);
    module.exports = compareLoose;
  }
});

// node_modules/semver/functions/compare-build.js
var require_compare_build = __commonJS({
  "node_modules/semver/functions/compare-build.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var compareBuild = (a, b, loose) => {
      const versionA = new SemVer(a, loose);
      const versionB = new SemVer(b, loose);
      return versionA.compare(versionB) || versionA.compareBuild(versionB);
    };
    module.exports = compareBuild;
  }
});

// node_modules/semver/functions/sort.js
var require_sort = __commonJS({
  "node_modules/semver/functions/sort.js"(exports, module) {
    "use strict";
    var compareBuild = require_compare_build();
    var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
    module.exports = sort;
  }
});

// node_modules/semver/functions/rsort.js
var require_rsort = __commonJS({
  "node_modules/semver/functions/rsort.js"(exports, module) {
    "use strict";
    var compareBuild = require_compare_build();
    var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
    module.exports = rsort;
  }
});

// node_modules/semver/functions/gt.js
var require_gt = __commonJS({
  "node_modules/semver/functions/gt.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var gt = (a, b, loose) => compare(a, b, loose) > 0;
    module.exports = gt;
  }
});

// node_modules/semver/functions/lt.js
var require_lt = __commonJS({
  "node_modules/semver/functions/lt.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var lt = (a, b, loose) => compare(a, b, loose) < 0;
    module.exports = lt;
  }
});

// node_modules/semver/functions/eq.js
var require_eq = __commonJS({
  "node_modules/semver/functions/eq.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var eq = (a, b, loose) => compare(a, b, loose) === 0;
    module.exports = eq;
  }
});

// node_modules/semver/functions/neq.js
var require_neq = __commonJS({
  "node_modules/semver/functions/neq.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var neq = (a, b, loose) => compare(a, b, loose) !== 0;
    module.exports = neq;
  }
});

// node_modules/semver/functions/gte.js
var require_gte = __commonJS({
  "node_modules/semver/functions/gte.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var gte = (a, b, loose) => compare(a, b, loose) >= 0;
    module.exports = gte;
  }
});

// node_modules/semver/functions/lte.js
var require_lte = __commonJS({
  "node_modules/semver/functions/lte.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var lte = (a, b, loose) => compare(a, b, loose) <= 0;
    module.exports = lte;
  }
});

// node_modules/semver/functions/cmp.js
var require_cmp = __commonJS({
  "node_modules/semver/functions/cmp.js"(exports, module) {
    "use strict";
    var eq = require_eq();
    var neq = require_neq();
    var gt = require_gt();
    var gte = require_gte();
    var lt = require_lt();
    var lte = require_lte();
    var cmp = (a, op, b, loose) => {
      switch (op) {
        case "===":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a === b;
        case "!==":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a !== b;
        case "":
        case "=":
        case "==":
          return eq(a, b, loose);
        case "!=":
          return neq(a, b, loose);
        case ">":
          return gt(a, b, loose);
        case ">=":
          return gte(a, b, loose);
        case "<":
          return lt(a, b, loose);
        case "<=":
          return lte(a, b, loose);
        default:
          throw new TypeError(`Invalid operator: ${op}`);
      }
    };
    module.exports = cmp;
  }
});

// node_modules/semver/functions/coerce.js
var require_coerce = __commonJS({
  "node_modules/semver/functions/coerce.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var parse = require_parse();
    var { safeRe: re, t } = require_re();
    var coerce = (version, options) => {
      if (version instanceof SemVer) {
        return version;
      }
      if (typeof version === "number") {
        version = String(version);
      }
      if (typeof version !== "string") {
        return null;
      }
      options = options || {};
      let match = null;
      if (!options.rtl) {
        match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
      } else {
        const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
        let next;
        while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
          if (!match || next.index + next[0].length !== match.index + match[0].length) {
            match = next;
          }
          coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
        }
        coerceRtlRegex.lastIndex = -1;
      }
      if (match === null) {
        return null;
      }
      const major = match[2];
      const minor = match[3] || "0";
      const patch = match[4] || "0";
      const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
      const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
      return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
    };
    module.exports = coerce;
  }
});

// node_modules/semver/internal/lrucache.js
var require_lrucache = __commonJS({
  "node_modules/semver/internal/lrucache.js"(exports, module) {
    "use strict";
    var LRUCache = class {
      constructor() {
        this.max = 1e3;
        this.map = /* @__PURE__ */ new Map();
      }
      get(key) {
        const value = this.map.get(key);
        if (value === void 0) {
          return void 0;
        } else {
          this.map.delete(key);
          this.map.set(key, value);
          return value;
        }
      }
      delete(key) {
        return this.map.delete(key);
      }
      set(key, value) {
        const deleted = this.delete(key);
        if (!deleted && value !== void 0) {
          if (this.map.size >= this.max) {
            const firstKey = this.map.keys().next().value;
            this.delete(firstKey);
          }
          this.map.set(key, value);
        }
        return this;
      }
    };
    module.exports = LRUCache;
  }
});

// node_modules/semver/classes/range.js
var require_range = __commonJS({
  "node_modules/semver/classes/range.js"(exports, module) {
    "use strict";
    var SPACE_CHARACTERS = /\s+/g;
    var Range = class _Range {
      constructor(range, options) {
        options = parseOptions(options);
        if (range instanceof _Range) {
          if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
            return range;
          } else {
            return new _Range(range.raw, options);
          }
        }
        if (range instanceof Comparator) {
          this.raw = range.value;
          this.set = [[range]];
          this.formatted = void 0;
          return this;
        }
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
        this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
        if (!this.set.length) {
          throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
        }
        if (this.set.length > 1) {
          const first = this.set[0];
          this.set = this.set.filter((c) => !isNullSet(c[0]));
          if (this.set.length === 0) {
            this.set = [first];
          } else if (this.set.length > 1) {
            for (const c of this.set) {
              if (c.length === 1 && isAny(c[0])) {
                this.set = [c];
                break;
              }
            }
          }
        }
        this.formatted = void 0;
      }
      get range() {
        if (this.formatted === void 0) {
          this.formatted = "";
          for (let i = 0; i < this.set.length; i++) {
            if (i > 0) {
              this.formatted += "||";
            }
            const comps = this.set[i];
            for (let k = 0; k < comps.length; k++) {
              if (k > 0) {
                this.formatted += " ";
              }
              this.formatted += comps[k].toString().trim();
            }
          }
        }
        return this.formatted;
      }
      format() {
        return this.range;
      }
      toString() {
        return this.range;
      }
      parseRange(range) {
        const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
        const memoKey = memoOpts + ":" + range;
        const cached = cache.get(memoKey);
        if (cached) {
          return cached;
        }
        const loose = this.options.loose;
        const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
        range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
        debug("hyphen replace", range);
        range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
        debug("comparator trim", range);
        range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
        debug("tilde trim", range);
        range = range.replace(re[t.CARETTRIM], caretTrimReplace);
        debug("caret trim", range);
        let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
        if (loose) {
          rangeList = rangeList.filter((comp) => {
            debug("loose invalid filter", comp, this.options);
            return !!comp.match(re[t.COMPARATORLOOSE]);
          });
        }
        debug("range list", rangeList);
        const rangeMap = /* @__PURE__ */ new Map();
        const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
        for (const comp of comparators) {
          if (isNullSet(comp)) {
            return [comp];
          }
          rangeMap.set(comp.value, comp);
        }
        if (rangeMap.size > 1 && rangeMap.has("")) {
          rangeMap.delete("");
        }
        const result = [...rangeMap.values()];
        cache.set(memoKey, result);
        return result;
      }
      intersects(range, options) {
        if (!(range instanceof _Range)) {
          throw new TypeError("a Range is required");
        }
        return this.set.some((thisComparators) => {
          return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
            return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
              return rangeComparators.every((rangeComparator) => {
                return thisComparator.intersects(rangeComparator, options);
              });
            });
          });
        });
      }
      // if ANY of the sets match ALL of its comparators, then pass
      test(version) {
        if (!version) {
          return false;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        for (let i = 0; i < this.set.length; i++) {
          if (testSet(this.set[i], version, this.options)) {
            return true;
          }
        }
        return false;
      }
    };
    module.exports = Range;
    var LRU = require_lrucache();
    var cache = new LRU();
    var parseOptions = require_parse_options();
    var Comparator = require_comparator();
    var debug = require_debug();
    var SemVer = require_semver();
    var {
      safeRe: re,
      t,
      comparatorTrimReplace,
      tildeTrimReplace,
      caretTrimReplace
    } = require_re();
    var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
    var isNullSet = (c) => c.value === "<0.0.0-0";
    var isAny = (c) => c.value === "";
    var isSatisfiable = (comparators, options) => {
      let result = true;
      const remainingComparators = comparators.slice();
      let testComparator = remainingComparators.pop();
      while (result && remainingComparators.length) {
        result = remainingComparators.every((otherComparator) => {
          return testComparator.intersects(otherComparator, options);
        });
        testComparator = remainingComparators.pop();
      }
      return result;
    };
    var parseComparator = (comp, options) => {
      comp = comp.replace(re[t.BUILD], "");
      debug("comp", comp, options);
      comp = replaceCarets(comp, options);
      debug("caret", comp);
      comp = replaceTildes(comp, options);
      debug("tildes", comp);
      comp = replaceXRanges(comp, options);
      debug("xrange", comp);
      comp = replaceStars(comp, options);
      debug("stars", comp);
      return comp;
    };
    var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
    var replaceTildes = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
    };
    var replaceTilde = (comp, options) => {
      const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("tilde", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
        } else if (pr) {
          debug("replaceTilde pr", pr);
          ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
        }
        debug("tilde return", ret);
        return ret;
      });
    };
    var replaceCarets = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
    };
    var replaceCaret = (comp, options) => {
      debug("caret", comp, options);
      const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("caret", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          if (M === "0") {
            ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
          } else {
            ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
          }
        } else if (pr) {
          debug("replaceCaret pr", pr);
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
          }
        } else {
          debug("no pr");
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
          }
        }
        debug("caret return", ret);
        return ret;
      });
    };
    var replaceXRanges = (comp, options) => {
      debug("replaceXRanges", comp, options);
      return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
    };
    var replaceXRange = (comp, options) => {
      comp = comp.trim();
      const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
      return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
        debug("xRange", comp, ret, gtlt, M, m, p, pr);
        const xM = isX(M);
        const xm = xM || isX(m);
        const xp = xm || isX(p);
        const anyX = xp;
        if (gtlt === "=" && anyX) {
          gtlt = "";
        }
        pr = options.includePrerelease ? "-0" : "";
        if (xM) {
          if (gtlt === ">" || gtlt === "<") {
            ret = "<0.0.0-0";
          } else {
            ret = "*";
          }
        } else if (gtlt && anyX) {
          if (xm) {
            m = 0;
          }
          p = 0;
          if (gtlt === ">") {
            gtlt = ">=";
            if (xm) {
              M = +M + 1;
              m = 0;
              p = 0;
            } else {
              m = +m + 1;
              p = 0;
            }
          } else if (gtlt === "<=") {
            gtlt = "<";
            if (xm) {
              M = +M + 1;
            } else {
              m = +m + 1;
            }
          }
          if (gtlt === "<") {
            pr = "-0";
          }
          ret = `${gtlt + M}.${m}.${p}${pr}`;
        } else if (xm) {
          ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
        } else if (xp) {
          ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
        }
        debug("xRange return", ret);
        return ret;
      });
    };
    var replaceStars = (comp, options) => {
      debug("replaceStars", comp, options);
      return comp.trim().replace(re[t.STAR], "");
    };
    var replaceGTE0 = (comp, options) => {
      debug("replaceGTE0", comp, options);
      return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
    };
    var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
      if (isX(fM)) {
        from = "";
      } else if (isX(fm)) {
        from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
      } else if (isX(fp)) {
        from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
      } else if (fpr) {
        from = `>=${from}`;
      } else {
        from = `>=${from}${incPr ? "-0" : ""}`;
      }
      if (isX(tM)) {
        to = "";
      } else if (isX(tm)) {
        to = `<${+tM + 1}.0.0-0`;
      } else if (isX(tp)) {
        to = `<${tM}.${+tm + 1}.0-0`;
      } else if (tpr) {
        to = `<=${tM}.${tm}.${tp}-${tpr}`;
      } else if (incPr) {
        to = `<${tM}.${tm}.${+tp + 1}-0`;
      } else {
        to = `<=${to}`;
      }
      return `${from} ${to}`.trim();
    };
    var testSet = (set, version, options) => {
      for (let i = 0; i < set.length; i++) {
        if (!set[i].test(version)) {
          return false;
        }
      }
      if (version.prerelease.length && !options.includePrerelease) {
        for (let i = 0; i < set.length; i++) {
          debug(set[i].semver);
          if (set[i].semver === Comparator.ANY) {
            continue;
          }
          if (set[i].semver.prerelease.length > 0) {
            const allowed = set[i].semver;
            if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
              return true;
            }
          }
        }
        return false;
      }
      return true;
    };
  }
});

// node_modules/semver/classes/comparator.js
var require_comparator = __commonJS({
  "node_modules/semver/classes/comparator.js"(exports, module) {
    "use strict";
    var ANY = /* @__PURE__ */ Symbol("SemVer ANY");
    var Comparator = class _Comparator {
      static get ANY() {
        return ANY;
      }
      constructor(comp, options) {
        options = parseOptions(options);
        if (comp instanceof _Comparator) {
          if (comp.loose === !!options.loose) {
            return comp;
          } else {
            comp = comp.value;
          }
        }
        comp = comp.trim().split(/\s+/).join(" ");
        debug("comparator", comp, options);
        this.options = options;
        this.loose = !!options.loose;
        this.parse(comp);
        if (this.semver === ANY) {
          this.value = "";
        } else {
          this.value = this.operator + this.semver.version;
        }
        debug("comp", this);
      }
      parse(comp) {
        const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
        const m = comp.match(r);
        if (!m) {
          throw new TypeError(`Invalid comparator: ${comp}`);
        }
        this.operator = m[1] !== void 0 ? m[1] : "";
        if (this.operator === "=") {
          this.operator = "";
        }
        if (!m[2]) {
          this.semver = ANY;
        } else {
          this.semver = new SemVer(m[2], this.options.loose);
        }
      }
      toString() {
        return this.value;
      }
      test(version) {
        debug("Comparator.test", version, this.options.loose);
        if (this.semver === ANY || version === ANY) {
          return true;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        return cmp(version, this.operator, this.semver, this.options);
      }
      intersects(comp, options) {
        if (!(comp instanceof _Comparator)) {
          throw new TypeError("a Comparator is required");
        }
        if (this.operator === "") {
          if (this.value === "") {
            return true;
          }
          return new Range(comp.value, options).test(this.value);
        } else if (comp.operator === "") {
          if (comp.value === "") {
            return true;
          }
          return new Range(this.value, options).test(comp.semver);
        }
        options = parseOptions(options);
        if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
          return false;
        }
        if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
          return false;
        }
        if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
          return true;
        }
        if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
          return true;
        }
        if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
          return true;
        }
        if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
          return true;
        }
        if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
          return true;
        }
        return false;
      }
    };
    module.exports = Comparator;
    var parseOptions = require_parse_options();
    var { safeRe: re, t } = require_re();
    var cmp = require_cmp();
    var debug = require_debug();
    var SemVer = require_semver();
    var Range = require_range();
  }
});

// node_modules/semver/functions/satisfies.js
var require_satisfies = __commonJS({
  "node_modules/semver/functions/satisfies.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var satisfies = (version, range, options) => {
      try {
        range = new Range(range, options);
      } catch (er) {
        return false;
      }
      return range.test(version);
    };
    module.exports = satisfies;
  }
});

// node_modules/semver/ranges/to-comparators.js
var require_to_comparators = __commonJS({
  "node_modules/semver/ranges/to-comparators.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
    module.exports = toComparators;
  }
});

// node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = __commonJS({
  "node_modules/semver/ranges/max-satisfying.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var maxSatisfying = (versions, range, options) => {
      let max = null;
      let maxSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!max || maxSV.compare(v) === -1) {
            max = v;
            maxSV = new SemVer(max, options);
          }
        }
      });
      return max;
    };
    module.exports = maxSatisfying;
  }
});

// node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = __commonJS({
  "node_modules/semver/ranges/min-satisfying.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var minSatisfying = (versions, range, options) => {
      let min = null;
      let minSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!min || minSV.compare(v) === 1) {
            min = v;
            minSV = new SemVer(min, options);
          }
        }
      });
      return min;
    };
    module.exports = minSatisfying;
  }
});

// node_modules/semver/ranges/min-version.js
var require_min_version = __commonJS({
  "node_modules/semver/ranges/min-version.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var gt = require_gt();
    var minVersion = (range, loose) => {
      range = new Range(range, loose);
      let minver = new SemVer("0.0.0");
      if (range.test(minver)) {
        return minver;
      }
      minver = new SemVer("0.0.0-0");
      if (range.test(minver)) {
        return minver;
      }
      minver = null;
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let setMin = null;
        comparators.forEach((comparator) => {
          const compver = new SemVer(comparator.semver.version);
          switch (comparator.operator) {
            case ">":
              if (compver.prerelease.length === 0) {
                compver.patch++;
              } else {
                compver.prerelease.push(0);
              }
              compver.raw = compver.format();
            /* fallthrough */
            case "":
            case ">=":
              if (!setMin || gt(compver, setMin)) {
                setMin = compver;
              }
              break;
            case "<":
            case "<=":
              break;
            /* istanbul ignore next */
            default:
              throw new Error(`Unexpected operation: ${comparator.operator}`);
          }
        });
        if (setMin && (!minver || gt(minver, setMin))) {
          minver = setMin;
        }
      }
      if (minver && range.test(minver)) {
        return minver;
      }
      return null;
    };
    module.exports = minVersion;
  }
});

// node_modules/semver/ranges/valid.js
var require_valid2 = __commonJS({
  "node_modules/semver/ranges/valid.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var validRange = (range, options) => {
      try {
        return new Range(range, options).range || "*";
      } catch (er) {
        return null;
      }
    };
    module.exports = validRange;
  }
});

// node_modules/semver/ranges/outside.js
var require_outside = __commonJS({
  "node_modules/semver/ranges/outside.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var Range = require_range();
    var satisfies = require_satisfies();
    var gt = require_gt();
    var lt = require_lt();
    var lte = require_lte();
    var gte = require_gte();
    var outside = (version, range, hilo, options) => {
      version = new SemVer(version, options);
      range = new Range(range, options);
      let gtfn, ltefn, ltfn, comp, ecomp;
      switch (hilo) {
        case ">":
          gtfn = gt;
          ltefn = lte;
          ltfn = lt;
          comp = ">";
          ecomp = ">=";
          break;
        case "<":
          gtfn = lt;
          ltefn = gte;
          ltfn = gt;
          comp = "<";
          ecomp = "<=";
          break;
        default:
          throw new TypeError('Must provide a hilo val of "<" or ">"');
      }
      if (satisfies(version, range, options)) {
        return false;
      }
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let high = null;
        let low = null;
        comparators.forEach((comparator) => {
          if (comparator.semver === ANY) {
            comparator = new Comparator(">=0.0.0");
          }
          high = high || comparator;
          low = low || comparator;
          if (gtfn(comparator.semver, high.semver, options)) {
            high = comparator;
          } else if (ltfn(comparator.semver, low.semver, options)) {
            low = comparator;
          }
        });
        if (high.operator === comp || high.operator === ecomp) {
          return false;
        }
        if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
          return false;
        } else if (low.operator === ecomp && ltfn(version, low.semver)) {
          return false;
        }
      }
      return true;
    };
    module.exports = outside;
  }
});

// node_modules/semver/ranges/gtr.js
var require_gtr = __commonJS({
  "node_modules/semver/ranges/gtr.js"(exports, module) {
    "use strict";
    var outside = require_outside();
    var gtr = (version, range, options) => outside(version, range, ">", options);
    module.exports = gtr;
  }
});

// node_modules/semver/ranges/ltr.js
var require_ltr = __commonJS({
  "node_modules/semver/ranges/ltr.js"(exports, module) {
    "use strict";
    var outside = require_outside();
    var ltr = (version, range, options) => outside(version, range, "<", options);
    module.exports = ltr;
  }
});

// node_modules/semver/ranges/intersects.js
var require_intersects = __commonJS({
  "node_modules/semver/ranges/intersects.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var intersects = (r1, r2, options) => {
      r1 = new Range(r1, options);
      r2 = new Range(r2, options);
      return r1.intersects(r2, options);
    };
    module.exports = intersects;
  }
});

// node_modules/semver/ranges/simplify.js
var require_simplify = __commonJS({
  "node_modules/semver/ranges/simplify.js"(exports, module) {
    "use strict";
    var satisfies = require_satisfies();
    var compare = require_compare();
    module.exports = (versions, range, options) => {
      const set = [];
      let first = null;
      let prev = null;
      const v = versions.sort((a, b) => compare(a, b, options));
      for (const version of v) {
        const included = satisfies(version, range, options);
        if (included) {
          prev = version;
          if (!first) {
            first = version;
          }
        } else {
          if (prev) {
            set.push([first, prev]);
          }
          prev = null;
          first = null;
        }
      }
      if (first) {
        set.push([first, null]);
      }
      const ranges = [];
      for (const [min, max] of set) {
        if (min === max) {
          ranges.push(min);
        } else if (!max && min === v[0]) {
          ranges.push("*");
        } else if (!max) {
          ranges.push(`>=${min}`);
        } else if (min === v[0]) {
          ranges.push(`<=${max}`);
        } else {
          ranges.push(`${min} - ${max}`);
        }
      }
      const simplified = ranges.join(" || ");
      const original = typeof range.raw === "string" ? range.raw : String(range);
      return simplified.length < original.length ? simplified : range;
    };
  }
});

// node_modules/semver/ranges/subset.js
var require_subset = __commonJS({
  "node_modules/semver/ranges/subset.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var satisfies = require_satisfies();
    var compare = require_compare();
    var subset = (sub, dom, options = {}) => {
      if (sub === dom) {
        return true;
      }
      sub = new Range(sub, options);
      dom = new Range(dom, options);
      let sawNonNull = false;
      OUTER: for (const simpleSub of sub.set) {
        for (const simpleDom of dom.set) {
          const isSub = simpleSubset(simpleSub, simpleDom, options);
          sawNonNull = sawNonNull || isSub !== null;
          if (isSub) {
            continue OUTER;
          }
        }
        if (sawNonNull) {
          return false;
        }
      }
      return true;
    };
    var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
    var minimumVersion = [new Comparator(">=0.0.0")];
    var simpleSubset = (sub, dom, options) => {
      if (sub === dom) {
        return true;
      }
      if (sub.length === 1 && sub[0].semver === ANY) {
        if (dom.length === 1 && dom[0].semver === ANY) {
          return true;
        } else if (options.includePrerelease) {
          sub = minimumVersionWithPreRelease;
        } else {
          sub = minimumVersion;
        }
      }
      if (dom.length === 1 && dom[0].semver === ANY) {
        if (options.includePrerelease) {
          return true;
        } else {
          dom = minimumVersion;
        }
      }
      const eqSet = /* @__PURE__ */ new Set();
      let gt, lt;
      for (const c of sub) {
        if (c.operator === ">" || c.operator === ">=") {
          gt = higherGT(gt, c, options);
        } else if (c.operator === "<" || c.operator === "<=") {
          lt = lowerLT(lt, c, options);
        } else {
          eqSet.add(c.semver);
        }
      }
      if (eqSet.size > 1) {
        return null;
      }
      let gtltComp;
      if (gt && lt) {
        gtltComp = compare(gt.semver, lt.semver, options);
        if (gtltComp > 0) {
          return null;
        } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
          return null;
        }
      }
      for (const eq of eqSet) {
        if (gt && !satisfies(eq, String(gt), options)) {
          return null;
        }
        if (lt && !satisfies(eq, String(lt), options)) {
          return null;
        }
        for (const c of dom) {
          if (!satisfies(eq, String(c), options)) {
            return false;
          }
        }
        return true;
      }
      let higher, lower;
      let hasDomLT, hasDomGT;
      let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
      let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
      if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
        needDomLTPre = false;
      }
      for (const c of dom) {
        hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
        hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
        if (gt) {
          if (needDomGTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
              needDomGTPre = false;
            }
          }
          if (c.operator === ">" || c.operator === ">=") {
            higher = higherGT(gt, c, options);
            if (higher === c && higher !== gt) {
              return false;
            }
          } else if (gt.operator === ">=" && !satisfies(gt.semver, String(c), options)) {
            return false;
          }
        }
        if (lt) {
          if (needDomLTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
              needDomLTPre = false;
            }
          }
          if (c.operator === "<" || c.operator === "<=") {
            lower = lowerLT(lt, c, options);
            if (lower === c && lower !== lt) {
              return false;
            }
          } else if (lt.operator === "<=" && !satisfies(lt.semver, String(c), options)) {
            return false;
          }
        }
        if (!c.operator && (lt || gt) && gtltComp !== 0) {
          return false;
        }
      }
      if (gt && hasDomLT && !lt && gtltComp !== 0) {
        return false;
      }
      if (lt && hasDomGT && !gt && gtltComp !== 0) {
        return false;
      }
      if (needDomGTPre || needDomLTPre) {
        return false;
      }
      return true;
    };
    var higherGT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
    };
    var lowerLT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
    };
    module.exports = subset;
  }
});

// node_modules/semver/index.js
var require_semver2 = __commonJS({
  "node_modules/semver/index.js"(exports, module) {
    "use strict";
    var internalRe = require_re();
    var constants = require_constants();
    var SemVer = require_semver();
    var identifiers = require_identifiers();
    var parse = require_parse();
    var valid = require_valid();
    var clean = require_clean();
    var inc = require_inc();
    var diff = require_diff();
    var major = require_major();
    var minor = require_minor();
    var patch = require_patch();
    var prerelease = require_prerelease();
    var compare = require_compare();
    var rcompare = require_rcompare();
    var compareLoose = require_compare_loose();
    var compareBuild = require_compare_build();
    var sort = require_sort();
    var rsort = require_rsort();
    var gt = require_gt();
    var lt = require_lt();
    var eq = require_eq();
    var neq = require_neq();
    var gte = require_gte();
    var lte = require_lte();
    var cmp = require_cmp();
    var coerce = require_coerce();
    var Comparator = require_comparator();
    var Range = require_range();
    var satisfies = require_satisfies();
    var toComparators = require_to_comparators();
    var maxSatisfying = require_max_satisfying();
    var minSatisfying = require_min_satisfying();
    var minVersion = require_min_version();
    var validRange = require_valid2();
    var outside = require_outside();
    var gtr = require_gtr();
    var ltr = require_ltr();
    var intersects = require_intersects();
    var simplifyRange = require_simplify();
    var subset = require_subset();
    module.exports = {
      parse,
      valid,
      clean,
      inc,
      diff,
      major,
      minor,
      patch,
      prerelease,
      compare,
      rcompare,
      compareLoose,
      compareBuild,
      sort,
      rsort,
      gt,
      lt,
      eq,
      neq,
      gte,
      lte,
      cmp,
      coerce,
      Comparator,
      Range,
      satisfies,
      toComparators,
      maxSatisfying,
      minSatisfying,
      minVersion,
      validRange,
      outside,
      gtr,
      ltr,
      intersects,
      simplifyRange,
      subset,
      SemVer,
      re: internalRe.re,
      src: internalRe.src,
      tokens: internalRe.t,
      SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
      RELEASE_TYPES: constants.RELEASE_TYPES,
      compareIdentifiers: identifiers.compareIdentifiers,
      rcompareIdentifiers: identifiers.rcompareIdentifiers
    };
  }
});

// node_modules/@opentelemetry/propagator-jaeger/build/esm/JaegerPropagator.js
import { propagation as propagation3, trace as trace8, TraceFlags as TraceFlags7 } from "@opentelemetry/api";
import { isTracingSuppressed as isTracingSuppressed5 } from "@opentelemetry/core";
function deserializeSpanContext(serializedString) {
  var headers = decodeURIComponent(serializedString).split(":");
  if (headers.length !== 4) {
    return null;
  }
  var _a = __read7(headers, 4), _traceId = _a[0], _spanId = _a[1], flags = _a[3];
  var traceId = _traceId.padStart(32, "0");
  var spanId = _spanId.padStart(16, "0");
  var traceFlags = VALID_HEX_RE.test(flags) ? parseInt(flags, 16) & 1 : 1;
  return { traceId, spanId, isRemote: true, traceFlags };
}
var __values4, __read7, UBER_TRACE_ID_HEADER, UBER_BAGGAGE_HEADER_PREFIX, JaegerPropagator, VALID_HEX_RE;
var init_JaegerPropagator = __esm({
  "node_modules/@opentelemetry/propagator-jaeger/build/esm/JaegerPropagator.js"() {
    "use strict";
    __values4 = function(o) {
      var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
      if (m) return m.call(o);
      if (o && typeof o.length === "number") return {
        next: function() {
          if (o && i >= o.length) o = void 0;
          return { value: o && o[i++], done: !o };
        }
      };
      throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    __read7 = function(o, n) {
      var m = typeof Symbol === "function" && o[Symbol.iterator];
      if (!m) return o;
      var i = m.call(o), r, ar = [], e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = { error };
      } finally {
        try {
          if (r && !r.done && (m = i["return"])) m.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    };
    UBER_TRACE_ID_HEADER = "uber-trace-id";
    UBER_BAGGAGE_HEADER_PREFIX = "uberctx";
    JaegerPropagator = /** @class */
    (function() {
      function JaegerPropagator2(config) {
        if (typeof config === "string") {
          this._jaegerTraceHeader = config;
          this._jaegerBaggageHeaderPrefix = UBER_BAGGAGE_HEADER_PREFIX;
        } else {
          this._jaegerTraceHeader = (config === null || config === void 0 ? void 0 : config.customTraceHeader) || UBER_TRACE_ID_HEADER;
          this._jaegerBaggageHeaderPrefix = (config === null || config === void 0 ? void 0 : config.customBaggageHeaderPrefix) || UBER_BAGGAGE_HEADER_PREFIX;
        }
      }
      JaegerPropagator2.prototype.inject = function(context8, carrier, setter) {
        var e_1, _a;
        var spanContext = trace8.getSpanContext(context8);
        var baggage = propagation3.getBaggage(context8);
        if (spanContext && isTracingSuppressed5(context8) === false) {
          var traceFlags = "0" + (spanContext.traceFlags || TraceFlags7.NONE).toString(16);
          setter.set(carrier, this._jaegerTraceHeader, spanContext.traceId + ":" + spanContext.spanId + ":0:" + traceFlags);
        }
        if (baggage) {
          try {
            for (var _b = __values4(baggage.getAllEntries()), _c = _b.next(); !_c.done; _c = _b.next()) {
              var _d = __read7(_c.value, 2), key = _d[0], entry = _d[1];
              setter.set(carrier, this._jaegerBaggageHeaderPrefix + "-" + key, encodeURIComponent(entry.value));
            }
          } catch (e_1_1) {
            e_1 = { error: e_1_1 };
          } finally {
            try {
              if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            } finally {
              if (e_1) throw e_1.error;
            }
          }
        }
      };
      JaegerPropagator2.prototype.extract = function(context8, carrier, getter) {
        var e_2, _a;
        var _this = this;
        var _b;
        var uberTraceIdHeader = getter.get(carrier, this._jaegerTraceHeader);
        var uberTraceId = Array.isArray(uberTraceIdHeader) ? uberTraceIdHeader[0] : uberTraceIdHeader;
        var baggageValues = getter.keys(carrier).filter(function(key) {
          return key.startsWith(_this._jaegerBaggageHeaderPrefix + "-");
        }).map(function(key) {
          var value = getter.get(carrier, key);
          return {
            key: key.substring(_this._jaegerBaggageHeaderPrefix.length + 1),
            value: Array.isArray(value) ? value[0] : value
          };
        });
        var newContext = context8;
        if (typeof uberTraceId === "string") {
          var spanContext = deserializeSpanContext(uberTraceId);
          if (spanContext) {
            newContext = trace8.setSpanContext(newContext, spanContext);
          }
        }
        if (baggageValues.length === 0)
          return newContext;
        var currentBaggage = (_b = propagation3.getBaggage(context8)) !== null && _b !== void 0 ? _b : propagation3.createBaggage();
        try {
          for (var baggageValues_1 = __values4(baggageValues), baggageValues_1_1 = baggageValues_1.next(); !baggageValues_1_1.done; baggageValues_1_1 = baggageValues_1.next()) {
            var baggageEntry = baggageValues_1_1.value;
            if (baggageEntry.value === void 0)
              continue;
            currentBaggage = currentBaggage.setEntry(baggageEntry.key, {
              value: decodeURIComponent(baggageEntry.value)
            });
          }
        } catch (e_2_1) {
          e_2 = { error: e_2_1 };
        } finally {
          try {
            if (baggageValues_1_1 && !baggageValues_1_1.done && (_a = baggageValues_1.return)) _a.call(baggageValues_1);
          } finally {
            if (e_2) throw e_2.error;
          }
        }
        newContext = propagation3.setBaggage(newContext, currentBaggage);
        return newContext;
      };
      JaegerPropagator2.prototype.fields = function() {
        return [this._jaegerTraceHeader];
      };
      return JaegerPropagator2;
    })();
    VALID_HEX_RE = /^[0-9a-f]{1,2}$/i;
  }
});

// node_modules/@opentelemetry/propagator-jaeger/build/esm/index.js
var esm_exports3 = {};
__export(esm_exports3, {
  JaegerPropagator: () => JaegerPropagator,
  UBER_BAGGAGE_HEADER_PREFIX: () => UBER_BAGGAGE_HEADER_PREFIX,
  UBER_TRACE_ID_HEADER: () => UBER_TRACE_ID_HEADER
});
var init_esm4 = __esm({
  "node_modules/@opentelemetry/propagator-jaeger/build/esm/index.js"() {
    "use strict";
    init_JaegerPropagator();
  }
});

// node_modules/@opentelemetry/sdk-trace-node/build/src/NodeTracerProvider.js
var require_NodeTracerProvider = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-node/build/src/NodeTracerProvider.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NodeTracerProvider = void 0;
    var context_async_hooks_1 = require_src();
    var propagator_b3_1 = (init_esm(), __toCommonJS(esm_exports));
    var sdk_trace_base_1 = (init_esm3(), __toCommonJS(esm_exports2));
    var semver = require_semver2();
    var propagator_jaeger_1 = (init_esm4(), __toCommonJS(esm_exports3));
    var NodeTracerProvider = class extends sdk_trace_base_1.BasicTracerProvider {
      constructor(config = {}) {
        super(config);
      }
      register(config = {}) {
        if (config.contextManager === void 0) {
          const ContextManager = semver.gte(process.version, "14.8.0") ? context_async_hooks_1.AsyncLocalStorageContextManager : context_async_hooks_1.AsyncHooksContextManager;
          config.contextManager = new ContextManager();
          config.contextManager.enable();
        }
        super.register(config);
      }
    };
    exports.NodeTracerProvider = NodeTracerProvider;
    NodeTracerProvider._registeredPropagators = new Map([
      ...sdk_trace_base_1.BasicTracerProvider._registeredPropagators,
      [
        "b3",
        () => new propagator_b3_1.B3Propagator({ injectEncoding: propagator_b3_1.B3InjectEncoding.SINGLE_HEADER })
      ],
      [
        "b3multi",
        () => new propagator_b3_1.B3Propagator({ injectEncoding: propagator_b3_1.B3InjectEncoding.MULTI_HEADER })
      ],
      ["jaeger", () => new propagator_jaeger_1.JaegerPropagator()]
    ]);
  }
});

// node_modules/@opentelemetry/sdk-trace-node/build/src/index.js
var require_src2 = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-node/build/src/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Tracer = exports.TraceIdRatioBasedSampler = exports.Span = exports.SimpleSpanProcessor = exports.SamplingDecision = exports.RandomIdGenerator = exports.ParentBasedSampler = exports.NoopSpanProcessor = exports.InMemorySpanExporter = exports.ForceFlushState = exports.ConsoleSpanExporter = exports.BatchSpanProcessor = exports.BasicTracerProvider = exports.AlwaysOnSampler = exports.AlwaysOffSampler = exports.NodeTracerProvider = void 0;
    var NodeTracerProvider_1 = require_NodeTracerProvider();
    Object.defineProperty(exports, "NodeTracerProvider", { enumerable: true, get: function() {
      return NodeTracerProvider_1.NodeTracerProvider;
    } });
    var sdk_trace_base_1 = (init_esm3(), __toCommonJS(esm_exports2));
    Object.defineProperty(exports, "AlwaysOffSampler", { enumerable: true, get: function() {
      return sdk_trace_base_1.AlwaysOffSampler;
    } });
    Object.defineProperty(exports, "AlwaysOnSampler", { enumerable: true, get: function() {
      return sdk_trace_base_1.AlwaysOnSampler;
    } });
    Object.defineProperty(exports, "BasicTracerProvider", { enumerable: true, get: function() {
      return sdk_trace_base_1.BasicTracerProvider;
    } });
    Object.defineProperty(exports, "BatchSpanProcessor", { enumerable: true, get: function() {
      return sdk_trace_base_1.BatchSpanProcessor;
    } });
    Object.defineProperty(exports, "ConsoleSpanExporter", { enumerable: true, get: function() {
      return sdk_trace_base_1.ConsoleSpanExporter;
    } });
    Object.defineProperty(exports, "ForceFlushState", { enumerable: true, get: function() {
      return sdk_trace_base_1.ForceFlushState;
    } });
    Object.defineProperty(exports, "InMemorySpanExporter", { enumerable: true, get: function() {
      return sdk_trace_base_1.InMemorySpanExporter;
    } });
    Object.defineProperty(exports, "NoopSpanProcessor", { enumerable: true, get: function() {
      return sdk_trace_base_1.NoopSpanProcessor;
    } });
    Object.defineProperty(exports, "ParentBasedSampler", { enumerable: true, get: function() {
      return sdk_trace_base_1.ParentBasedSampler;
    } });
    Object.defineProperty(exports, "RandomIdGenerator", { enumerable: true, get: function() {
      return sdk_trace_base_1.RandomIdGenerator;
    } });
    Object.defineProperty(exports, "SamplingDecision", { enumerable: true, get: function() {
      return sdk_trace_base_1.SamplingDecision;
    } });
    Object.defineProperty(exports, "SimpleSpanProcessor", { enumerable: true, get: function() {
      return sdk_trace_base_1.SimpleSpanProcessor;
    } });
    Object.defineProperty(exports, "Span", { enumerable: true, get: function() {
      return sdk_trace_base_1.Span;
    } });
    Object.defineProperty(exports, "TraceIdRatioBasedSampler", { enumerable: true, get: function() {
      return sdk_trace_base_1.TraceIdRatioBasedSampler;
    } });
    Object.defineProperty(exports, "Tracer", { enumerable: true, get: function() {
      return sdk_trace_base_1.Tracer;
    } });
  }
});

// src/index.ts
import { trace as trace10 } from "@opentelemetry/api";

// src/middleware/action-middleware.ts
import { trace, context as context2, SpanKind } from "@opentelemetry/api";

// src/propagation/context-carrier.ts
import {
  context,
  propagation
} from "@opentelemetry/api";
var textMapGetter = {
  get(carrier, key) {
    return carrier[key];
  },
  keys(carrier) {
    return Object.keys(carrier);
  }
};
var textMapSetter = {
  set(carrier, key, value) {
    carrier[key] = value;
  }
};
function injectContext(ctx, carrier) {
  propagation.inject(ctx, carrier, textMapSetter);
}
function extractContext(ctx, carrier) {
  return propagation.extract(ctx, carrier, textMapGetter);
}
function getActiveContext() {
  return context.active();
}
function hasTraceContext(carrier) {
  return typeof carrier.traceparent === "string" && carrier.traceparent.length > 0;
}
function getBaggage() {
  return propagation.getBaggage(context.active());
}
function getBaggageValue(key) {
  const baggage = getBaggage();
  return baggage?.getEntry(key)?.value;
}
function withBaggage(entries, parentContext) {
  const ctx = parentContext ?? context.active();
  const currentBaggage = propagation.getBaggage(ctx) ?? propagation.createBaggage();
  let newBaggage = currentBaggage;
  for (const [key, value] of Object.entries(entries)) {
    const entry = typeof value === "string" ? { value } : value;
    newBaggage = newBaggage.setEntry(key, entry);
  }
  return propagation.setBaggage(ctx, newBaggage);
}
function getAllBaggage() {
  const baggage = getBaggage();
  if (!baggage) {
    return {};
  }
  const entries = {};
  for (const [key, entry] of baggage.getAllEntries()) {
    entries[key] = entry.value;
  }
  return entries;
}

// src/utils/attribute-sanitizer.ts
function sanitizeAttributeValue(value, maxLength = 1024) {
  if (value === null || value === void 0) {
    return void 0;
  }
  if (typeof value === "string") {
    return truncateValue(value, maxLength);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    const sanitized = value.map((v) => sanitizeArrayElement(v, maxLength)).filter((v) => v !== void 0);
    if (sanitized.length === 0) return void 0;
    const firstType = typeof sanitized[0];
    if (sanitized.every((v) => typeof v === firstType)) {
      return sanitized;
    }
    return truncateValue(JSON.stringify(value), maxLength);
  }
  try {
    return truncateValue(JSON.stringify(value), maxLength);
  } catch {
    return "[Circular or non-serializable object]";
  }
}
function sanitizeArrayElement(value, maxLength) {
  if (value === null || value === void 0) {
    return void 0;
  }
  if (typeof value === "string") {
    return truncateValue(value, maxLength);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  try {
    return truncateValue(JSON.stringify(value), maxLength);
  } catch {
    return "[Complex object]";
  }
}
function truncateValue(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength - 3) + "...";
}
function flattenObject(obj, maxLength = 1024, prefix = "", maxDepth = 5, currentDepth = 0) {
  const result = {};
  if (currentDepth >= maxDepth) {
    return result;
  }
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenObject(
          value,
          maxLength,
          fullKey,
          maxDepth,
          currentDepth + 1
        )
      );
    } else {
      const sanitized = sanitizeAttributeValue(value, maxLength);
      if (sanitized !== void 0) {
        result[fullKey] = sanitized;
      }
    }
  }
  return result;
}
function pickKeys(obj, keys, maxLength = 1024) {
  const result = {};
  for (const key of keys) {
    const value = getNestedValue(obj, key);
    if (value !== void 0) {
      const sanitized = sanitizeAttributeValue(value, maxLength);
      if (sanitized !== void 0) {
        result[key] = sanitized;
      }
    }
  }
  return result;
}
function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => {
    if (current && typeof current === "object") {
      return current[key];
    }
    return void 0;
  }, obj);
}

// src/tracing/span-attributes.ts
function buildActionAttributes(ctx, action, options) {
  const serviceName = action.name.split(".")[0];
  const attrs = {
    // RPC semantic conventions
    "rpc.system": "moleculer",
    "rpc.service": serviceName,
    "rpc.method": action.name,
    // Moleculer-specific attributes
    "moleculer.action": action.name,
    "moleculer.service": serviceName,
    "moleculer.nodeID": ctx.nodeID || "local",
    "moleculer.requestID": ctx.requestID,
    "moleculer.level": ctx.level
  };
  if (options.perServiceTracing) {
    attrs["service.name"] = serviceName;
  }
  if (ctx.caller) {
    attrs["moleculer.caller"] = ctx.caller;
  }
  if (ctx._retryAttempts !== void 0 && ctx._retryAttempts > 0) {
    attrs["moleculer.retry.attempt"] = ctx._retryAttempts;
    attrs["moleculer.retry.isRetry"] = true;
  }
  if (ctx.options?.timeout) {
    attrs["moleculer.timeout"] = ctx.options.timeout;
  }
  if (ctx.cachedResult !== void 0) {
    attrs["moleculer.cache.hit"] = ctx.cachedResult;
  }
  if (ctx.meta?.$cacheKey) {
    attrs["moleculer.cache.key"] = String(ctx.meta.$cacheKey).slice(0, 256);
  }
  if (options.actionParams && ctx.params) {
    const paramAttrs = buildDataAttributes(
      ctx.params,
      options.actionParams,
      ctx,
      options.maxAttributeValueLength
    );
    Object.assign(attrs, prefixAttributes(paramAttrs, "moleculer.params"));
  }
  if (options.actionMeta && ctx.meta) {
    const filteredMeta = Object.fromEntries(
      Object.entries(ctx.meta).filter(([key]) => !key.startsWith("$"))
    );
    const metaAttrs = buildDataAttributes(
      filteredMeta,
      options.actionMeta,
      ctx,
      options.maxAttributeValueLength
    );
    Object.assign(attrs, prefixAttributes(metaAttrs, "moleculer.meta"));
  }
  return attrs;
}
function buildEventAttributes(ctx, eventName, options) {
  const serviceName = ctx.service?.name || eventName.split(".")[0];
  const attrs = {
    // Messaging semantic conventions
    "messaging.system": "moleculer",
    "messaging.operation": "receive",
    "messaging.destination.name": eventName,
    // Moleculer-specific attributes
    "moleculer.event": eventName,
    "moleculer.service": serviceName,
    "moleculer.nodeID": ctx.nodeID || "local",
    "moleculer.requestID": ctx.requestID
  };
  if (options.perServiceTracing) {
    attrs["service.name"] = serviceName;
  }
  if (ctx.eventGroups && ctx.eventGroups.length > 0) {
    attrs["moleculer.event.groups"] = ctx.eventGroups.join(",");
  }
  if (options.eventPayload && ctx.params) {
    const payloadAttrs = buildDataAttributes(
      ctx.params,
      options.eventPayload,
      ctx,
      options.maxAttributeValueLength
    );
    Object.assign(attrs, prefixAttributes(payloadAttrs, "moleculer.payload"));
  }
  return attrs;
}
function buildResponseAttributes(result, config, ctx, maxLength) {
  if (!result) return {};
  const attrs = buildDataAttributes(result, config, ctx, maxLength);
  return prefixAttributes(attrs, "moleculer.response");
}
function buildDataAttributes(data, config, ctx, maxLength) {
  if (!data) {
    return {};
  }
  if (typeof config === "function") {
    try {
      return config(data, ctx);
    } catch {
      return {};
    }
  }
  if (config === true) {
    if (typeof data === "object" && !Array.isArray(data)) {
      return flattenObject(data, maxLength);
    }
    const sanitized = sanitizeAttributeValue(data, maxLength);
    return sanitized !== void 0 ? { value: sanitized } : {};
  }
  if (Array.isArray(config)) {
    if (typeof data === "object" && !Array.isArray(data)) {
      return pickKeys(data, config, maxLength);
    }
    return {};
  }
  return {};
}
function prefixAttributes(attrs, prefix) {
  const result = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== void 0 && value !== null) {
      const sanitized = sanitizeAttributeValue(value);
      if (sanitized !== void 0) {
        result[`${prefix}.${key}`] = sanitized;
      }
    }
  }
  return result;
}

// src/tracing/error-handler.ts
import { SpanStatusCode } from "@opentelemetry/api";
function recordError(span, error, ctx, options) {
  if (options.errorFilter && ctx) {
    try {
      if (!options.errorFilter(error, ctx)) {
        return;
      }
    } catch {
    }
  }
  span.recordException(error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message
  });
  span.setAttributes({
    "error.type": error.constructor.name,
    "error.message": error.message
  });
  const moleculerError = error;
  if (moleculerError.code) {
    span.setAttribute("moleculer.error.code", moleculerError.code);
  }
  if (moleculerError.type) {
    span.setAttribute("moleculer.error.type", moleculerError.type);
  }
  if (moleculerError.data) {
    try {
      span.setAttribute(
        "moleculer.error.data",
        JSON.stringify(moleculerError.data).slice(0, 1024)
      );
    } catch {
    }
  }
  if (moleculerError.retryable !== void 0) {
    span.setAttribute("moleculer.error.retryable", moleculerError.retryable);
  }
  if (isCircuitBreakerError(error)) {
    span.setAttribute("moleculer.circuitBreaker.open", true);
    span.setAttribute("moleculer.circuitBreaker.error", true);
  }
  if (isTimeoutError(error)) {
    span.setAttribute("moleculer.timeout.exceeded", true);
  }
  if (isValidationError(error)) {
    span.setAttribute("moleculer.validation.failed", true);
  }
}
function isCircuitBreakerError(error) {
  const name = error.constructor.name;
  const message = error.message.toLowerCase();
  return name === "BrokerCircuitBreakerOpenedError" || name === "CircuitBreakerOpenError" || message.includes("circuit breaker") || message.includes("circuit is open");
}
function isTimeoutError(error) {
  const name = error.constructor.name;
  const message = error.message.toLowerCase();
  return name === "RequestTimeoutError" || name === "TimeoutError" || message.includes("timeout") || message.includes("timed out");
}
function isValidationError(error) {
  const name = error.constructor.name;
  return name === "ValidationError" || name === "ParameterValidationError" || error.type === "VALIDATION_ERROR";
}
function recordSuccess(span) {
  span.setStatus({ code: SpanStatusCode.OK });
}

// src/utils/pattern-matcher.ts
function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}
function shouldExclude(name, patterns) {
  if (!patterns || patterns.length === 0) {
    return false;
  }
  return patterns.some((pattern) => {
    if (pattern === name) {
      return true;
    }
    if (pattern.includes("*") || pattern.includes("?")) {
      return globToRegex(pattern).test(name);
    }
    return false;
  });
}

// src/metrics/index.ts
import { metrics } from "@opentelemetry/api";
var METER_NAME = "moleculer-otel";
var metricsInstance = null;
var MoleculerMetrics = class {
  actionDuration;
  actionCalls;
  actionErrors;
  eventEmits;
  prefix;
  constructor(options = {}) {
    this.prefix = options.prefix ?? "moleculer";
    const meter = metrics.getMeter(METER_NAME);
    this.actionDuration = meter.createHistogram(`${this.prefix}.action.duration`, {
      description: "Duration of Moleculer action calls in milliseconds",
      unit: "ms"
    });
    this.actionCalls = meter.createCounter(`${this.prefix}.action.calls`, {
      description: "Total number of Moleculer action calls"
    });
    this.actionErrors = meter.createCounter(`${this.prefix}.action.errors`, {
      description: "Total number of Moleculer action errors"
    });
    this.eventEmits = meter.createCounter(`${this.prefix}.event.emits`, {
      description: "Total number of Moleculer events emitted"
    });
  }
  /**
   * Record an action call with duration
   */
  recordAction(actionName, durationMs, success, attributes) {
    const baseAttrs = {
      "moleculer.action": actionName,
      "moleculer.service": actionName.split(".")[0],
      ...attributes
    };
    this.actionDuration.record(durationMs, baseAttrs);
    this.actionCalls.add(1, { ...baseAttrs, success });
    if (!success) {
      this.actionErrors.add(1, baseAttrs);
    }
  }
  /**
   * Record an event emission
   */
  recordEvent(eventName, type, attributes) {
    this.eventEmits.add(1, {
      "moleculer.event": eventName,
      "moleculer.event.type": type,
      ...attributes
    });
  }
};
function getMetrics(options) {
  if (!metricsInstance) {
    metricsInstance = new MoleculerMetrics(options);
  }
  return metricsInstance;
}
function resetMetrics() {
  metricsInstance = null;
}

// src/middleware/action-middleware.ts
var TRACER_NAME = "moleculer-otel";
function isStream(value) {
  return value !== null && typeof value === "object" && typeof value.pipe === "function";
}
function createActionMiddleware(options) {
  const tracer = trace.getTracer(TRACER_NAME);
  const metaKey = options.metaKey;
  let metricsCollector = null;
  if (options.metrics?.enabled) {
    metricsCollector = getMetrics(options.metrics);
  }
  function call(next) {
    return function(actionName, params, opts = {}) {
      const resolvedActionName = typeof actionName === "string" ? actionName : actionName?.action;
      if (!resolvedActionName || typeof resolvedActionName !== "string") {
        return next.call(this, actionName, params, opts);
      }
      if (shouldExclude(resolvedActionName, options.excludeActions)) {
        return next.call(this, actionName, params, opts);
      }
      const parentContext = getActiveContext();
      const serviceName = resolvedActionName.split(".")[0];
      const isStreamingRequest = isStream(params);
      const span = tracer.startSpan(
        `call ${resolvedActionName}`,
        {
          kind: SpanKind.CLIENT,
          attributes: {
            "rpc.system": "moleculer",
            "rpc.service": serviceName,
            "rpc.method": resolvedActionName,
            "moleculer.action": resolvedActionName,
            "moleculer.service": serviceName,
            ...this?.nodeID && { "moleculer.caller": this.nodeID },
            ...isStreamingRequest && { "moleculer.streaming": true },
            ...options.perServiceTracing && { "service.name": serviceName }
          }
        },
        parentContext
      );
      const carrier = {};
      const spanContext = trace.setSpan(parentContext, span);
      injectContext(spanContext, carrier);
      const enhancedOpts = {
        ...opts,
        meta: {
          ...opts.meta,
          [metaKey]: carrier
        }
      };
      return context2.with(spanContext, async () => {
        try {
          const result = await next.call(this, actionName, params, enhancedOpts);
          recordSuccess(span);
          return result;
        } catch (error) {
          recordError(span, error, null, options);
          throw error;
        } finally {
          span.end();
        }
      });
    };
  }
  function localAction(next, action) {
    return function(ctx) {
      const actionName = action.name;
      if (shouldExclude(actionName, options.excludeActions)) {
        return next(ctx);
      }
      const carrier = ctx.meta?.[metaKey] || {};
      const parentContext = extractContext(getActiveContext(), carrier);
      const isStreamingRequest = isStream(ctx.params);
      const baseAttributes = buildActionAttributes(ctx, action, options);
      if (isStreamingRequest) {
        baseAttributes["moleculer.streaming"] = true;
        baseAttributes["moleculer.streaming.direction"] = "request";
      }
      const span = tracer.startSpan(
        actionName,
        {
          kind: SpanKind.SERVER,
          attributes: baseAttributes
        },
        parentContext
      );
      if (options.onSpanStart) {
        try {
          options.onSpanStart(span, ctx, "action");
        } catch {
        }
      }
      const spanContext = trace.setSpan(parentContext, span);
      const startTime = metricsCollector ? Date.now() : 0;
      return context2.with(spanContext, async () => {
        try {
          const result = await next(ctx);
          const isStreamingResponse = isStream(result);
          if (isStreamingResponse) {
            span.setAttribute("moleculer.streaming.response", true);
            const stream = result;
            stream.once("end", () => {
              recordSuccess(span);
              if (metricsCollector) {
                const durationMs = Date.now() - startTime;
                metricsCollector.recordAction(actionName, durationMs, true);
              }
              if (options.onSpanEnd) {
                try {
                  options.onSpanEnd(span, ctx, result, "action");
                } catch {
                }
              }
              span.end();
            });
            stream.once("error", (error) => {
              recordError(span, error, ctx, options);
              if (metricsCollector) {
                const durationMs = Date.now() - startTime;
                metricsCollector.recordAction(actionName, durationMs, false);
              }
              span.end();
            });
            return result;
          }
          recordSuccess(span);
          if (metricsCollector) {
            const durationMs = Date.now() - startTime;
            metricsCollector.recordAction(actionName, durationMs, true);
          }
          if (options.actionResponse && result) {
            const responseAttrs = buildResponseAttributes(
              result,
              options.actionResponse,
              ctx,
              options.maxAttributeValueLength
            );
            span.setAttributes(responseAttrs);
          }
          if (options.onSpanEnd) {
            try {
              options.onSpanEnd(span, ctx, result, "action");
            } catch {
            }
          }
          span.end();
          return result;
        } catch (error) {
          recordError(span, error, ctx, options);
          if (metricsCollector) {
            const durationMs = Date.now() - startTime;
            metricsCollector.recordAction(actionName, durationMs, false);
          }
          span.end();
          throw error;
        }
      });
    };
  }
  function remoteAction(next, action) {
    return function(ctx) {
      const actionName = action.name;
      if (shouldExclude(actionName, options.excludeActions)) {
        return next(ctx);
      }
      const carrier = ctx.meta?.[metaKey] || {};
      const parentContext = extractContext(getActiveContext(), carrier);
      const remoteServiceName = actionName.split(".")[0];
      const span = tracer.startSpan(
        `remote:${actionName}`,
        {
          kind: SpanKind.CLIENT,
          attributes: {
            "rpc.system": "moleculer",
            "rpc.service": remoteServiceName,
            "rpc.method": actionName,
            "moleculer.action": actionName,
            "moleculer.service": remoteServiceName,
            "moleculer.remote": true,
            "moleculer.nodeID": ctx.nodeID,
            ...options.perServiceTracing && { "service.name": remoteServiceName }
          }
        },
        parentContext
      );
      const spanContext = trace.setSpan(parentContext, span);
      return context2.with(spanContext, async () => {
        try {
          const result = await next(ctx);
          recordSuccess(span);
          return result;
        } catch (error) {
          recordError(span, error, ctx, options);
          throw error;
        } finally {
          span.end();
        }
      });
    };
  }
  return { call, localAction, remoteAction };
}

// src/middleware/event-middleware.ts
import { trace as trace2, context as context3, SpanKind as SpanKind2 } from "@opentelemetry/api";
var TRACER_NAME2 = "moleculer-otel";
function createEventMiddleware(options) {
  const tracer = trace2.getTracer(TRACER_NAME2);
  const metaKey = options.metaKey;
  let metricsCollector = null;
  if (options.metrics?.enabled) {
    metricsCollector = getMetrics(options.metrics);
  }
  function emit(next) {
    return function(eventName, payload, opts = {}) {
      if (shouldExclude(eventName, options.excludeEvents)) {
        return next.call(this, eventName, payload, opts);
      }
      const parentContext = getActiveContext();
      const eventServiceName = eventName.split(".")[0];
      const span = tracer.startSpan(
        `emit:${eventName}`,
        {
          kind: SpanKind2.PRODUCER,
          attributes: {
            "messaging.system": "moleculer",
            "messaging.operation": "emit",
            "messaging.destination.name": eventName,
            "moleculer.event": eventName,
            "moleculer.event.type": "emit",
            "moleculer.service": eventServiceName,
            ...options.perServiceTracing && { "service.name": eventServiceName }
          }
        },
        parentContext
      );
      const carrier = {};
      const spanContext = trace2.setSpan(parentContext, span);
      injectContext(spanContext, carrier);
      const enhancedOpts = {
        ...opts,
        meta: {
          ...opts.meta,
          [metaKey]: carrier
        }
      };
      return context3.with(spanContext, async () => {
        try {
          await next.call(this, eventName, payload, enhancedOpts);
          recordSuccess(span);
          if (metricsCollector) {
            metricsCollector.recordEvent(eventName, "emit");
          }
        } catch (error) {
          recordError(span, error, null, options);
          throw error;
        } finally {
          span.end();
        }
      });
    };
  }
  function broadcast(next) {
    return function(eventName, payload, opts = {}) {
      if (shouldExclude(eventName, options.excludeEvents)) {
        return next.call(this, eventName, payload, opts);
      }
      const parentContext = getActiveContext();
      const broadcastServiceName = eventName.split(".")[0];
      const span = tracer.startSpan(
        `broadcast:${eventName}`,
        {
          kind: SpanKind2.PRODUCER,
          attributes: {
            "messaging.system": "moleculer",
            "messaging.operation": "broadcast",
            "messaging.destination.name": eventName,
            "moleculer.event": eventName,
            "moleculer.event.type": "broadcast",
            "moleculer.service": broadcastServiceName,
            ...options.perServiceTracing && { "service.name": broadcastServiceName }
          }
        },
        parentContext
      );
      const carrier = {};
      const spanContext = trace2.setSpan(parentContext, span);
      injectContext(spanContext, carrier);
      const enhancedOpts = {
        ...opts,
        meta: {
          ...opts.meta,
          [metaKey]: carrier
        }
      };
      return context3.with(spanContext, async () => {
        try {
          await next.call(this, eventName, payload, enhancedOpts);
          recordSuccess(span);
          if (metricsCollector) {
            metricsCollector.recordEvent(eventName, "broadcast");
          }
        } catch (error) {
          recordError(span, error, null, options);
          throw error;
        } finally {
          span.end();
        }
      });
    };
  }
  function localEvent(next, event) {
    return function(ctx) {
      const eventName = ctx.eventName || event.name;
      if (shouldExclude(eventName, options.excludeEvents)) {
        return next(ctx);
      }
      const carrier = ctx.meta?.[metaKey] || {};
      const parentContext = extractContext(getActiveContext(), carrier);
      const span = tracer.startSpan(
        `handle:${eventName}`,
        {
          kind: SpanKind2.CONSUMER,
          attributes: buildEventAttributes(ctx, eventName, options)
        },
        parentContext
      );
      if (options.onSpanStart) {
        try {
          options.onSpanStart(span, ctx, "event");
        } catch {
        }
      }
      const spanContext = trace2.setSpan(parentContext, span);
      return context3.with(spanContext, async () => {
        try {
          await next(ctx);
          recordSuccess(span);
          if (options.onSpanEnd) {
            try {
              options.onSpanEnd(span, ctx, void 0, "event");
            } catch {
            }
          }
        } catch (error) {
          recordError(span, error, ctx, options);
          throw error;
        } finally {
          span.end();
        }
      });
    };
  }
  return { emit, broadcast, localEvent };
}

// src/middleware/index.ts
function createMiddleware(options) {
  const actionHandlers = createActionMiddleware(options);
  const eventHandlers = createEventMiddleware(options);
  return {
    name: "OpenTelemetryMiddleware",
    /**
     * Called when broker is created.
     */
    created(_broker) {
    },
    // Action tracing hooks (only if enabled)
    ...options.traceActions ? {
      localAction: actionHandlers.localAction,
      remoteAction: actionHandlers.remoteAction,
      call: actionHandlers.call
    } : {},
    // Event tracing hooks (only if enabled)
    ...options.traceEvents ? {
      emit: eventHandlers.emit,
      broadcast: eventHandlers.broadcast,
      localEvent: eventHandlers.localEvent
    } : {}
  };
}

// src/config/defaults.ts
var DEFAULT_OPTIONS = {
  traceActions: true,
  traceEvents: true,
  actionParams: true,
  actionMeta: false,
  actionResponse: false,
  eventPayload: false,
  metaKey: "$otel",
  excludeActions: [],
  excludeEvents: [],
  maxAttributeValueLength: 1024,
  perServiceTracing: false
};
function resolveOptions(options = {}) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    excludeActions: options.excludeActions ?? DEFAULT_OPTIONS.excludeActions,
    excludeEvents: options.excludeEvents ?? DEFAULT_OPTIONS.excludeEvents
  };
}

// src/sdk/init.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

// node_modules/@opentelemetry/resources/build/esm/Resource.js
import { diag } from "@opentelemetry/api";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { SDK_INFO } from "@opentelemetry/core";

// node_modules/@opentelemetry/resources/build/esm/platform/node/default-service-name.js
function defaultServiceName() {
  return "unknown_service:" + process.argv0;
}

// node_modules/@opentelemetry/resources/build/esm/Resource.js
var __assign = function() {
  __assign = Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
      s = arguments[i];
      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
        t[p] = s[p];
    }
    return t;
  };
  return __assign.apply(this, arguments);
};
var __awaiter = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var __generator = function(thisArg, body) {
  var _ = { label: 0, sent: function() {
    if (t[0] & 1) throw t[1];
    return t[1];
  }, trys: [], ops: [] }, f, y, t, g;
  return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
    return this;
  }), g;
  function verb(n) {
    return function(v) {
      return step([n, v]);
    };
  }
  function step(op) {
    if (f) throw new TypeError("Generator is already executing.");
    while (_) try {
      if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
      if (y = 0, t) op = [op[0] & 2, t.value];
      switch (op[0]) {
        case 0:
        case 1:
          t = op;
          break;
        case 4:
          _.label++;
          return { value: op[1], done: false };
        case 5:
          _.label++;
          y = op[1];
          op = [0];
          continue;
        case 7:
          op = _.ops.pop();
          _.trys.pop();
          continue;
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _ = 0;
            continue;
          }
          if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
            _.label = op[1];
            break;
          }
          if (op[0] === 6 && _.label < t[1]) {
            _.label = t[1];
            t = op;
            break;
          }
          if (t && _.label < t[2]) {
            _.label = t[2];
            _.ops.push(op);
            break;
          }
          if (t[2]) _.ops.pop();
          _.trys.pop();
          continue;
      }
      op = body.call(thisArg, _);
    } catch (e) {
      op = [6, e];
      y = 0;
    } finally {
      f = t = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
};
var __read = function(o, n) {
  var m = typeof Symbol === "function" && o[Symbol.iterator];
  if (!m) return o;
  var i = m.call(o), r, ar = [], e;
  try {
    while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
  } catch (error) {
    e = { error };
  } finally {
    try {
      if (r && !r.done && (m = i["return"])) m.call(i);
    } finally {
      if (e) throw e.error;
    }
  }
  return ar;
};
var Resource = (
  /** @class */
  (function() {
    function Resource3(attributes, asyncAttributesPromise) {
      var _this = this;
      var _a;
      this._attributes = attributes;
      this.asyncAttributesPending = asyncAttributesPromise != null;
      this._syncAttributes = (_a = this._attributes) !== null && _a !== void 0 ? _a : {};
      this._asyncAttributesPromise = asyncAttributesPromise === null || asyncAttributesPromise === void 0 ? void 0 : asyncAttributesPromise.then(function(asyncAttributes) {
        _this._attributes = Object.assign({}, _this._attributes, asyncAttributes);
        _this.asyncAttributesPending = false;
        return asyncAttributes;
      }, function(err) {
        diag.debug("a resource's async attributes promise rejected: %s", err);
        _this.asyncAttributesPending = false;
        return {};
      });
    }
    Resource3.empty = function() {
      return Resource3.EMPTY;
    };
    Resource3.default = function() {
      var _a;
      return new Resource3((_a = {}, _a[SemanticResourceAttributes.SERVICE_NAME] = defaultServiceName(), _a[SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE] = SDK_INFO[SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE], _a[SemanticResourceAttributes.TELEMETRY_SDK_NAME] = SDK_INFO[SemanticResourceAttributes.TELEMETRY_SDK_NAME], _a[SemanticResourceAttributes.TELEMETRY_SDK_VERSION] = SDK_INFO[SemanticResourceAttributes.TELEMETRY_SDK_VERSION], _a));
    };
    Object.defineProperty(Resource3.prototype, "attributes", {
      get: function() {
        var _a;
        if (this.asyncAttributesPending) {
          diag.error("Accessing resource attributes before async attributes settled");
        }
        return (_a = this._attributes) !== null && _a !== void 0 ? _a : {};
      },
      enumerable: false,
      configurable: true
    });
    Resource3.prototype.waitForAsyncAttributes = function() {
      return __awaiter(this, void 0, void 0, function() {
        return __generator(this, function(_a) {
          switch (_a.label) {
            case 0:
              if (!this.asyncAttributesPending) return [3, 2];
              return [4, this._asyncAttributesPromise];
            case 1:
              _a.sent();
              _a.label = 2;
            case 2:
              return [
                2
                /*return*/
              ];
          }
        });
      });
    };
    Resource3.prototype.merge = function(other) {
      var _this = this;
      var _a;
      if (!other)
        return this;
      var mergedSyncAttributes = __assign(__assign({}, this._syncAttributes), (_a = other._syncAttributes) !== null && _a !== void 0 ? _a : other.attributes);
      if (!this._asyncAttributesPromise && !other._asyncAttributesPromise) {
        return new Resource3(mergedSyncAttributes);
      }
      var mergedAttributesPromise = Promise.all([
        this._asyncAttributesPromise,
        other._asyncAttributesPromise
      ]).then(function(_a2) {
        var _b;
        var _c = __read(_a2, 2), thisAsyncAttributes = _c[0], otherAsyncAttributes = _c[1];
        return __assign(__assign(__assign(__assign({}, _this._syncAttributes), thisAsyncAttributes), (_b = other._syncAttributes) !== null && _b !== void 0 ? _b : other.attributes), otherAsyncAttributes);
      });
      return new Resource3(mergedSyncAttributes, mergedAttributesPromise);
    };
    Resource3.EMPTY = new Resource3({});
    return Resource3;
  })()
);

// src/sdk/init.ts
var import_sdk_trace_node = __toESM(require_src2());
var SEMRESATTRS_SERVICE_NAME2 = "service.name";
var SEMRESATTRS_SERVICE_VERSION = "service.version";
var sdkInstance = null;
function createSampler(options) {
  const strategy = options?.strategy ?? "always_on";
  const ratio = options?.ratio ?? 1;
  switch (strategy) {
    case "always_off":
      return new import_sdk_trace_node.AlwaysOffSampler();
    case "ratio":
      return new import_sdk_trace_node.TraceIdRatioBasedSampler(ratio);
    case "parent_based":
      return new import_sdk_trace_node.ParentBasedSampler({
        root: new import_sdk_trace_node.TraceIdRatioBasedSampler(ratio)
      });
    case "always_on":
    default:
      return new import_sdk_trace_node.AlwaysOnSampler();
  }
}
function initOTel(options = {}) {
  if (sdkInstance) {
    if (options.logging !== false) {
      console.log("[OTEL] SDK already initialized, returning existing instance");
    }
    return sdkInstance;
  }
  const serviceName = options.serviceName || process.env.SERVICE_NAME || "moleculer-service";
  const serviceVersion = options.serviceVersion || process.env.SERVICE_VERSION || "1.0.0";
  const environment = options.environment || process.env.NODE_ENV || "development";
  const endpoint = options.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces";
  if (options.logging !== false) {
    console.log(`[OTEL] Service: ${serviceName}`);
    console.log(`[OTEL] Exporting traces to: ${endpoint}`);
  }
  const resourceAttributes = {
    [SEMRESATTRS_SERVICE_NAME2]: serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
    "deployment.environment": environment,
    ...options.resourceAttributes
  };
  const exporter = new OTLPTraceExporter({
    url: endpoint
  });
  const useBatch = options.batchProcessor ?? environment === "production";
  const spanProcessor = useBatch ? new import_sdk_trace_node.BatchSpanProcessor(exporter, {
    maxQueueSize: options.batchOptions?.maxQueueSize ?? 2048,
    maxExportBatchSize: options.batchOptions?.maxExportBatchSize ?? 512,
    scheduledDelayMillis: options.batchOptions?.scheduledDelayMillis ?? 5e3,
    exportTimeoutMillis: options.batchOptions?.exportTimeoutMillis ?? 3e4
  }) : new import_sdk_trace_node.SimpleSpanProcessor(exporter);
  const sampler = createSampler(options.sampling);
  const samplingStrategy = options.sampling?.strategy ?? "always_on";
  const samplingRatio = options.sampling?.ratio ?? 1;
  if (options.logging !== false) {
    console.log(`[OTEL] Span processor: ${useBatch ? "BatchSpanProcessor" : "SimpleSpanProcessor"}`);
    if (samplingStrategy !== "always_on") {
      console.log(`[OTEL] Sampling: ${samplingStrategy}${samplingStrategy === "ratio" || samplingStrategy === "parent_based" ? ` (${(samplingRatio * 100).toFixed(1)}%)` : ""}`);
    }
  }
  if (options.logging !== false && options.instrumentations?.length) {
    console.log(`[OTEL] Instrumentations: ${options.instrumentations.length} registered`);
  }
  const sdk = new NodeSDK({
    resource: new Resource(resourceAttributes),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spanProcessor,
    sampler,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instrumentations: options.instrumentations
  });
  sdk.start();
  sdkInstance = sdk;
  const shutdown = async () => {
    try {
      await sdk.shutdown();
      if (options.logging !== false) {
        console.log("[OTEL] SDK shut down successfully");
      }
    } catch (err) {
      console.error("[OTEL] Error shutting down SDK:", err);
    }
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  return sdk;
}
function getOTelSDK() {
  return sdkInstance;
}
async function shutdownOTel() {
  if (sdkInstance) {
    await sdkInstance.shutdown();
    sdkInstance = null;
  }
}

// src/logging/trace-context.ts
import { trace as trace9, context as context7 } from "@opentelemetry/api";
function getTraceLogContext() {
  const span = trace9.getSpan(context7.active());
  if (!span) {
    return void 0;
  }
  const spanContext = span.spanContext();
  if (!spanContext || !spanContext.traceId) {
    return void 0;
  }
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    sampled: (spanContext.traceFlags & 1) === 1
  };
}
function createLogBindings(prefix) {
  const ctx = getTraceLogContext();
  if (!ctx) {
    return {};
  }
  const p = prefix ? `${prefix}.` : "";
  return {
    [`${p}traceId`]: ctx.traceId,
    [`${p}spanId`]: ctx.spanId,
    [`${p}sampled`]: ctx.sampled
  };
}
function wrapLogFunction(logFn, options) {
  return ((...args) => {
    const ctx = getTraceLogContext();
    if (ctx) {
      const prefix = options?.includeSpanId ? `[traceId=${ctx.traceId} spanId=${ctx.spanId}]` : `[traceId=${ctx.traceId}]`;
      if (typeof args[0] === "string") {
        args[0] = `${prefix} ${args[0]}`;
      } else {
        args.unshift(prefix);
      }
    }
    return logFn(...args);
  });
}
function createTracingLoggerMiddleware() {
  return {
    name: "TracingLoggerMiddleware",
    // Hook into broker created to wrap logger methods
    created(broker) {
      const logger = broker.logger;
      const methods = ["trace", "debug", "info", "warn", "error", "fatal"];
      for (const method of methods) {
        if (typeof logger[method] === "function") {
          const original = logger[method].bind(logger);
          logger[method] = wrapLogFunction(original);
        }
      }
    }
  };
}

// src/index.ts
function createOTelMiddleware(options = {}) {
  const resolvedOptions = resolveOptions(options);
  return createMiddleware(resolvedOptions);
}
function getTracer(name = "moleculer-otel") {
  return trace10.getTracer(name);
}
var index_default = createOTelMiddleware;
export {
  MoleculerMetrics,
  createLogBindings,
  createOTelMiddleware,
  createTracingLoggerMiddleware,
  index_default as default,
  extractContext,
  flattenObject,
  getAllBaggage,
  getBaggage,
  getBaggageValue,
  getMetrics,
  getOTelSDK,
  getTraceLogContext,
  getTracer,
  hasTraceContext,
  initOTel,
  injectContext,
  pickKeys,
  resetMetrics,
  sanitizeAttributeValue,
  shouldExclude,
  shutdownOTel,
  truncateValue,
  withBaggage,
  wrapLogFunction
};
