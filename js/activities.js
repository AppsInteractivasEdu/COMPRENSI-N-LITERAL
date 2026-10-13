/* Actividades interactivas: selección múltiple (A-D) y ordenamiento de acontecimientos.
 *
 * Tres modos, según la fase del cuento:
 *   evaluacion -> diagnóstico inicial y cierre: una sola respuesta, sin retroalimentación.
 *   practica   -> intervención general: retroalimentación y reintentos.
 *   mision     -> misión lectora: tarjetas que reaccionan, pista resaltada en el cuento,
 *                 explicación de la respuesta y semillas que brotan con cada acierto.
 * En todos los casos la respuesta sigue siendo de selección múltiple con única respuesta.
 */
(function (AL) {
  'use strict';
  const U = AL.ui, h = U.h;

  function cuentoDe(p) { return AL.estado.cuentos.find(function (c) { return c.id === p.cuentoId; }); }
  function modoDe(p) {
    const c = cuentoDe(p) || {};
    if ((c.fase || 'intervencion') !== 'intervencion') return 'evaluacion';
    return c.mision ? 'mision' : 'practica';
  }

  /* Texto de una escena con el fragmento de evidencia resaltado. */
  function conEvidencia(texto, evidencia) {
    const i = evidencia ? texto.indexOf(evidencia) : -1;
    if (i < 0) return h('p', { class: 'lectura' }, texto);
    return h('p', { class: 'lectura' }, texto.slice(0, i), h('mark', {}, evidencia), texto.slice(i + evidencia.length));
  }

  /* Ventana para volver a leer el cuento sin salir de la actividad.
   * Con una pregunta, muestra solo su escena y resalta dónde está la información. */
  function releer(cuento, pregunta) {
    if (!cuento) return;
    let cuerpo;
    if (pregunta) {
      const e = cuento.escenas[(pregunta.escenaRef || 1) - 1] || cuento.escenas[0];
      cuerpo = h('div', { class: 'relectura' }, h('h3', {}, 'Escena ' + (cuento.escenas.indexOf(e) + 1)), conEvidencia(e.texto, pregunta.evidencia));
    } else {
      cuerpo = h('div', { class: 'relectura' }, cuento.escenas.map(function (e, i) {
        return h('section', {}, h('h3', {}, 'Escena ' + (i + 1)), h('p', { class: 'lectura' }, e.texto));
      }));
    }
    U.ventana(cuento.titulo, cuerpo);
  }

  /* Semillas de la misión: una por pregunta, agrupadas en los tres sobres (subcategorías). */
  function semillas(preguntasMision) {
    const estado = {};
    AL.estado.respuestas.forEach(function (r) { estado[r.preguntaId] = estado[r.preguntaId] === 'bien' || r.correcta ? 'bien' : 'intento'; });
    return h('div', { class: 'sobres' }, Object.keys(AL.SUBCATS).map(function (s) {
      const ps = preguntasMision.filter(function (p) { return p.subcategoria === s; });
      const n = ps.filter(function (p) { return estado[p.id] === 'bien'; }).length;
      return h('div', { class: 'sobre', role: 'img', 'aria-label': AL.SUBCATS[s].corto + ': ' + n + ' de ' + ps.length + ' semillas' },
        h('span', { class: 'sobre-nombre' }, AL.SUBCATS[s].corto),
        h('span', { class: 'sobre-semillas', 'aria-hidden': 'true' }, ps.map(function (p) {
          return h('span', { class: 'semilla ' + (estado[p.id] || '') }, estado[p.id] === 'bien' ? '🌱' : '');
        })));
    }));
  }

  function ejecutar(cont, preguntas, opts) {
    opts = opts || {};
    let i = 0;
    const ultimos = [];

    function pintar() {
      U.limpiar(cont);
      if (i >= preguntas.length) return fin();
      const p = preguntas[i], modo = modoDe(p), cuento = cuentoDe(p);
      let seleccion = p.tipo === 'orden' ? p.elementos.map(function (e) { return e.id; }) : null;
      let bloqueada = false, marcas = {};

      const zona = h('div', {});
      const retro = h('div', { class: 'retro', role: 'status', hidden: true });
      const responder = h('button', { class: 'boton grande', type: 'button', disabled: p.tipo !== 'orden', onclick: enviar },
        modo === 'evaluacion' ? 'Guardar mi respuesta' : 'Responder');
      const botonLeer = function () { return h('button', { class: 'boton claro', type: 'button', onclick: function () { releer(cuento); } }, '📖 Volver a leer el cuento'); };
      const acciones = h('div', { class: 'fila' }, responder, botonLeer());

      function pintarOpciones() {
        U.limpiar(zona);
        if (p.tipo === 'orden') {
          const porId = {};
          p.elementos.forEach(function (e) { porId[e.id] = e; });
          zona.appendChild(h('ol', { class: 'orden' }, seleccion.map(function (idEl, k) {
            function mover(d) {
              const j = k + d;
              seleccion.splice(j, 0, seleccion.splice(k, 1)[0]);
              pintarOpciones();
              const b = zona.querySelectorAll('li')[j];
              if (b) b.querySelector(d < 0 ? '.subir' : '.bajar').focus();
            }
            return h('li', {},
              h('span', { class: 'puesto' }, k + 1),
              h('span', { class: 'texto' }, porId[idEl].texto),
              h('span', { class: 'flechas' },
                h('button', { class: 'flecha subir', type: 'button', disabled: bloqueada || k === 0, 'aria-label': 'Subir: ' + porId[idEl].texto, onclick: function () { mover(-1); } }, '▲'),
                h('button', { class: 'flecha bajar', type: 'button', disabled: bloqueada || k === seleccion.length - 1, 'aria-label': 'Bajar: ' + porId[idEl].texto, onclick: function () { mover(1); } }, '▼')));
          })));
        } else {
          zona.appendChild(h('div', { class: 'opciones' + (modo === 'mision' ? ' vivas' : ''), role: 'radiogroup', 'aria-label': 'Opciones de respuesta' },
            p.opciones.map(function (texto, k) {
              const m = marcas[k];
              return h('button', { class: 'opcion' + (seleccion === k ? ' elegida' : '') + (m ? ' ' + m : ''), type: 'button', role: 'radio',
                'aria-checked': seleccion === k ? 'true' : 'false', disabled: bloqueada,
                onclick: function () { seleccion = k; responder.disabled = false; pintarOpciones(); zona.querySelectorAll('.opcion')[k].focus(); } },
                h('span', { class: 'letra' }, AL.LETRAS[k]), h('span', {}, texto),
                m ? h('span', { class: 'sello' }, m === 'acierto' ? '✔ Correcta' : '✘ No es esta') : null);
            })));
        }
      }

      function siguiente() {
        return h('button', { class: 'boton grande', type: 'button', onclick: function () { i++; pintar(); } },
          i === preguntas.length - 1 ? 'Terminar' : 'Siguiente pregunta');
      }
      function mostrarRetro(clase, titulo, texto, extra) {
        U.limpiar(retro); retro.hidden = false; retro.className = 'retro ' + clase;
        retro.appendChild(h('p', {}, h('strong', {}, titulo + ' '), texto));
        if (extra) retro.appendChild(extra);
      }
      function cita() {
        if (!p.evidencia) return null;
        return h('p', { class: 'cita' }, h('span', { class: 'eti' }, 'El cuento dice (escena ' + p.escenaRef + '): '), '«' + p.evidencia + '»');
      }

      async function enviar() {
        if (bloqueada || seleccion === null) return;
        bloqueada = true; responder.disabled = true;
        let r;
        try {
          r = await AL.store.responder({ sesionId: AL.estado.sesion.id, preguntaId: p.id, seleccion: seleccion });
        } catch (e) {
          bloqueada = false; responder.disabled = false;
          U.aviso('No se pudo guardar tu respuesta. Inténtalo otra vez.', 'error');
          return;
        }
        if (!r.repetida) AL.estado.respuestas.push(r);
        ultimos[i] = r.correcta;
        U.limpiar(acciones);
        let foco;

        if (modo === 'evaluacion') {
          pintarOpciones();
          mostrarRetro('neutra', '✔ Respuesta guardada.', 'Continúa con la siguiente.');
          foco = siguiente(); acciones.appendChild(foco);
        } else if (modo === 'practica') {
          pintarOpciones();
          mostrarRetro(r.correcta ? 'bien' : 'repasar', r.correcta ? '✔ Respuesta correcta.' : '↻ Para repasar.', r.correcta ? p.retroOk : p.retroMal);
          if (!r.correcta) {
            acciones.appendChild(botonLeer());
            acciones.appendChild(h('button', { class: 'boton claro', type: 'button', onclick: pintar }, 'Intentar otra vez'));
          }
          foco = siguiente(); acciones.appendChild(foco);
        } else {
          /* Misión: la tarjeta elegida reacciona y la retroalimentación lleva al texto. */
          if (p.tipo !== 'orden') marcas[seleccion] = r.correcta ? 'acierto' : 'fallo';
          pintarOpciones();
          if (opts.alResponder) opts.alResponder();
          if (r.correcta) {
            mostrarRetro('bien', '🌱 ¡Correcto! Brotó una semilla.', p.explicacion || p.retroOk, cita());
            foco = siguiente(); acciones.appendChild(foco);
          } else {
            mostrarRetro('repasar', '↻ Sigue buscando.', p.retroMal);
            acciones.appendChild(h('button', { class: 'boton claro', type: 'button', onclick: function () { releer(cuento, { escenaRef: p.escenaRef }); } }, '🔎 Buscar la pista en la escena ' + p.escenaRef));
            foco = h('button', { class: 'boton grande', type: 'button', onclick: pintar }, 'Intentar otra vez');
            acciones.appendChild(foco);
            acciones.appendChild(h('button', { class: 'boton claro', type: 'button', onclick: explicar }, 'Ver la explicación y seguir'));
          }
        }
        if (foco) foco.focus();
      }

      /* Revela la respuesta correcta con su explicación (solo después de haber respondido). */
      async function explicar() {
        let clave = null;
        try { clave = await AL.store.claveTrasResponder(AL.estado.sesion.id, p.id); } catch (e) { /* sin clave: se muestra solo la explicación */ }
        if (clave && p.tipo !== 'orden') marcas[clave.correcta] = 'acierto';
        pintarOpciones();
        mostrarRetro('bien', 'La respuesta correcta' + (clave && p.tipo !== 'orden' ? ' es la ' + AL.LETRAS[clave.correcta] + '.' : ':'), p.explicacion || '', cita());
        U.limpiar(acciones);
        acciones.appendChild(h('button', { class: 'boton claro', type: 'button', onclick: function () { releer(cuento, p); } }, '🔎 Verlo resaltado en el cuento'));
        const s = siguiente(); acciones.appendChild(s); s.focus();
      }

      const avance = h('div', { class: 'avance', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': preguntas.length, 'aria-valuenow': i,
        'aria-label': 'Avance de la actividad' }, h('span', { style: 'width:' + U.pct(i, preguntas.length) + '%' }));
      const cabeza = h('div', {});
      if (opts.cabecera) { const pinta = function () { U.limpiar(cabeza).appendChild(opts.cabecera()); }; pinta(); opts.alResponder = pinta; }
      cont.appendChild(h('article', { class: 'tarjeta actividad' },
        h('p', { class: 'eti' }, 'Pregunta ' + (i + 1) + ' de ' + preguntas.length + ' · ' + AL.SUBCATS[p.subcategoria].corto + (cuento ? ' · ' + cuento.titulo : '')),
        opts.cabecera ? cabeza : avance,
        h('h2', { class: 'enunciado' }, p.enunciado),
        zona, retro, acciones));
      pintarOpciones();
    }

    function fin() {
      if (opts.alFinal) return opts.alFinal(cont);
      const evalua = preguntas.length && modoDe(preguntas[0]) === 'evaluacion';
      if (evalua) {
        cont.appendChild(h('article', { class: 'tarjeta centro' },
          h('p', { class: 'insignia-grande', 'aria-hidden': 'true' }, opts.icono || '🏅'),
          h('h2', {}, '¡Terminaste esta parte!'),
          h('p', {}, 'Tus respuestas quedaron guardadas. Gracias por leer con atención.'),
          h('div', { class: 'fila centro' }, h('a', { class: 'boton grande', href: '#mapa' }, 'Volver al mapa'))));
        return;
      }
      const falladas = ultimos.filter(function (c) { return !c; }).length;
      cont.appendChild(h('article', { class: 'tarjeta centro' },
        h('p', { class: 'insignia-grande', 'aria-hidden': 'true' }, opts.icono || '🏅'),
        h('h2', {}, '¡Terminaste esta actividad!'),
        h('ul', { class: 'resumen' }, preguntas.map(function (p, k) {
          return h('li', {}, h('span', { class: 'marca ' + (ultimos[k] ? 'bien' : 'repasar') }, ultimos[k] ? '✔ Correcta' : '↻ Para repasar'),
            h('span', {}, p.enunciado));
        })),
        h('p', { class: 'suave' }, 'Las insignias celebran tu esfuerzo. Lo más importante es encontrar la información en el cuento.'),
        h('div', { class: 'fila centro' },
          falladas ? h('a', { class: 'boton claro', href: '#retos' }, 'Ir a los retos de lectura') : null,
          h('a', { class: 'boton grande', href: '#mapa' }, 'Volver al mapa'))));
    }

    pintar();
  }

  AL.actividades = { ejecutar: ejecutar, releer: releer, semillas: semillas, modoDe: modoDe };
})(window.AL = window.AL || {});
