/**
 * Pruebas del coordinador de «atrás» con un historial falso.
 *
 *   npx tsx --test lib/layer-history.test.ts
 *
 * El historial falso se porta como el del navegador en lo que importa:
 * `go()` es asíncrono (el popstate llega después, en otra tarea) y
 * `pushState` corta las entradas de delante.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLayerHistory, layerOf, LAYER_KEY } from "./layer-history";

function setup(initialState: unknown = { __NA: true }) {
  const entries: { state: unknown; path: string }[] = [
    { state: { __NA: true }, path: "/actividad" },
    { state: initialState, path: "/coleccion" },
  ];
  let index = 1;
  const tasks: (() => void)[] = [];
  const timers = new Map<number, () => void>();
  let timerId = 0;
  let onPop: (state: unknown) => void = () => {};

  const history = {
    get state() {
      return entries[index].state;
    },
    pushState(data: unknown) {
      entries.splice(index + 1);
      entries.push({ state: data, path: entries[index].path });
      index++;
    },
    replaceState(data: unknown) {
      entries[index] = { ...entries[index], state: data };
    },
    go(delta: number) {
      tasks.push(() => {
        const next = Math.max(0, Math.min(entries.length - 1, index + delta));
        if (next === index) return;
        index = next;
        onPop(entries[index].state);
      });
    },
  };

  const coord = createLayerHistory({
    history,
    path: () => entries[index].path,
    defer: (fn) => tasks.push(fn),
    timer: (fn) => {
      const id = ++timerId;
      timers.set(id, fn);
      return () => timers.delete(id);
    },
  });
  onPop = (s) => coord.pop(s);

  /** run every queued task (deferred flushes and popstates) until quiet */
  const settle = () => {
    for (let i = 0; tasks.length && i < 100; i++) tasks.shift()!();
  };
  /** run just the next queued task */
  const step = () => tasks.shift()?.();
  /** the user's «atrás» */
  const back = () => {
    history.go(-1);
    settle();
  };
  /** Next navigating to a new page */
  const navigate = (path: string) => {
    entries.splice(index + 1);
    entries.push({ state: { __NA: true }, path });
    index++;
  };
  /** Next's router.replace / refresh: same entry, its own state, our mark gone */
  const nextReplace = (path = entries[index].path) => {
    entries[index] = { path, state: { __NA: true, tree: "x" } };
  };

  /** a layer as a component sees it: open, closed by «atrás» or by hand */
  const layer = (name: string, closed: string[]) => {
    let handle: ReturnType<typeof coord.open> | null = null;
    return {
      open() {
        handle = coord.open(() => {
          closed.push(name);
          handle?.close(); // the component's cleanup runs after onClose
          handle = null;
        });
      },
      close() {
        handle?.close();
        handle = null;
      },
      get isOpen() {
        return handle !== null;
      },
    };
  };

  return {
    coord,
    history,
    entries: () => entries.map((e) => `${e.path}#${layerOf(e.state)}`),
    get index() {
      return index;
    },
    current: () => `${entries[index].path}#${layerOf(entries[index].state)}`,
    settle,
    step,
    back,
    navigate,
    nextReplace,
    layer,
    pendingTimers: () => timers.size,
  };
}

test("abrir y «atrás»: una capa, una entrada, y con todo cerrado vuelve a la pantalla anterior", () => {
  const t = setup();
  const closed: string[] = [];
  const sheet = t.layer("ficha", closed);
  sheet.open();
  t.settle();
  assert.equal(t.current(), "/coleccion#1");
  t.back();
  assert.deepEqual(closed, ["ficha"]);
  assert.equal(t.current(), "/coleccion#0");
  t.back();
  assert.equal(t.current(), "/actividad#0");
});

test("el modo estricto de React (abrir, cerrar, abrir en el mismo tick) deja una sola entrada", () => {
  const t = setup();
  const sheet = t.layer("ficha", []);
  sheet.open();
  sheet.close();
  sheet.open();
  t.settle();
  assert.deepEqual(t.entries(), ["/actividad#0", "/coleccion#0", "/coleccion#1"]);
});

test("cerrar una hoja y abrir otra en el mismo toque: la nueva no se cierra sola", () => {
  const t = setup();
  const closed: string[] = [];
  const record = t.layer("ficha", closed);
  const menu = t.layer("menú", closed);
  const confirm = t.layer("borrar", closed);
  record.open();
  t.settle();
  menu.open();
  t.settle();
  assert.equal(t.current(), "/coleccion#2");

  // ⋮ → «Borrar»: el menú se cierra y la confirmación se abre en el mismo commit
  menu.close();
  confirm.open();
  t.settle();
  assert.equal(confirm.isOpen, true, "la confirmación sigue abierta");
  assert.deepEqual(closed, []);
  assert.equal(t.current(), "/coleccion#2");

  t.back();
  assert.deepEqual(closed, ["borrar"]);
  t.back();
  assert.deepEqual(closed, ["borrar", "ficha"]);
  t.back();
  assert.equal(t.current(), "/actividad#0");
});

test("dos capas que se cierran en el mismo commit salen con un solo go()", () => {
  const t = setup();
  const closed: string[] = [];
  const search = t.layer("buscador", closed);
  const scanner = t.layer("escáner", closed);
  search.open();
  t.settle();
  scanner.open();
  t.settle();
  assert.equal(t.current(), "/coleccion#2");

  const go = t.history.go.bind(t.history);
  const deltas: number[] = [];
  t.history.go = (d: number) => {
    deltas.push(d);
    go(d);
  };
  scanner.close();
  search.close();
  t.settle();
  assert.deepEqual(deltas, [-2]);
  assert.equal(t.current(), "/coleccion#0");
  assert.deepEqual(closed, [], "los cierres a mano no llaman a onClose");
  t.back();
  assert.equal(t.current(), "/actividad#0");
  assert.equal(t.pendingTimers(), 0);
});

test("escáner con autoScan → buscador: cerrar los dos y abrir otro deja la cuenta bien", () => {
  const t = setup();
  const closed: string[] = [];
  const search = t.layer("buscador", closed);
  const scanner = t.layer("escáner", closed);
  const sheet = t.layer("ficha", closed);
  search.open();
  scanner.open();
  t.settle();
  scanner.close();
  search.close();
  sheet.open();
  t.settle();
  assert.equal(t.current(), "/coleccion#1");
  t.back();
  assert.deepEqual(closed, ["ficha"]);
  t.back();
  assert.equal(t.current(), "/actividad#0");
});

test("cierres seguidos mientras vuelve el primero: se termina en el suelo", () => {
  const t = setup();
  const a = t.layer("a", []);
  const b = t.layer("b", []);
  a.open();
  b.open();
  t.settle();
  const go = t.history.go.bind(t.history);
  const deltas: number[] = [];
  t.history.go = (d: number) => {
    deltas.push(d);
    go(d);
  };
  b.close();
  t.step(); // el flush: go(-1) en vuelo, el popstate todavía no ha llegado
  a.close();
  t.settle();
  assert.deepEqual(deltas, [-1, -1]);
  assert.equal(t.current(), "/coleccion#0");
  t.back();
  assert.equal(t.current(), "/actividad#0");
});

test("cerrar la de abajo con la de arriba abierta: la de arriba vuelve a tener su entrada", () => {
  const t = setup();
  const closed: string[] = [];
  const a = t.layer("a", closed);
  const b = t.layer("b", closed);
  a.open();
  b.open();
  t.settle();
  a.close();
  t.settle();
  assert.equal(t.current(), "/coleccion#1");
  t.back();
  assert.deepEqual(closed, ["b"]);
  t.back();
  assert.equal(t.current(), "/actividad#0");
});

test("recargar con la ficha abierta y abrir el buscador: un «atrás» lo cierra", () => {
  // la entrada sobrevive a la recarga con su marca, y no hay ninguna capa abierta
  const t = setup({ __NA: true, [LAYER_KEY]: 1 });
  t.coord.settle();
  assert.equal(t.current(), "/coleccion#0", "al montar se limpia la marca colgada");
  const closed: string[] = [];
  const search = t.layer("buscador", closed);
  search.open();
  t.settle();
  assert.equal(t.current(), "/coleccion#1");
  t.back();
  assert.deepEqual(closed, ["buscador"]);
});

test("recargar con la ficha abierta: las entradas muertas salen y un «atrás» vuelve a la pantalla anterior", () => {
  // antes de recargar: la ficha abierta encima de /coleccion
  const t = setup();
  const before = t.layer("ficha", []);
  before.open();
  t.settle();
  assert.equal(t.current(), "/coleccion#1");
  // la recarga: la entrada conserva su estado y nace otro coordinador sin capas
  const reloaded = createLayerHistory({
    history: t.history,
    path: () => t.current().split("#")[0],
    defer: (fn) => fn(),
    timer: () => () => {},
  });
  reloaded.settle();
  t.settle(); // el go() del falso es asíncrono; su popstate va al coordinador viejo, que no cuenta
  reloaded.pop(t.history.state);
  assert.equal(t.current(), "/coleccion#0", "se vuelve a la página de debajo");
  t.back();
  assert.equal(t.current(), "/actividad#0", "un solo «atrás» sale de la pantalla");
});

test("recargar con una marca sin dirección de base: solo se limpia, no se camina a ciegas", () => {
  const t = setup({ __NA: true, [LAYER_KEY]: 1 });
  t.coord.settle();
  t.settle();
  assert.equal(t.current(), "/coleccion#0");
  assert.equal(t.index, 1, "no se ha movido del sitio");
});

test("una marca colgada sin settle también se limpia al abrir", () => {
  const t = setup({ __NA: true, [LAYER_KEY]: 1 });
  const closed: string[] = [];
  const search = t.layer("buscador", closed);
  search.open();
  t.settle();
  assert.equal(t.current(), "/coleccion#1");
  t.back();
  assert.deepEqual(closed, ["buscador"]);
});

test("router.replace de Next con una hoja abierta: el cierre a mano no deja basura", () => {
  const t = setup();
  const closed: string[] = [];
  const sheet = t.layer("ficha", closed);
  sheet.open();
  t.settle();
  t.nextReplace();
  assert.equal(t.current(), "/coleccion#0");
  sheet.close();
  t.settle();
  assert.equal(t.current(), "/coleccion#0");
  assert.equal(t.index, 1, "volvió a la entrada de la página");
  t.back();
  assert.equal(t.current(), "/actividad#0");
});

test("router.replace de Next y otra capa encima: la numeración no se repite", () => {
  const t = setup();
  const closed: string[] = [];
  const a = t.layer("a", closed);
  const b = t.layer("b", closed);
  a.open();
  t.settle();
  t.nextReplace();
  b.open();
  t.settle();
  assert.equal(t.current(), "/coleccion#2");
  t.back();
  assert.deepEqual(closed, ["b"]);
  t.back();
  assert.deepEqual(closed, ["b", "a"]);
});

test("salir con un enlace desde dentro de una capa: primero sale la capa, luego navega", () => {
  const t = setup();
  const closed: string[] = [];
  const search = t.layer("buscador", closed);
  search.open();
  t.settle();
  let navigatedFrom = "";
  t.coord.leave(() => {
    navigatedFrom = t.current();
    t.navigate("/artista/radiohead");
  });
  search.close(); // el onClose del enlace desmonta la capa
  t.settle();
  assert.equal(navigatedFrom, "/coleccion#0");
  assert.deepEqual(t.entries(), ["/actividad#0", "/coleccion#0", "/artista/radiohead#0"]);
  t.back();
  assert.equal(t.current(), "/coleccion#0");
  assert.deepEqual(closed, []);
});

test("una navegación con capas abiertas no se deshace al cerrarlas", () => {
  const t = setup();
  const sheet = t.layer("ficha", []);
  sheet.open();
  t.settle();
  t.navigate("/u/ana");
  sheet.close();
  t.settle();
  assert.equal(t.current(), "/u/ana#0");
});

test("«atrás» con dos capas: solo se cierra la de arriba", () => {
  const t = setup();
  const closed: string[] = [];
  const a = t.layer("ficha", closed);
  const b = t.layer("menú", closed);
  a.open();
  b.open();
  t.settle();
  t.back();
  assert.deepEqual(closed, ["menú"]);
  assert.equal(a.isOpen, true);
});

test("router.replace que solo cambia la query con una hoja abierta: cerrarla no la deshace", () => {
  const t = setup();
  const sheet = t.layer("racks", []);
  sheet.open();
  t.settle();
  t.nextReplace("/coleccion?lista=noche");
  sheet.close();
  t.settle();
  assert.equal(t.current(), "/coleccion?lista=noche#0", "sigue en la query nueva");
});

test("busy: con una capa abierta o su salida en vuelo, y libre al terminar", () => {
  const t = setup();
  const sheet = t.layer("ficha", []);
  assert.equal(t.coord.busy(), false);
  sheet.open();
  assert.equal(t.coord.busy(), true);
  t.settle();
  sheet.close();
  assert.equal(t.coord.busy(), true);
  t.step(); // go(-1) en vuelo
  assert.equal(t.coord.busy(), true);
  t.settle();
  assert.equal(t.coord.busy(), false);
});
