/* Panel de administración: acceso, resultados y análisis, cuentos, preguntas, registros y configuración. */
(function (AL) {
  'use strict';
  const U = AL.ui, h = U.h, S = function () { return AL.store; };
  let D = null; // datos cargados una sola vez por visita al panel
  const F = { momento: '', cuento: '', subcat: '', pregunta: '', estudiante: '', intentos: 'primero', datos: 'todos' };
  const SUBS = Object.keys(AL.SUBCATS), MOMS = Object.keys(AL.MOMENTOS);
  const COLOR_MOM = { inicial: '--dato-m1', intervencion: '--dato-m2', cierre: '--dato-m3' };
  function faseDe(p) { return (D.C[p.cuentoId] || {}).fase || 'intervencion'; }

  async function cargar() {
    const r = await Promise.all([S().listCuentos(), S().listPreguntas(), S().listClaves(), S().listSesiones(), S().listRespuestas(), S().getConfig(), S().info()]);
    D = { cuentos: r[0], preguntas: r[1], claves: r[2], sesiones: r[3], respuestas: r[4], config: r[5], info: r[6] };
    D.P = {}; D.preguntas.forEach(function (p) { D.P[p.id] = p; });
    D.C = {}; D.cuentos.forEach(function (c) { D.C[c.id] = c; });
    D.S = {}; D.sesiones.forEach(function (s) { D.S[s.id] = s; });
    return D;
  }

  /* ---------- pequeños ayudantes de interfaz ---------- */
  function sel(id, etiqueta, opciones, valor, alCambiar) {
    return h('label', { class: 'campo', for: id }, h('span', {}, etiqueta),
      h('select', { id: id, value: valor, onchange: function (e) { alCambiar(e.target.value); } },
        opciones.map(function (o) { return h('option', { value: o[0] }, o[1]); })));
  }
  function campo(id, etiqueta, control, ayuda) {
    control.id = id;
    return h('label', { class: 'campo', for: id }, h('span', {}, etiqueta), control, ayuda ? h('small', { class: 'suave' }, ayuda) : null);
  }
  function tabla(cabeza, filas, vacio) {
    if (!filas.length) return h('p', { class: 'suave' }, vacio || 'Sin datos.');
    return h('div', { class: 'tabla-scroll' }, h('table', {},
      h('thead', {}, h('tr', {}, cabeza.map(function (c) { return h('th', { scope: 'col' }, c); }))),
      h('tbody', {}, filas.map(function (f) { return h('tr', {}, f.map(function (c) { return h('td', {}, c); })); }))));
  }
  function textoSeleccion(p, seleccion) {
    if (!p) return '';
    if (p.tipo === 'orden') {
      const t = {}; p.elementos.forEach(function (e) { t[e.id] = e.texto; });
      return (seleccion || []).map(function (x, k) { return (k + 1) + ') ' + t[x]; }).join(' ');
    }
    return AL.LETRAS[seleccion] + '. ' + p.opciones[seleccion];
  }
  function correcta(r) { return AL.evaluar(D.P[r.preguntaId] || {}, D.claves[r.preguntaId], r.seleccion); }

  /* ---------- cálculo de resultados según filtros ---------- */
  function intentos(resp, modo) {
    if (modo === 'todos') return resp;
    const m = new Map();
    resp.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.intento - b.intento; })
      .forEach(function (r) {
        /* Se agrupa por estudiante (nombre normalizado): si alguien respondió desde dos dispositivos, cuenta una vez. */
        const k = ((D.S[r.sesionId] || {}).nombreNorm || r.sesionId) + '|' + r.preguntaId + '|' + r.momento;
        if (modo === 'ultimo' || !m.has(k)) m.set(k, r);
      });
    return Array.from(m.values());
  }
  function seleccionar(momento) {
    const ses = D.sesiones.filter(function (s) {
      return (F.datos === 'todos' || (F.datos === 'prueba') === !!s.esPrueba) && (!F.estudiante || s.nombreNorm === F.estudiante);
    });
    const idSes = new Set(ses.map(function (s) { return s.id; }));
    const pregs = D.preguntas.filter(function (p) {
      return (!F.cuento || p.cuentoId === F.cuento) && (!F.subcat || p.subcategoria === F.subcat) && (!F.pregunta || p.id === F.pregunta) && (!momento || faseDe(p) === momento);
    });
    const idP = new Set(pregs.map(function (p) { return p.id; }));
    const resp = intentos(D.respuestas.filter(function (r) {
      return idSes.has(r.sesionId) && idP.has(r.preguntaId) && (!momento || r.momento === momento);
    }), F.intentos);
    return { ses: ses, pregs: pregs, resp: resp };
  }
  function calcular() {
    const x = seleccionar(F.momento);
    const conResp = new Set(D.respuestas.filter(function (r) { return !F.momento || r.momento === F.momento; }).map(function (r) { return r.sesionId; }));
    /* Cuentan las sesiones con actividad registrada (en la fase filtrada, si hay filtro). */
    const ses = x.ses.filter(function (s) { return conResp.has(s.id); });
    const pub = x.pregs.filter(function (p) { return p.publicada && (!F.momento || faseDe(p) === F.momento); });
    /* Una pregunta cuenta como «sin responder» solo si la sesión empezó la fase de esa pregunta. */
    const empezo = new Set(D.respuestas.map(function (r) { return r.sesionId + '|' + r.momento; }));
    const hecho = new Set(x.resp.map(function (r) { return r.sesionId + '|' + r.preguntaId; }));
    const R = { ses: ses, pregs: x.pregs, resp: x.resp, sub: {}, porPregunta: [], comp: {}, avisos: [] };
    SUBS.forEach(function (k) { R.sub[k] = { c: 0, i: 0, s: 0 }; });
    const porP = {};
    x.pregs.forEach(function (p) { porP[p.id] = { p: p, conteo: [0, 0, 0, 0], c: 0, i: 0, sinResp: 0 }; R.porPregunta.push(porP[p.id]); });
    let c = 0;
    x.resp.forEach(function (r) {
      const bien = correcta(r), q = porP[r.preguntaId];
      if (bien) { c++; q.c++; R.sub[r.subcategoria].c++; } else { q.i++; R.sub[r.subcategoria].i++; }
      if (q.p.tipo !== 'orden' && r.seleccion >= 0 && r.seleccion < 4) q.conteo[r.seleccion]++;
    });
    let sinResp = 0, actComp = 0, actPend = 0;
    ses.forEach(function (s) {
      pub.forEach(function (p) { if (empezo.has(s.id + '|' + faseDe(p)) && !hecho.has(s.id + '|' + p.id)) { sinResp++; porP[p.id].sinResp++; R.sub[p.subcategoria].s++; } });
      [3, 4, 5].forEach(function (n) {
        const ps = pub.filter(function (p) { return p.modulo === n && empezo.has(s.id + '|' + faseDe(p)); });
        if (!ps.length) return;
        if (ps.every(function (p) { return hecho.has(s.id + '|' + p.id); })) actComp++; else actPend++;
      });
    });
    R.kpi = { personas: new Set(ses.map(function (s) { return s.nombreNorm; })).size, sesiones: ses.length,
      respuestas: x.resp.length, correctas: c, incorrectas: x.resp.length - c, sinResp: sinResp, actComp: actComp, actPend: actPend };

    /* Comparación entre fases: ignora el filtro de momento. */
    const todo = seleccionar('');
    MOMS.forEach(function (m) { R.comp[m] = { n: 0, preguntas: new Set() }; SUBS.forEach(function (k) { R.comp[m][k] = { c: 0, n: 0 }; }); });
    todo.resp.forEach(function (r) {
      const g = R.comp[r.momento]; if (!g) return;
      g.n++; g.preguntas.add(r.preguntaId); g[r.subcategoria].n++;
      if (correcta(r)) g[r.subcategoria].c++;
    });
    const con = MOMS.filter(function (m) { return R.comp[m].n; });
    if (con.length < 2) R.avisos.push('Hay respuestas en ' + con.length + ' fase(s). Se necesitan al menos dos para comparar.');
    else {
      const firma = con.map(function (m) { return Array.from(R.comp[m].preguntas).sort().join(','); });
      if (firma.some(function (f) { return f !== firma[0]; })) R.avisos.push('Cada fase usa un cuento y preguntas distintos: los porcentajes describen cada fase, pero no son directamente comparables.');
      else R.avisos.push('Las fases comparten las mismas preguntas. Si un estudiante ya las conocía, el resultado puede reflejar recuerdo y no solo comprensión.');
    }
    return R;
  }

  /* ---------- acceso ---------- */
  function acceso(cont) {
    const correo = h('input', { type: 'email', autocomplete: 'username', required: true });
    const clave = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const error = h('p', { class: 'error', role: 'alert', hidden: true });
    async function entrar(ev) {
      ev.preventDefault();
      try { await S().adminLogin(correo.value.trim(), clave.value); D = null; AL.navegar(); }
      catch (e) { console.error(e); error.textContent = e.code ? AL.explicarError(e).causa + ' (' + e.code + ')' : e.message; error.hidden = false; }
    }
    async function recuperar() {
      try { await S().adminRecuperar(correo.value.trim()); U.aviso('Revise su correo.'); }
      catch (e) { error.textContent = e.message; error.hidden = false; }
    }
    cont.appendChild(h('section', { class: 'tarjeta angosta' },
      h('h1', {}, 'Panel de administración'),
      AL.config.modo === 'local' ? h('p', { class: 'nota' }, h('strong', {}, 'Modo prototipo. '),
        'Este acceso todavía no es seguro: acepta cualquier correo y una contraseña de 6 caracteres. La autenticación real se activará al conectar Firebase.') : null,
      h('form', { class: 'formulario', novalidate: true, onsubmit: entrar },
        campo('admin-correo', 'Correo electrónico', correo),
        campo('admin-clave', 'Contraseña', clave),
        error,
        h('button', { class: 'boton grande', type: 'submit' }, 'Iniciar sesión'),
        h('button', { class: 'enlace', type: 'button', onclick: recuperar }, 'Olvidé mi contraseña')),
      h('p', {}, h('a', { class: 'enlace', href: '#inicio' }, '← Volver al inicio'))));
  }

  /* ---------- resultados y análisis ---------- */
  function resultados(cont) {
    const R = calcular(), k = R.kpi;
    const nombres = {};
    D.sesiones.forEach(function (s) { nombres[s.nombreNorm] = s.nombre; });
    function cambia(campoF) { return function (v) { F[campoF] = v; if (campoF === 'cuento' || campoF === 'subcat') F.pregunta = ''; AL.navegar(); }; }
    const pregsFiltro = D.preguntas.filter(function (p) { return (!F.cuento || p.cuentoId === F.cuento) && (!F.subcat || p.subcategoria === F.subcat); });

    cont.appendChild(h('section', { class: 'filtros', 'aria-label': 'Filtros' },
      sel('f-momento', 'Fase', [['', 'Todas']].concat(MOMS.map(function (m) { return [m, AL.MOMENTOS[m]]; })), F.momento, cambia('momento')),
      sel('f-cuento', 'Cuento o actividad', [['', 'Todos']].concat(D.cuentos.map(function (c) { return [c.id, c.titulo]; })), F.cuento, cambia('cuento')),
      sel('f-subcat', 'Módulo y subcategoría', [['', 'Todas']].concat(SUBS.map(function (s) { return [s, 'M' + AL.SUBCATS[s].modulo + ' · ' + AL.SUBCATS[s].corto]; })), F.subcat, cambia('subcat')),
      sel('f-pregunta', 'Pregunta', [['', 'Todas']].concat(pregsFiltro.map(function (p) { return [p.id, p.orden + '. ' + p.enunciado.slice(0, 50)]; })), F.pregunta, cambia('pregunta')),
      sel('f-estudiante', 'Estudiante', [['', 'Todos']].concat(Object.keys(nombres).sort().map(function (n) { return [n, nombres[n]]; })), F.estudiante, cambia('estudiante')),
      sel('f-intentos', 'Intentos que se cuentan', [['primero', 'Solo el primer intento'], ['ultimo', 'Solo el último intento'], ['todos', 'Todos los intentos']], F.intentos, cambia('intentos')),
      sel('f-datos', 'Tipo de registro', [['todos', 'Reales y de prueba'], ['real', 'Solo reales'], ['prueba', 'Solo de prueba']], F.datos, cambia('datos'))));

    if (!D.respuestas.length) {
      cont.appendChild(h('p', { class: 'nota' }, 'Todavía no hay respuestas registradas en este dispositivo. Ingrese como estudiante y responda, o genere registros de demostración en la pestaña Configuración.'));
    }
    if (D.sesiones.some(function (s) { return s.esPrueba; }) && F.datos !== 'real') {
      cont.appendChild(h('p', { class: 'nota' }, 'Los resultados incluyen registros de prueba. Para analizar solo datos reales, cambie el filtro «Tipo de registro».'));
    }

    function tile(valor, texto, detalle) { return h('div', { class: 'indicador' }, h('strong', {}, valor), h('span', {}, texto), detalle ? h('small', { class: 'suave' }, detalle) : null); }
    cont.appendChild(h('section', { class: 'indicadores', 'aria-label': 'Indicadores generales' },
      tile(k.personas, 'Estudiantes', 'por nombre escrito · ' + k.sesiones + (k.sesiones === 1 ? ' sesión' : ' sesiones')),
      tile(k.respuestas, 'Respuestas registradas'),
      tile(k.correctas, 'Correctas', U.pct(k.correctas, k.respuestas) + ' % de las respondidas'),
      tile(k.incorrectas, 'Incorrectas', U.pct(k.incorrectas, k.respuestas) + ' % de las respondidas'),
      tile(k.sinResp, 'Sin responder', 'preguntas publicadas no contestadas'),
      tile(k.actComp, 'Actividades completadas', k.actPend + ' pendientes')));

    /* Por subcategoría */
    const cvSub = h('canvas', { role: 'img', 'aria-label': 'Respuestas correctas, incorrectas y sin responder por subcategoría' });
    cont.appendChild(h('section', { class: 'tarjeta' },
      h('h2', {}, 'Resultados por subcategoría'),
      h('div', { class: 'lienzo' }, cvSub),
      tabla(['Subcategoría', 'Correctas', 'Incorrectas', 'Sin responder', '% correctas'], SUBS.map(function (s) {
        const v = R.sub[s];
        return [AL.SUBCATS[s].nombre, v.c, v.i, v.s, v.c + v.i ? U.pct(v.c, v.c + v.i) + ' %' : '—'];
      })),
      h('p', { class: 'suave' }, 'El porcentaje se calcula sobre las preguntas respondidas. Con pocas preguntas por subcategoría, una sola respuesta cambia mucho el porcentaje.')));
    AL.graficos.apiladas(cvSub, SUBS.map(function (s) { return AL.SUBCATS[s].corto; }), [
      { nombre: 'Correctas', color: '--dato-bien', valores: SUBS.map(function (s) { return R.sub[s].c; }) },
      { nombre: 'Incorrectas', color: '--dato-mal', valores: SUBS.map(function (s) { return R.sub[s].i; }) },
      { nombre: 'Sin responder', color: '--dato-neutro', valores: SUBS.map(function (s) { return R.sub[s].s; }) }]);

    /* Comparación entre fases */
    const cvComp = h('canvas', { role: 'img', 'aria-label': 'Porcentaje de respuestas correctas por subcategoría en cada fase' });
    cont.appendChild(h('section', { class: 'tarjeta' },
      h('h2', {}, 'Comparación entre fases'),
      h('p', { class: 'suave' }, 'Porcentaje de respuestas correctas por subcategoría. Esta sección no usa el filtro de fase.'),
      h('div', { class: 'lienzo' }, cvComp),
      tabla(['Fase', 'Respuestas válidas', 'Preguntas distintas'].concat(SUBS.map(function (s) { return AL.SUBCATS[s].corto; })), MOMS.map(function (m) {
        const g = R.comp[m];
        return [AL.MOMENTOS[m], g.n, g.preguntas.size].concat(SUBS.map(function (s) { return g[s].n ? g[s].c + ' de ' + g[s].n + ' (' + U.pct(g[s].c, g[s].n) + ' %)' : '—'; }));
      })),
      h('ul', { class: 'notas' }, R.avisos.map(function (a) { return h('li', {}, a); }),
        h('li', {}, 'Las diferencias son descriptivas. No demuestran por sí solas que el cambio se deba a la intervención.'))));
    AL.graficos.agrupadas(cvComp, SUBS.map(function (s) { return AL.SUBCATS[s].corto; }), MOMS.map(function (m) {
      return { nombre: AL.MOMENTOS[m], color: COLOR_MOM[m],
        valores: SUBS.map(function (s) { const g = R.comp[m][s]; return g.n ? U.pct(g.c, g.n) : null; }),
        detalle: SUBS.map(function (s) { const g = R.comp[m][s]; return g.n ? g.c + ' de ' + g.n + ' correctas (' + U.pct(g.c, g.n) + ' %)' : ''; }) };
    }));

    /* Por pregunta */
    const zonaP = h('div', { class: 'rejilla dos' });
    cont.appendChild(h('section', {}, h('h2', {}, 'Distribución de respuestas por pregunta'), zonaP));
    R.porPregunta.forEach(function (q) {
      const p = q.p, validas = q.c + q.i;
      const tarjeta = h('article', { class: 'tarjeta' },
        h('p', { class: 'eti' }, (D.C[p.cuentoId] ? D.C[p.cuentoId].titulo : '') + ' · ' + AL.SUBCATS[p.subcategoria].corto + (p.publicada ? '' : ' · No publicada')),
        h('h3', {}, p.orden + '. ' + p.enunciado));
      if (p.tipo === 'orden') {
        tarjeta.appendChild(h('p', {}, 'Actividad de ordenamiento: ' + q.c + ' correctas y ' + q.i + ' incorrectas.'));
      } else {
        const cv = h('canvas', { role: 'img', 'aria-label': 'Veces que se eligió cada opción' });
        const detalle = h('p', { class: 'suave', role: 'status' }, 'Toque una barra para ver el texto de la opción.');
        const clave = D.claves[p.id] ? D.claves[p.id].correcta : -1;
        tarjeta.appendChild(h('div', { class: 'lienzo bajo' }, cv));
        tarjeta.appendChild(detalle);
        tarjeta.appendChild(h('ul', { class: 'lista-opciones' }, p.opciones.map(function (t, i) {
          return h('li', { class: i === clave ? 'correcta' : '' }, h('strong', {}, AL.LETRAS[i] + (i === clave ? ' ✔' : '')), h('span', {}, t),
            h('span', { class: 'num' }, q.conteo[i] + ' · ' + U.pct(q.conteo[i], validas) + ' %'));
        })));
        AL.graficos.opciones(cv, p.opciones, q.conteo, clave, function (i) {
          detalle.textContent = AL.LETRAS[i] + '. ' + p.opciones[i] + ': elegida ' + q.conteo[i] + ' veces (' + U.pct(q.conteo[i], validas) + ' %).';
        });
      }
      tarjeta.appendChild(h('p', { class: 'suave' }, 'Respuestas válidas: ' + validas + ' · Sin responder: ' + q.sinResp));
      zonaP.appendChild(tarjeta);
    });

    /* Exportación */
    const anon = h('input', { type: 'checkbox', id: 'exp-anon' });
    cont.appendChild(h('section', { class: 'tarjeta' },
      h('h2', {}, 'Exportar a CSV'),
      h('p', { class: 'suave' }, 'Los archivos respetan los filtros aplicados arriba.'),
      h('label', { class: 'casilla', for: 'exp-anon' }, anon, 'Reemplazar los nombres por códigos (E01, E02…)'),
      h('div', { class: 'fila' },
        h('button', { class: 'boton claro', type: 'button', onclick: function () { exportarRespuestas(R, anon.checked); } }, 'Registros de respuestas'),
        h('button', { class: 'boton claro', type: 'button', onclick: function () { exportarDistribucion(R); } }, 'Distribución por pregunta'),
        h('button', { class: 'boton claro', type: 'button', onclick: function () { exportarResumen(R); } }, 'Resumen por subcategoría y fase'))));
  }

  function codigos() {
    const m = {};
    Array.from(new Set(D.sesiones.map(function (s) { return s.nombreNorm; }))).sort().forEach(function (n, i) { m[n] = 'E' + String(i + 1).padStart(2, '0'); });
    return m;
  }
  function exportarRespuestas(R, anonimo) {
    const cod = codigos();
    const filas = [['fecha', 'estudiante', 'sesion', 'fase', 'id_actividad', 'actividad', 'subcategoria', 'id_pregunta', 'pregunta', 'tipo', 'opcion', 'seleccion', 'resultado', 'intento', 'registro']];
    R.resp.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }).forEach(function (r) {
      const s = D.S[r.sesionId] || {}, p = D.P[r.preguntaId];
      filas.push([r.fecha, anonimo ? cod[s.nombreNorm] : s.nombre, r.sesionId, AL.FASES[r.momento], r.cuentoId, D.C[r.cuentoId] ? D.C[r.cuentoId].titulo : '',
        AL.SUBCATS[r.subcategoria].nombre, r.preguntaId, p ? p.enunciado : '', r.tipo === 'orden' ? 'Ordenamiento' : 'Selección múltiple',
        r.tipo === 'orden' ? '' : AL.LETRAS[r.seleccion], textoSeleccion(p, r.seleccion), correcta(r) ? 'Correcta' : 'Incorrecta', r.intento, r.esPrueba ? 'Prueba' : 'Real']);
    });
    U.descargarCSV('aventura-lectora-respuestas.csv', filas);
  }
  function exportarDistribucion(R) {
    const filas = [['cuento', 'subcategoria', 'pregunta', 'opcion', 'texto', 'es_correcta', 'frecuencia', 'porcentaje', 'respuestas_validas', 'sin_responder']];
    R.porPregunta.forEach(function (q) {
      const p = q.p, v = q.c + q.i, t = D.C[p.cuentoId] ? D.C[p.cuentoId].titulo : '';
      if (p.tipo === 'orden') {
        filas.push([t, AL.SUBCATS[p.subcategoria].nombre, p.enunciado, 'Orden correcto', '', 'Sí', q.c, U.pct(q.c, v), v, q.sinResp]);
        filas.push([t, AL.SUBCATS[p.subcategoria].nombre, p.enunciado, 'Otro orden', '', 'No', q.i, U.pct(q.i, v), v, q.sinResp]);
      } else p.opciones.forEach(function (o, i) {
        filas.push([t, AL.SUBCATS[p.subcategoria].nombre, p.enunciado, AL.LETRAS[i], o, D.claves[p.id] && D.claves[p.id].correcta === i ? 'Sí' : 'No', q.conteo[i], U.pct(q.conteo[i], v), v, q.sinResp]);
      });
    });
    U.descargarCSV('aventura-lectora-distribucion.csv', filas);
  }
  function exportarResumen(R) {
    const filas = [['fase', 'subcategoria', 'correctas', 'incorrectas', 'respuestas_validas', 'porcentaje_correctas', 'preguntas_distintas_de_la_fase']];
    MOMS.forEach(function (m) { SUBS.forEach(function (s) {
      const g = R.comp[m][s];
      filas.push([AL.MOMENTOS[m], AL.SUBCATS[s].nombre, g.c, g.n - g.c, g.n, g.n ? U.pct(g.c, g.n) : '', R.comp[m].preguntas.size]);
    }); });
    U.descargarCSV('aventura-lectora-resumen.csv', filas);
  }

  /* ---------- cuentos ---------- */
  function cuentos(cont) {
    const zona = h('div', {});
    function lista() {
      U.limpiar(zona);
      zona.appendChild(h('div', { class: 'fila entre' }, h('h2', {}, 'Cuentos'),
        h('button', { class: 'boton', type: 'button', onclick: function () { editar({ titulo: '', resumen: '', fase: 'intervencion', publicado: false, portada: 'generica', escenas: [{ texto: '', alt: '', imagen: '' }] }); } }, '+ Nuevo cuento')));
      zona.appendChild(tabla(['Título', 'Fase', 'Escenas', 'Preguntas', 'Estado', 'Acciones'], D.cuentos.map(function (c) {
        const n = D.preguntas.filter(function (p) { return p.cuentoId === c.id; }).length;
        return [(c.mision ? c.mision.etiqueta + ': ' : '') + c.titulo, AL.FASES[c.fase || 'intervencion'], c.escenas.length, n, h('span', { class: 'pildora ' + (c.publicado ? 'si' : '') }, c.publicado ? 'Publicado' : 'Borrador'),
          h('div', { class: 'fila' },
            h('button', { class: 'boton claro chico', type: 'button', onclick: function () { editar(JSON.parse(JSON.stringify(c))); } }, 'Editar'),
            h('button', { class: 'boton claro chico', type: 'button', onclick: async function () { c.publicado = !c.publicado; await S().saveCuento(c); await cargar(); lista(); } }, c.publicado ? 'Despublicar' : 'Publicar'),
            h('button', { class: 'boton claro chico', type: 'button', onclick: async function () {
              if (!await U.confirmar('¿Eliminar «' + c.titulo + '»?', 'También se eliminarán sus ' + n + ' preguntas. Las respuestas ya registradas se conservan.', 'Eliminar')) return;
              await S().deleteCuento(c.id); await cargar(); lista();
            } }, 'Eliminar'))];
      }), 'No hay cuentos.'));
    }
    function editar(c) {
      U.limpiar(zona);
      const escenas = h('div', { class: 'pila' });
      function pintarEscenas() {
        U.limpiar(escenas);
        c.escenas.forEach(function (e, i) {
          escenas.appendChild(h('fieldset', { class: 'escena-ed' }, h('legend', {}, 'Escena ' + (i + 1)),
            campo('esc-texto-' + i, 'Texto de la escena', h('textarea', { rows: 4, value: e.texto, oninput: function (ev) { e.texto = ev.target.value; } })),
            campo('esc-img-' + i, 'Imagen (opcional)', h('input', { type: 'text', value: e.imagen || '', placeholder: 'assets/images/mi-cuento-1.png', oninput: function (ev) { e.imagen = ev.target.value.trim(); } }),
              'Ruta de un archivo del repositorio o dirección web. Si se deja vacío se usa un dibujo genérico.'),
            campo('esc-alt-' + i, 'Descripción de la imagen', h('input', { type: 'text', value: e.alt || '', oninput: function (ev) { e.alt = ev.target.value; } })),
            c.escenas.length > 1 ? h('button', { class: 'boton claro chico', type: 'button', onclick: function () { c.escenas.splice(i, 1); pintarEscenas(); } }, 'Quitar escena') : null));
        });
      }
      pintarEscenas();
      const pub = h('input', { type: 'checkbox', id: 'cuento-pub', checked: c.publicado, onchange: function (ev) { c.publicado = ev.target.checked; } });
      async function guardar(ev) {
        ev.preventDefault();
        c.titulo = c.titulo.trim();
        c.escenas = c.escenas.filter(function (e) { return e.texto.trim(); });
        if (!c.titulo || !c.escenas.length) { U.aviso('Escriba el título y al menos una escena con texto.', 'error'); if (!c.escenas.length) { c.escenas = [{ texto: '' }]; pintarEscenas(); } return; }
        await S().saveCuento(c); await cargar(); U.aviso('Cuento guardado.'); lista();
      }
      zona.appendChild(h('form', { class: 'tarjeta formulario', onsubmit: guardar },
        h('h2', {}, c.id ? 'Editar cuento' : 'Nuevo cuento'),
        campo('cuento-titulo', 'Título', h('input', { type: 'text', value: c.titulo, oninput: function (ev) { c.titulo = ev.target.value; } })),
        sel('cuento-fase', 'Fase a la que pertenece', Object.keys(AL.FASES).map(function (f) { return [f, AL.FASES[f]]; }), c.fase || 'intervencion', function (v) { c.fase = v; }),
        h('p', { class: 'suave' }, 'En el diagnóstico inicial y en el cierre cada pregunta se responde una sola vez y sin retroalimentación. En la intervención hay retroalimentación y reintentos.'),
        c.mision ? campo('cuento-proposito', 'Propósito de la misión', h('textarea', { rows: 3, value: c.mision.proposito || '', oninput: function (ev) { c.mision.proposito = ev.target.value; } })) : null,
        campo('cuento-resumen', 'Resumen breve', h('input', { type: 'text', value: c.resumen || '', oninput: function (ev) { c.resumen = ev.target.value; } })),
        escenas,
        h('button', { class: 'boton claro', type: 'button', onclick: function () { c.escenas.push({ texto: '', alt: '', imagen: '' }); pintarEscenas(); } }, '+ Agregar escena'),
        h('label', { class: 'casilla', for: 'cuento-pub' }, pub, 'Publicado (visible para los estudiantes)'),
        h('div', { class: 'fila' }, h('button', { class: 'boton', type: 'submit' }, 'Guardar cuento'),
          h('button', { class: 'boton claro', type: 'button', onclick: lista }, 'Cancelar'))));
    }
    cont.appendChild(zona);
    lista();
  }

  /* ---------- preguntas ---------- */
  let cuentoPreg = '';
  function preguntas(cont) {
    const zona = h('div', {});
    function lista() {
      U.limpiar(zona);
      if (!D.cuentos.length) { zona.appendChild(h('p', { class: 'nota' }, 'Primero cree un cuento.')); return; }
      if (!D.C[cuentoPreg]) cuentoPreg = D.cuentos[0].id;
      const ps = D.preguntas.filter(function (p) { return p.cuentoId === cuentoPreg; });
      zona.appendChild(h('div', { class: 'fila entre' },
        sel('preg-cuento', 'Cuento', D.cuentos.map(function (c) { return [c.id, c.titulo]; }), cuentoPreg, function (v) { cuentoPreg = v; lista(); }),
        h('button', { class: 'boton', type: 'button', onclick: function () {
          editar({ cuentoId: cuentoPreg, tipo: 'opcion', subcategoria: 'reconocimiento', enunciado: '', opciones: ['', '', '', ''], escenaRef: 1,
            orden: ps.length + 1, publicada: true, retroOk: '¡Muy bien! Encontraste la información en el cuento.', retroMal: 'Todavía no. Vuelve a leer el cuento con atención.' }, { correcta: 0 });
        } }, '+ Nueva pregunta')));
      zona.appendChild(tabla(['N.º', 'Enunciado', 'Subcategoría', 'Tipo', 'Estado', 'Acciones'], ps.map(function (p) {
        return [p.orden, p.enunciado, 'M' + p.modulo + ' · ' + AL.SUBCATS[p.subcategoria].corto, p.tipo === 'orden' ? 'Ordenamiento' : 'Selección A-D',
          h('span', { class: 'pildora ' + (p.publicada ? 'si' : '') }, p.publicada ? 'Publicada' : 'Borrador'),
          h('div', { class: 'fila' },
            h('button', { class: 'boton claro chico', type: 'button', onclick: function () { editar(JSON.parse(JSON.stringify(p)), JSON.parse(JSON.stringify(D.claves[p.id] || {}))); } }, 'Editar'),
            h('button', { class: 'boton claro chico', type: 'button', onclick: async function () { p.publicada = !p.publicada; await S().savePregunta(p); await cargar(); lista(); } }, p.publicada ? 'Despublicar' : 'Publicar'),
            h('button', { class: 'boton claro chico', type: 'button', onclick: async function () {
              if (!await U.confirmar('¿Eliminar esta pregunta?', p.enunciado, 'Eliminar')) return;
              await S().deletePregunta(p.id); await cargar(); lista();
            } }, 'Eliminar'))];
      }), 'Este cuento todavía no tiene preguntas.'));
    }
    function editar(p, clave) {
      U.limpiar(zona);
      const cuerpo = h('div', { class: 'pila' });
      let lineas = '';
      if (p.tipo === 'orden' && clave.orden) {
        const t = {}; p.elementos.forEach(function (e) { t[e.id] = e.texto; });
        lineas = clave.orden.map(function (x) { return t[x]; }).join('\n');
      }
      function pintarCuerpo() {
        U.limpiar(cuerpo);
        if (p.tipo === 'orden') {
          cuerpo.appendChild(campo('preg-lineas', 'Acontecimientos en el orden correcto (uno por línea, entre 3 y 6)',
            h('textarea', { rows: 6, value: lineas, oninput: function (ev) { lineas = ev.target.value; } }), 'El estudiante los verá desordenados.'));
        } else {
          p.opciones = p.opciones || ['', '', '', ''];
          cuerpo.appendChild(h('fieldset', {}, h('legend', {}, 'Opciones. Marque la respuesta correcta.'),
            p.opciones.map(function (o, i) {
              return h('div', { class: 'opcion-ed' },
                h('input', { type: 'radio', name: 'preg-correcta', id: 'preg-corr-' + i, checked: clave.correcta === i, 'aria-label': 'La opción ' + AL.LETRAS[i] + ' es la correcta', onchange: function () { clave.correcta = i; } }),
                h('label', { for: 'preg-op-' + i }, AL.LETRAS[i]),
                h('input', { type: 'text', id: 'preg-op-' + i, value: o, oninput: function (ev) { p.opciones[i] = ev.target.value; } }));
            })));
        }
      }
      pintarCuerpo();
      const pub = h('input', { type: 'checkbox', id: 'preg-pub', checked: p.publicada, onchange: function (ev) { p.publicada = ev.target.checked; } });
      async function guardar(ev) {
        ev.preventDefault();
        p.enunciado = p.enunciado.trim();
        p.modulo = AL.SUBCATS[p.subcategoria].modulo;
        p.orden = Number(p.orden) || 1; p.escenaRef = Number(p.escenaRef) || 1;
        if (!p.enunciado) return U.aviso('Escriba el enunciado.', 'error');
        let claveFinal;
        if (p.tipo === 'orden') {
          const ls = lineas.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
          if (ls.length < 3 || ls.length > 6) return U.aviso('Escriba entre 3 y 6 acontecimientos.', 'error');
          const el = ls.map(function (t, i) { return { id: 'e' + (i + 1), texto: t }; });
          claveFinal = { orden: el.map(function (e) { return e.id; }) };
          p.elementos = el.slice(1).concat(el.slice(0, 1)).reverse(); // orden de presentación distinto del correcto
          if (el.length === 3) p.elementos = [el[1], el[2], el[0]];
          delete p.opciones;
        } else {
          p.opciones = p.opciones.map(function (o) { return o.trim(); });
          if (p.opciones.some(function (o) { return !o; })) return U.aviso('Escriba las cuatro opciones.', 'error');
          if (new Set(p.opciones.map(function (o) { return o.toLowerCase(); })).size < 4) return U.aviso('Las cuatro opciones deben ser diferentes.', 'error');
          if (!(clave.correcta >= 0)) return U.aviso('Marque la respuesta correcta.', 'error');
          claveFinal = { correcta: clave.correcta };
          delete p.elementos;
        }
        await S().savePregunta(p, claveFinal); await cargar(); U.aviso('Pregunta guardada.'); lista();
      }
      zona.appendChild(h('form', { class: 'tarjeta formulario', onsubmit: guardar },
        h('h2', {}, p.id ? 'Editar pregunta' : 'Nueva pregunta'),
        p.id && D.respuestas.some(function (r) { return r.preguntaId === p.id; })
          ? h('p', { class: 'nota' }, 'Esta pregunta ya tiene respuestas. Si cambia las opciones o la clave, los resultados anteriores se recalculan con la nueva clave.') : null,
        sel('preg-sub', 'Subcategoría (define el módulo)', SUBS.map(function (s) { return [s, 'Módulo ' + AL.SUBCATS[s].modulo + ' · ' + AL.SUBCATS[s].nombre]; }), p.subcategoria, function (v) { p.subcategoria = v; }),
        sel('preg-tipo', 'Tipo de actividad', [['opcion', 'Selección múltiple (A-D)'], ['orden', 'Ordenar acontecimientos']], p.tipo, function (v) { p.tipo = v; pintarCuerpo(); }),
        campo('preg-enunciado', 'Enunciado', h('textarea', { rows: 2, value: p.enunciado, oninput: function (ev) { p.enunciado = ev.target.value; } })),
        cuerpo,
        campo('preg-retro-ok', 'Mensaje cuando acierta', h('input', { type: 'text', value: p.retroOk || '', oninput: function (ev) { p.retroOk = ev.target.value; } })),
        campo('preg-retro-mal', 'Mensaje cuando no acierta', h('input', { type: 'text', value: p.retroMal || '', oninput: function (ev) { p.retroMal = ev.target.value; } }),
          'Oriente hacia la escena donde está la información, sin dar la respuesta.'),
        campo('preg-explicacion', 'Explicación de la respuesta correcta (opcional)', h('textarea', { rows: 2, value: p.explicacion || '', oninput: function (ev) { p.explicacion = ev.target.value; } }),
          'Se muestra en las misiones lectoras después de responder.'),
        campo('preg-evidencia', 'Fragmento del cuento que contiene la respuesta (opcional)', h('input', { type: 'text', value: p.evidencia || '', oninput: function (ev) { p.evidencia = ev.target.value; } }),
          'Cópielo exactamente como aparece en la escena de referencia para que se resalte.'),
        h('div', { class: 'fila' },
          campo('preg-escena', 'Escena de referencia', h('input', { type: 'number', min: 1, value: p.escenaRef, oninput: function (ev) { p.escenaRef = ev.target.value; } })),
          campo('preg-orden', 'Orden de presentación', h('input', { type: 'number', min: 1, value: p.orden, oninput: function (ev) { p.orden = ev.target.value; } }))),
        h('label', { class: 'casilla', for: 'preg-pub' }, pub, 'Publicada'),
        h('div', { class: 'fila' }, h('button', { class: 'boton', type: 'submit' }, 'Guardar pregunta'),
          h('button', { class: 'boton claro', type: 'button', onclick: lista }, 'Cancelar'))));
    }
    cont.appendChild(zona);
    lista();
  }

  /* ---------- registros: progreso por estudiante y respuestas ---------- */
  function registros(cont) {
    const pub = D.preguntas.filter(function (p) { return p.publicada; });
    cont.appendChild(h('section', { class: 'tarjeta' }, h('h2', {}, 'Progreso por sesión'),
      tabla(['Estudiante', 'Fases con respuestas', 'Inicio', 'Lecturas', 'Preguntas respondidas', 'Correctas (primer intento)', 'Registro', 'Acciones'],
        D.sesiones.slice().sort(function (a, b) { return a.inicio < b.inicio ? 1 : -1; }).map(function (s) {
          const rs = intentos(D.respuestas.filter(function (r) { return r.sesionId === s.id; }), 'primero');
          const dist = new Set(rs.map(function (r) { return r.preguntaId; })).size;
          return [s.nombre, Object.keys(AL.FASES).filter(function (f) { return rs.some(function (r) { return r.momento === f; }); }).map(function (f) { return AL.FASES[f]; }).join(', ') || '—', U.fecha(s.inicio), Object.keys(s.lecturas || {}).length + ' de ' + D.cuentos.filter(function (c) { return c.publicado; }).length,
            dist + ' de ' + pub.length, rs.filter(correcta).length, s.esPrueba ? 'Prueba' : 'Real',
            h('button', { class: 'boton claro chico', type: 'button', onclick: async function () {
              const n = D.respuestas.filter(function (r) { return r.sesionId === s.id; }).length;
              if (!await U.confirmar('¿Eliminar a «' + s.nombre + '»?', 'Se borrarán esta sesión y sus ' + n + ' respuestas. No se puede deshacer. Si el estudiante vuelve a entrar, empezará de cero.', 'Eliminar')) return;
              try { await S().borrarSesion(s.id); D = null; U.aviso('Registro de ' + s.nombre + ' eliminado.'); AL.navegar(); }
              catch (e) { console.error(e); U.aviso('No se pudo eliminar: ' + AL.explicarError(e).causa, 'error'); }
            } }, 'Eliminar')];
        }), 'Aún no hay sesiones de estudiantes.'),
      h('p', { class: 'suave' }, 'Eliminar borra la sesión y todas sus respuestas en todas las fases. Úselo para registros de prueba o entradas equivocadas; no borre participantes reales sin respaldar antes con la exportación CSV.')));
    const ult = D.respuestas.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).slice(0, 100);
    cont.appendChild(h('section', { class: 'tarjeta' }, h('h2', {}, 'Últimas respuestas'),
      h('p', { class: 'suave' }, 'Se muestran las 100 más recientes de ' + D.respuestas.length + '. Para el registro completo use la exportación en Resultados.'),
      tabla(['Fecha', 'Estudiante', 'Fase', 'Pregunta', 'Selección', 'Resultado', 'Intento'], ult.map(function (r) {
        const p = D.P[r.preguntaId];
        return [U.fecha(r.fecha), (D.S[r.sesionId] || {}).nombre || '—', AL.MOMENTOS[r.momento], p ? p.enunciado : '(pregunta eliminada)',
          p ? textoSeleccion(p, r.seleccion) : '', p ? (correcta(r) ? '✔ Correcta' : '✘ Incorrecta') : '—', r.intento];
      }), 'Aún no hay respuestas.')));
  }

  /* ---------- configuración ---------- */
  async function demo() {
    const ps = D.preguntas.filter(function (p) { return p.publicada && D.C[p.cuentoId] && D.C[p.cuentoId].publicado; });
    if (!ps.length) return U.aviso('No hay preguntas publicadas.', 'error');
    const nombres = ['Demo Uno', 'Demo Dos', 'Demo Tres', 'Demo Cuatro', 'Demo Cinco', 'Demo Seis', 'Demo Siete', 'Demo Ocho'];
    for (const n of nombres) {
      const s = await S().crearSesion(n, { esPrueba: true, sinActivar: true, orientacion: true });
      for (const p of ps) {
        if (Math.random() < 0.1) continue; // algunas quedan sin responder
        const acierta = Math.random() < 0.6, k = D.claves[p.id];
        let seleccion;
        if (p.tipo === 'orden') seleccion = acierta ? k.orden.slice() : k.orden.slice().reverse();
        else { const otras = [0, 1, 2, 3].filter(function (i) { return i !== k.correcta; }); seleccion = acierta ? k.correcta : otras[Math.floor(Math.random() * 3)]; }
        await S().responder({ sesionId: s.id, preguntaId: p.id, seleccion: seleccion });
      }
    }
    await cargar(); U.aviso('Se generaron 8 estudiantes de demostración en las tres fases, marcados como prueba.'); AL.navegar();
  }
  function configuracion(cont) {
    const c = D.config;
    function radios(nombre, opciones, valor, alCambiar) {
      return h('div', { class: 'pila' }, opciones.map(function (o) {
        const id = nombre + '-' + o[0];
        return h('label', { class: 'casilla', for: id }, h('input', { type: 'radio', name: nombre, id: id, checked: valor === o[0], onchange: function () { alCambiar(o[0]); } }), o[1]);
      }));
    }
    async function guarda(parcial, texto) { await S().saveConfig(parcial); await cargar(); U.aviso(texto); }
    const activas = Object.assign({}, c.fasesActivas);
    cont.appendChild(h('section', { class: 'tarjeta' }, h('h2', {}, 'Fases activas'),
      h('p', { class: 'suave' }, 'Los estudiantes solo ven los cuentos y actividades de las fases marcadas aquí. Cada respuesta queda guardada con la fase de su cuento, así que los registros de las tres fases nunca se mezclan.'),
      h('div', { class: 'pila' }, Object.keys(AL.FASES).map(function (f) {
        const cs = D.cuentos.filter(function (x) { return (x.fase || 'intervencion') === f; });
        return h('label', { class: 'casilla', for: 'fase-' + f },
          h('input', { type: 'checkbox', id: 'fase-' + f, checked: !!activas[f], onchange: function (ev) {
            activas[f] = ev.target.checked;
            guarda({ fasesActivas: activas }, AL.FASES[f] + (ev.target.checked ? ': activada.' : ': desactivada.'));
          } }),
          h('span', {}, h('strong', {}, AL.FASES[f]), ' · ' + (cs.length ? cs.map(function (x) { return '«' + x.titulo + '»' + (x.publicado ? '' : ' (borrador)'); }).join(', ') : 'sin cuentos')));
      }))));
    cont.appendChild(h('section', { class: 'tarjeta' }, h('h2', {}, 'Tipo de registro'),
      h('p', { class: 'suave' }, 'Mientras prueba el sistema, deje «De prueba». Cambie a «Reales» solo para las aplicaciones con estudiantes.'),
      radios('modo-datos', [['prueba', 'De prueba: las sesiones nuevas se marcan como prueba'], ['real', 'Reales: las sesiones nuevas cuentan para el análisis']], c.modoDatos,
        function (v) { guarda({ modoDatos: v }, 'Las sesiones nuevas se registrarán como ' + (v === 'real' ? 'reales.' : 'prueba.')); })));
    const nPrueba = D.sesiones.filter(function (s) { return s.esPrueba; }).length;
    cont.appendChild(h('section', { class: 'tarjeta' }, h('h2', {}, 'Registros de prueba'),
      h('p', {}, 'Hay ' + nPrueba + ' sesiones de prueba y ' + (D.sesiones.length - nPrueba) + ' reales.'),
      h('div', { class: 'fila' },
        h('button', { class: 'boton claro', type: 'button', onclick: demo }, 'Generar registros de demostración'),
        h('button', { class: 'boton claro', type: 'button', onclick: async function () {
          if (!await U.confirmar('¿Eliminar los registros de prueba?', 'Se borrarán ' + nPrueba + ' sesiones de prueba y sus respuestas. Los registros reales no se tocan.', 'Eliminar')) return;
          await S().borrarPrueba(); await cargar(); U.aviso('Registros de prueba eliminados.'); AL.navegar();
        } }, 'Eliminar registros de prueba'),
        h('button', { class: 'boton claro', type: 'button', onclick: async function () {
          if (!await U.confirmar('¿Reiniciar todo?', AL.config.modo === 'firebase' ? 'Se borran de la base de datos TODAS las sesiones y respuestas, incluidas las reales, y el contenido vuelve al inicial. No se puede deshacer.' : 'Se borran todas las sesiones, las respuestas y los cambios en cuentos y preguntas de este dispositivo.', 'Reiniciar')) return;
          await S().reiniciarTodo(); await cargar(); U.aviso('Prototipo reiniciado.'); AL.navegar();
        } }, 'Reiniciar todo')),
      h('p', { class: 'suave' }, 'Los registros de demostración usan respuestas al azar con la misma probabilidad en las tres fases. Sirven para ver los gráficos, no representan estudiantes.')));
    cont.appendChild(h('section', { class: 'tarjeta' }, h('h2', {}, 'Estado del sistema'),
      tabla(['Elemento', 'Estado'], [
        ['Versión', AL.config.version],
        ['Almacenamiento de datos', AL.config.modo === 'local' ? 'Local (solo este navegador). Firebase aún no está conectado.' : 'Firebase'],
        ['Guardado en este navegador', D.info.persistente ? 'Funciona' : 'Bloqueado: los datos se perderán al cerrar la página'],
        ['Autenticación de administradores', AL.config.modo === 'local' ? 'Simulada (no segura)' : 'Firebase Authentication'],
        ['Biblioteca de gráficos', AL.graficos.disponible() ? 'Cargada' : 'No cargó'],
        ['Contenido', D.cuentos.length + ' cuentos · ' + D.preguntas.length + ' preguntas'],
        ['Registros', D.sesiones.length + ' sesiones · ' + D.respuestas.length + ' respuestas']
      ])));
  }

  /* ---------- entrada al panel ---------- */
  const PESTANAS = [['resultados', 'Resultados y análisis', resultados], ['cuentos', 'Cuentos', cuentos], ['preguntas', 'Preguntas', preguntas],
    ['registros', 'Registros', registros], ['configuracion', 'Configuración', configuracion]];

  /* Parte asíncrona: comprueba el acceso y carga los datos una vez. */
  async function preparar() {
    const admin = await S().adminActual();
    /* Los datos se leen una vez por visita al panel (cuida la cuota de lecturas de Firestore). */
    if (admin && !D) await cargar();
    return admin;
  }
  function pintar(cont, sub) {
    AL.graficos.limpiar();
    if (!AL.estado.admin) return acceso(cont);
    const actual = PESTANAS.find(function (p) { return p[0] === sub; }) || PESTANAS[0];
    cont.appendChild(h('header', { class: 'cabecera' }, h('h1', {}, 'Panel de administración'),
      h('p', { class: 'suave' }, 'Fases activas: ' + (Object.keys(AL.FASES).filter(function (f) { return (D.config.fasesActivas || {})[f]; }).map(function (f) { return AL.FASES[f]; }).join(', ') || 'ninguna') + ' · Sesiones nuevas: ' + (D.config.modoDatos === 'real' ? 'reales' : 'de prueba'))));
    cont.appendChild(h('p', {}, h('button', { class: 'boton claro chico', type: 'button', onclick: async function () { D = null; await AL.navegar(); U.aviso('Datos actualizados.'); } }, '↻ Actualizar datos')));
    cont.appendChild(h('nav', { class: 'pestanas', 'aria-label': 'Secciones del panel' }, PESTANAS.map(function (p) {
      return h('a', { href: '#admin.' + p[0], 'aria-current': p === actual ? 'page' : null }, p[1]);
    })));
    actual[2](cont);
  }

  AL.admin = { pintar: pintar, preparar: preparar, olvidar: function () { D = null; } };
})(window.AL = window.AL || {});
