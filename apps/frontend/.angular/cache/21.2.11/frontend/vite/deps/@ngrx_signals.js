import {
  Injectable,
  isSignal,
  setClassMetadata
} from "./chunk-4LR7QSBV.js";
import {
  DestroyRef,
  Injector,
  assertInInjectionContext,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  ɵɵdefineInjectable
} from "./chunk-KJQRMTR7.js";
import {
  __spreadProps,
  __spreadValues
} from "./chunk-A6W7WELY.js";

// ../../node_modules/.pnpm/@ngrx+signals@21.1.0_@angul_711d0bea8fd0c9a1191dea407e393b90/node_modules/@ngrx/signals/fesm2022/ngrx-signals.mjs
var DEEP_SIGNAL = /* @__PURE__ */ Symbol(typeof ngDevMode !== "undefined" && ngDevMode ? "DEEP_SIGNAL" : "");
function toDeepSignal(signal2) {
  return new Proxy(signal2, {
    has(target, prop) {
      return !!this.get(target, prop, void 0);
    },
    get(target, prop) {
      const value = untracked(target);
      if (!isRecord(value) || !(prop in value)) {
        if (isSignal(target[prop]) && target[prop][DEEP_SIGNAL]) {
          delete target[prop];
        }
        return target[prop];
      }
      if (!isSignal(target[prop])) {
        Object.defineProperty(target, prop, {
          value: computed(() => target()[prop]),
          configurable: true
        });
        target[prop][DEEP_SIGNAL] = true;
      }
      return toDeepSignal(target[prop]);
    }
  });
}
var nonRecords = [WeakSet, WeakMap, Promise, Date, Error, RegExp, ArrayBuffer, DataView, Function];
function isRecord(value) {
  if (value === null || typeof value !== "object" || isIterable(value)) {
    return false;
  }
  let proto = Object.getPrototypeOf(value);
  if (proto === Object.prototype) {
    return true;
  }
  while (proto && proto !== Object.prototype) {
    if (nonRecords.includes(proto.constructor)) {
      return false;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return proto === Object.prototype;
}
function isIterable(value) {
  return typeof value?.[Symbol.iterator] === "function";
}
function deepComputed(computation) {
  return toDeepSignal(computed(computation));
}
function signalMethod(processingFn, config) {
  if (typeof ngDevMode !== "undefined" && ngDevMode && !config?.injector) {
    assertInInjectionContext(signalMethod);
  }
  const watchers = [];
  const sourceInjector = config?.injector ?? inject(Injector);
  const signalMethodFn = (input, config2) => {
    if (isReactiveComputation(input)) {
      const callerInjector = getCallerInjector();
      if (typeof ngDevMode !== "undefined" && ngDevMode && config2?.injector === void 0 && callerInjector === void 0) {
        console.warn("@ngrx/signals: Calling signalMethod outside of an injection", "context with a signal is deprecated. In a future version,", "this will throw an error. Either call it within an injection", "context (e.g. in a constructor or field initializer) or pass", "an injector explicitly via the config parameter.", "\n\nFor more information, see:", "https://ngrx.io/guide/signals/signal-method#automatic-cleanup");
      }
      const instanceInjector = config2?.injector ?? callerInjector ?? sourceInjector;
      const watcher = effect(() => {
        const value = input();
        untracked(() => processingFn(value));
      }, __spreadProps(__spreadValues({}, ngDevMode ? {
        debugName: "watcher"
      } : {}), {
        injector: instanceInjector
      }));
      watchers.push(watcher);
      instanceInjector.get(DestroyRef).onDestroy(() => {
        const ix = watchers.indexOf(watcher);
        if (ix !== -1) {
          watchers.splice(ix, 1);
        }
      });
      return watcher;
    } else {
      processingFn(input);
      return {
        destroy: () => void 0
      };
    }
  };
  signalMethodFn.destroy = () => watchers.forEach((watcher) => watcher.destroy());
  return signalMethodFn;
}
function getCallerInjector() {
  try {
    return inject(Injector);
  } catch (e) {
    return void 0;
  }
}
function isReactiveComputation(value) {
  return typeof value === "function";
}
var STATE_WATCHERS = /* @__PURE__ */ new WeakMap();
var STATE_SOURCE = /* @__PURE__ */ Symbol(typeof ngDevMode !== "undefined" && ngDevMode ? "STATE_SOURCE" : "");
function isWritableSignal(value) {
  return isSignal(value) && "set" in value && "update" in value && typeof value.set === "function" && typeof value.update === "function";
}
function isWritableStateSource(stateSource) {
  const signals = stateSource[STATE_SOURCE];
  return Reflect.ownKeys(stateSource[STATE_SOURCE]).every((key) => {
    return isWritableSignal(signals[key]);
  });
}
function patchState(stateSource, ...updaters) {
  const currentState = untracked(() => getState(stateSource));
  const newState = updaters.reduce((nextState, updater) => __spreadValues(__spreadValues({}, nextState), typeof updater === "function" ? updater(nextState) : updater), currentState);
  const signals = stateSource[STATE_SOURCE];
  const stateKeys = Reflect.ownKeys(stateSource[STATE_SOURCE]);
  for (const key of Reflect.ownKeys(newState)) {
    if (stateKeys.includes(key)) {
      const signalKey = key;
      if (currentState[signalKey] !== newState[signalKey]) {
        signals[signalKey].set(newState[signalKey]);
      }
    } else if (typeof ngDevMode !== "undefined" && ngDevMode) {
      console.warn(`@ngrx/signals: patchState was called with an unknown state slice '${String(key)}'.`, "Ensure that all state properties are explicitly defined in the initial state.", "Updates to properties not present in the initial state will be ignored.");
    }
  }
  notifyWatchers(stateSource);
}
function getState(stateSource) {
  const signals = stateSource[STATE_SOURCE];
  return Reflect.ownKeys(stateSource[STATE_SOURCE]).reduce((state, key) => {
    const value = signals[key]();
    return __spreadProps(__spreadValues({}, state), {
      [key]: value
    });
  }, {});
}
function watchState(stateSource, watcher, config) {
  if (typeof ngDevMode !== "undefined" && ngDevMode && !config?.injector) {
    assertInInjectionContext(watchState);
  }
  const injector = config?.injector ?? inject(Injector);
  const destroyRef = injector.get(DestroyRef);
  addWatcher(stateSource, watcher);
  watcher(getState(stateSource));
  const destroy = () => removeWatcher(stateSource, watcher);
  destroyRef.onDestroy(destroy);
  return {
    destroy
  };
}
function getWatchers(stateSource) {
  return STATE_WATCHERS.get(stateSource[STATE_SOURCE]) || [];
}
function notifyWatchers(stateSource) {
  const watchers = getWatchers(stateSource);
  for (const watcher of watchers) {
    const state = untracked(() => getState(stateSource));
    watcher(state);
  }
}
function addWatcher(stateSource, watcher) {
  const watchers = getWatchers(stateSource);
  STATE_WATCHERS.set(stateSource[STATE_SOURCE], [...watchers, watcher]);
}
function removeWatcher(stateSource, watcher) {
  const watchers = getWatchers(stateSource);
  STATE_WATCHERS.set(stateSource[STATE_SOURCE], watchers.filter((w) => w !== watcher));
}
function signalState(initialState) {
  const stateKeys = Reflect.ownKeys(initialState);
  const stateSource = stateKeys.reduce((signalsDict, key) => __spreadProps(__spreadValues({}, signalsDict), {
    [key]: signal(initialState[key])
  }), {});
  const signalState2 = computed(() => stateKeys.reduce((state, key) => __spreadProps(__spreadValues({}, state), {
    [key]: stateSource[key]()
  }), {}), __spreadValues({}, ngDevMode ? {
    debugName: "signalState"
  } : {}));
  Object.defineProperty(signalState2, STATE_SOURCE, {
    value: stateSource
  });
  for (const key of stateKeys) {
    Object.defineProperty(signalState2, key, {
      value: toDeepSignal(stateSource[key])
    });
  }
  return signalState2;
}
function signalStore(...args) {
  const signalStoreArgs = [...args];
  const config = typeof signalStoreArgs[0] === "function" ? {} : signalStoreArgs.shift();
  const features = signalStoreArgs;
  class SignalStore {
    constructor() {
      const innerStore = features.reduce((store, feature) => feature(store), getInitialInnerStore());
      const {
        stateSignals,
        props,
        methods,
        hooks
      } = innerStore;
      const storeMembers = __spreadValues(__spreadValues(__spreadValues({}, stateSignals), props), methods);
      this[STATE_SOURCE] = innerStore[STATE_SOURCE];
      for (const key of Reflect.ownKeys(storeMembers)) {
        this[key] = storeMembers[key];
      }
      const {
        onInit,
        onDestroy
      } = hooks;
      if (onInit) {
        onInit();
      }
      if (onDestroy) {
        inject(DestroyRef).onDestroy(onDestroy);
      }
    }
    /** @nocollapse */
    static ɵfac = function SignalStore_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || SignalStore)();
    };
    /** @nocollapse */
    static ɵprov = ɵɵdefineInjectable({
      token: SignalStore,
      factory: SignalStore.ɵfac,
      providedIn: config.providedIn || null
    });
  }
  (() => {
    (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(SignalStore, [{
      type: Injectable,
      args: [{
        providedIn: config.providedIn || null
      }]
    }], () => [], null);
  })();
  return SignalStore;
}
function getInitialInnerStore() {
  return {
    [STATE_SOURCE]: {},
    stateSignals: {},
    props: {},
    methods: {},
    hooks: {}
  };
}
function signalStoreFeature(...args) {
  const features = typeof args[0] === "function" ? args : args.slice(1);
  return (inputStore) => features.reduce((store, feature) => feature(store), inputStore);
}
function type() {
  return void 0;
}
function assertUniqueStoreMembers(store, newMemberKeys) {
  const storeMembers = __spreadValues(__spreadValues(__spreadValues({}, store.stateSignals), store.props), store.methods);
  const overriddenKeys = Reflect.ownKeys(storeMembers).filter((memberKey) => newMemberKeys.includes(memberKey));
  if (overriddenKeys.length > 0) {
    console.warn("@ngrx/signals: SignalStore members cannot be overridden.", "Trying to override:", overriddenKeys.map((key) => String(key)).join(", "));
  }
}
function withProps(propsFactory) {
  return (store) => {
    const props = propsFactory(__spreadValues(__spreadValues(__spreadValues({
      [STATE_SOURCE]: store[STATE_SOURCE]
    }, store.stateSignals), store.props), store.methods));
    if (typeof ngDevMode !== "undefined" && ngDevMode) {
      assertUniqueStoreMembers(store, Reflect.ownKeys(props));
    }
    return __spreadProps(__spreadValues({}, store), {
      props: __spreadValues(__spreadValues({}, store.props), props)
    });
  };
}
function withComputed(computedFactory) {
  return withProps((store) => {
    const computedResult = computedFactory(store);
    const computedResultKeys = Reflect.ownKeys(computedResult);
    return computedResultKeys.reduce((prev, key) => {
      const signalOrComputation = computedResult[key];
      return __spreadProps(__spreadValues({}, prev), {
        [key]: isSignal(signalOrComputation) ? signalOrComputation : computed(signalOrComputation)
      });
    }, {});
  });
}
function withFeature(featureFactory) {
  return (store) => {
    const storeForFactory = __spreadValues(__spreadValues(__spreadValues({
      [STATE_SOURCE]: store[STATE_SOURCE]
    }, store.stateSignals), store.props), store.methods);
    return featureFactory(storeForFactory)(store);
  };
}
function withHooks(hooksOrFactory) {
  return (store) => {
    const storeMembers = __spreadValues(__spreadValues(__spreadValues({
      [STATE_SOURCE]: store[STATE_SOURCE]
    }, store.stateSignals), store.props), store.methods);
    const hooks = typeof hooksOrFactory === "function" ? hooksOrFactory(storeMembers) : hooksOrFactory;
    const mergeHooks = (currentHook, hook) => {
      return hook ? () => {
        if (currentHook) {
          currentHook();
        }
        hook(storeMembers);
      } : currentHook;
    };
    return __spreadProps(__spreadValues({}, store), {
      hooks: {
        onInit: mergeHooks(store.hooks.onInit, hooks.onInit),
        onDestroy: mergeHooks(store.hooks.onDestroy, hooks.onDestroy)
      }
    });
  };
}
function withLinkedState(linkedStateFactory) {
  return (store) => {
    const linkedState = linkedStateFactory(__spreadValues(__spreadValues({}, store.stateSignals), store.props));
    const stateKeys = Reflect.ownKeys(linkedState);
    if (typeof ngDevMode !== "undefined" && ngDevMode) {
      assertUniqueStoreMembers(store, stateKeys);
    }
    const stateSource = store[STATE_SOURCE];
    const stateSignals = {};
    for (const key of stateKeys) {
      const signalOrComputationFn = linkedState[key];
      stateSource[key] = isWritableSignal(signalOrComputationFn) ? signalOrComputationFn : linkedSignal(signalOrComputationFn);
      stateSignals[key] = toDeepSignal(stateSource[key]);
    }
    return __spreadProps(__spreadValues({}, store), {
      stateSignals: __spreadValues(__spreadValues({}, store.stateSignals), stateSignals)
    });
  };
}
function withMethods(methodsFactory) {
  return (store) => {
    const methods = methodsFactory(__spreadValues(__spreadValues(__spreadValues({
      [STATE_SOURCE]: store[STATE_SOURCE]
    }, store.stateSignals), store.props), store.methods));
    if (typeof ngDevMode !== "undefined" && ngDevMode) {
      assertUniqueStoreMembers(store, Reflect.ownKeys(methods));
    }
    return __spreadProps(__spreadValues({}, store), {
      methods: __spreadValues(__spreadValues({}, store.methods), methods)
    });
  };
}
function withState(stateOrFactory) {
  return (store) => {
    const state = typeof stateOrFactory === "function" ? stateOrFactory() : stateOrFactory;
    const stateKeys = Reflect.ownKeys(state);
    if (typeof ngDevMode !== "undefined" && ngDevMode) {
      assertUniqueStoreMembers(store, stateKeys);
    }
    const stateSource = store[STATE_SOURCE];
    const stateSignals = {};
    for (const key of stateKeys) {
      stateSource[key] = signal(state[key]);
      stateSignals[key] = toDeepSignal(stateSource[key]);
    }
    return __spreadProps(__spreadValues({}, store), {
      stateSignals: __spreadValues(__spreadValues({}, store.stateSignals), stateSignals)
    });
  };
}
export {
  deepComputed,
  getState,
  isWritableStateSource,
  patchState,
  signalMethod,
  signalState,
  signalStore,
  signalStoreFeature,
  type,
  watchState,
  withComputed,
  withFeature,
  withHooks,
  withLinkedState,
  withMethods,
  withProps,
  withState
};
//# sourceMappingURL=@ngrx_signals.js.map
