/* Gráficos del panel (Chart.js). Los colores salen de las variables CSS para respetar el tema. */
(function (AL) {
  'use strict';
  let vivos = [];

  function tono(nombre) { return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim(); }
  function limpiar() { vivos.forEach(function (g) { g.destroy(); }); vivos = []; }
  function disponible() { return typeof window.Chart === 'function'; }

  function base(extra) {
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.anim === 'no';
    const tinta = tono('--tinta-suave'), linea = tono('--borde');
    const o = {
      responsive: true, maintainAspectRatio: false, animation: quieto ? false : { duration: 300 },
      plugins: {
        legend: { display: false, position: 'bottom', labels: { color: tono('--tinta'), usePointStyle: true, boxWidth: 10, font: { size: 13 } } },
        tooltip: { backgroundColor: tono('--tinta'), titleColor: tono('--fondo'), bodyColor: tono('--fondo'), padding: 10 }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tinta, font: { size: 13 } }, border: { color: linea } },
        y: { beginAtZero: true, grid: { color: linea }, ticks: { color: tinta, precision: 0 }, border: { display: false } }
      }
    };
    return extra ? extra(o) || o : o;
  }
  function crear(canvas, cfg) {
    if (!disponible()) {
      canvas.replaceWith(AL.ui.h('p', { class: 'suave' }, 'No se pudo cargar la biblioteca de gráficos. Los datos están en la tabla.'));
      return null;
    }
    const g = new window.Chart(canvas, cfg);
    vivos.push(g);
    return g;
  }

  /* Distribución de opciones A-D de una pregunta. La correcta se marca con color, borde y texto. */
  function opciones(canvas, textos, valores, correcta, alElegir) {
    const total = valores.reduce(function (a, b) { return a + b; }, 0);
    return crear(canvas, {
      type: 'bar',
      data: {
        labels: valores.map(function (_, k) { return AL.LETRAS[k] + (k === correcta ? ' ✔ correcta' : ''); }),
        datasets: [{
          label: 'Veces elegida', data: valores, borderRadius: 4, maxBarThickness: 46,
          backgroundColor: valores.map(function (_, k) { return k === correcta ? tono('--dato-bien') : tono('--dato-neutro'); }),
          borderColor: valores.map(function (_, k) { return k === correcta ? tono('--tinta') : 'transparent'; }),
          borderWidth: valores.map(function (_, k) { return k === correcta ? 2 : 0; })
        }]
      },
      options: base(function (o) {
        o.plugins.tooltip.callbacks = {
          title: function (it) { return AL.LETRAS[it[0].dataIndex] + '. ' + textos[it[0].dataIndex]; },
          label: function (it) { return it.parsed.y + ' de ' + total + ' (' + AL.ui.pct(it.parsed.y, total) + ' %)'; }
        };
        o.onClick = function (ev, el) { if (el.length && alElegir) alElegir(el[0].index); };
      })
    });
  }

  /* Barras apiladas: correctas, incorrectas y sin responder por subcategoría. */
  function apiladas(canvas, etiquetas, series) {
    return crear(canvas, {
      type: 'bar',
      data: {
        labels: etiquetas,
        datasets: series.map(function (s) {
          return { label: s.nombre, data: s.valores, backgroundColor: tono(s.color), borderColor: tono('--tarjeta'), borderWidth: 1, borderRadius: 4, maxBarThickness: 64 };
        })
      },
      options: base(function (o) { o.plugins.legend.display = true; o.scales.x.stacked = true; o.scales.y.stacked = true; })
    });
  }

  /* Barras agrupadas: porcentaje de respuestas correctas por subcategoría en cada momento. */
  function agrupadas(canvas, etiquetas, series) {
    return crear(canvas, {
      type: 'bar',
      data: {
        labels: etiquetas,
        datasets: series.map(function (s) {
          return { label: s.nombre, data: s.valores, backgroundColor: tono(s.color), borderRadius: 4, maxBarThickness: 40, detalle: s.detalle };
        })
      },
      options: base(function (o) {
        o.plugins.legend.display = true;
        o.scales.y.max = 100;
        o.scales.y.ticks.callback = function (v) { return v + ' %'; };
        o.plugins.tooltip.callbacks = {
          label: function (it) { return it.dataset.label + ': ' + (it.dataset.detalle[it.dataIndex] || 'sin datos'); }
        };
      })
    });
  }

  AL.graficos = { limpiar: limpiar, opciones: opciones, apiladas: apiladas, agrupadas: agrupadas, disponible: disponible };
})(window.AL = window.AL || {});
