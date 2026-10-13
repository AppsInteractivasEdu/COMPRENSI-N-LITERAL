/* Contenido inicial del RED: dos situaciones de lectura equivalentes.
 *   Situación 1: «La huerta de la escuela»      Situación 2: «La biblioteca del salón»
 * Ambas tienen cinco escenas, extensión similar y diez actividades con la misma distribución:
 * 3 de reconocimiento, 3 de recuperación y 4 de secuenciación (una de ellas de ordenamiento).
 * Se cargan una sola vez; después el administrador las edita desde el panel.
 * Las claves van en una colección aparte porque en Firestore tendrán reglas de lectura distintas.
 */
(function (AL) {
  'use strict';
  AL.semilla = function () {
    const cuentos = {}, preguntas = {}, claves = {};

    function cuento(id, orden, titulo, resumen, portada, escenas) {
      cuentos[id] = { id: id, titulo: titulo, orden: orden, publicado: true, resumen: resumen, portada: portada, escenas: escenas };
    }
    /* fila: [subcategoría, escena, enunciado, opciones, índice correcto, pista] */
    function actividades(C, filas, orden) {
      filas.forEach(function (f, i) {
        const n = i + 1, id = C + '_p' + n;
        preguntas[id] = {
          id: id, cuentoId: C, tipo: 'opcion', subcategoria: f[0], modulo: AL.SUBCATS[f[0]].modulo,
          orden: n, publicada: true, escenaRef: f[1], enunciado: f[2], opciones: f[3],
          retroOk: '¡Muy bien! Encontraste la información en la escena ' + f[1] + '.',
          retroMal: 'Todavía no. Vuelve a leer la escena ' + f[1] + '. ' + f[5]
        };
        if (f[6]) { preguntas[id].explicacion = f[6]; preguntas[id].evidencia = f[7]; }
        claves[id] = { correcta: f[4] };
      });
      if (!orden) return;
      const idO = C + '_p' + (filas.length + 1);
      preguntas[idO] = {
        id: idO, cuentoId: C, tipo: 'orden', subcategoria: 'secuenciacion', modulo: 5,
        orden: filas.length + 1, publicada: true, escenaRef: 1,
        enunciado: 'Ordena los hechos como ocurrieron en el cuento. El primero va arriba.',
        elementos: orden.mostrar.map(function (k) { return { id: 'e' + k, texto: orden.hechos[k - 1] }; }),
        retroOk: '¡Muy bien! Organizaste los hechos en el orden del cuento.',
        retroMal: 'Todavía no. Vuelve a leer el cuento desde la escena 1 y fíjate en qué pasa en cada escena.'
      };
      claves[idO] = { orden: orden.hechos.map(function (_, k) { return 'e' + (k + 1); }) };
    }

    /* ---------------- Situación 1 ---------------- */
    cuento('huerta', 1, 'La huerta de la escuela', 'La profesora Elena y sus estudiantes de cuarto grado crean una huerta.', 'portada', [
      { ilustracion: 'huerta1', alt: 'Una profesora en el salón de clases sostiene una bolsa.',
        texto: 'Una mañana de martes, la profesora Elena llegó al salón de cuarto grado con una bolsa llena de semillas. Les contó a sus estudiantes que la escuela tenía un pequeño terreno junto a la cancha y que podían utilizarlo para crear una huerta. La propuesta entusiasmó a varios niños, quienes se organizaron para preparar el lugar.' },
      { ilustracion: 'huerta2', alt: 'Niños trabajan en un terreno con hojas secas y palas pequeñas.',
        texto: 'Samuel y Laura se encargaron de recoger las hojas secas, mientras que Andrés y Camila llevaron pequeñas palas para remover la tierra. La profesora Elena entregó semillas de tomate, cilantro y habichuela. Después, explicó que cada grupo debía sembrar las semillas en una fila diferente y colocar un letrero con el nombre de cada planta.' },
      { ilustracion: 'huerta3', alt: 'Filas de tierra sembrada con letreros y una regadera.',
        texto: 'Al terminar la siembra, Laura llevó una regadera y humedeció la tierra. Samuel colocó los letreros junto a las filas, mientras Andrés y Camila recogieron las herramientas y las guardaron en el depósito de la escuela. Antes de regresar al salón, la profesora recordó que debían regar las plantas con frecuencia y observar su crecimiento.' },
      { ilustracion: 'huerta4', alt: 'Pequeños brotes verdes salen de la tierra y hay un cuaderno abierto.',
        texto: 'Durante las semanas siguientes, los estudiantes visitaron la huerta cada lunes y jueves. En una de esas visitas encontraron pequeños brotes verdes entre la tierra. La profesora les pidió que observaran las plantas y anotaran en sus cuadernos cuáles habían comenzado a crecer. Los niños registraron sus observaciones y continuaron cuidando la huerta.' },
      { ilustracion: 'huerta5', alt: 'La huerta con plantas de distintos tamaños bajo el sol.',
        texto: 'Al finalizar el mes, las plantas de cilantro y habichuela habían crecido. Los tomates todavía eran pequeños, pero tenían varias hojas verdes. La profesora felicitó al grupo por el trabajo realizado y les recordó que debían continuar cuidando las plantas para que pudieran desarrollarse.' }
    ]);
    actividades('huerta', [
      ['reconocimiento', 1, '¿Cómo se llamaba la profesora?', ['Laura', 'Elena', 'Camila', 'Marta'], 1, 'Fíjate en quién llegó al salón con una bolsa.'],
      ['reconocimiento', 1, '¿Dónde estaba el terreno que usaron para crear la huerta?', ['Detrás del salón de cuarto grado', 'Al lado del depósito de la escuela', 'Junto a la cancha', 'Frente a la entrada de la escuela'], 2, 'Busca la parte donde la profesora habla del pequeño terreno.'],
      ['reconocimiento', 2, '¿Qué semillas entregó la profesora?', ['Tomate, cilantro y habichuela', 'Tomate, cebolla y habichuela', 'Cilantro, lechuga y tomate', 'Habichuela, maíz y cilantro'], 0, 'Busca la oración que nombra las tres semillas.'],
      ['recuperacion', 2, '¿Qué estudiantes recogieron las hojas secas?', ['Andrés y Camila', 'Samuel y Andrés', 'Laura y Camila', 'Samuel y Laura'], 3, 'Lee con atención quiénes se encargaron de las hojas secas.'],
      ['recuperacion', 4, '¿Qué días visitaban los estudiantes la huerta?', ['Martes y jueves', 'Lunes y jueves', 'Lunes y viernes', 'Martes y viernes'], 1, 'Busca la oración que habla de las visitas a la huerta.'],
      ['recuperacion', 5, '¿Qué plantas habían crecido al finalizar el mes?', ['Tomate y cilantro', 'Habichuela y tomate', 'Cilantro y habichuela', 'Tomate, cilantro y habichuela'], 2, 'Lee la primera oración de esa escena.'],
      ['secuenciacion', 1, '¿Cuál de estos hechos ocurrió primero?', ['Laura humedeció la tierra con una regadera', 'Los estudiantes encontraron brotes verdes', 'La profesora Elena llegó al salón con una bolsa de semillas', 'Andrés y Camila guardaron las herramientas en el depósito'], 2, 'Piensa en cómo empieza el cuento.'],
      ['secuenciacion', 3, '¿Qué hizo Laura al terminar la siembra?', ['Colocó los letreros junto a las filas', 'Llevó una regadera y humedeció la tierra', 'Guardó las herramientas en el depósito', 'Recogió las hojas secas'], 1, 'Busca lo que pasó justo después de sembrar.'],
      ['secuenciacion', 5, '¿Qué ocurrió al finalizar el mes?', ['La profesora entregó las semillas', 'Los estudiantes removieron la tierra con palas', 'Samuel colocó los letreros', 'La profesora felicitó al grupo por el trabajo realizado'], 3, 'Piensa en cómo termina el cuento.']
    ], { mostrar: [4, 2, 5, 1, 3], hechos: [
      'La profesora Elena llegó al salón con una bolsa de semillas.',
      'Samuel y Laura recogieron las hojas secas.',
      'Laura humedeció la tierra con una regadera.',
      'Los estudiantes encontraron pequeños brotes verdes.',
      'La profesora felicitó al grupo por el trabajo realizado.'] });

    /* ---------------- Situación 2 ---------------- */
    cuento('biblioteca', 3, 'La biblioteca del salón', 'El profesor Julián y sus estudiantes de cuarto grado crean una biblioteca en el salón.', 'portada2', [
      { ilustracion: 'biblio1', alt: 'Un profesor en el salón de clases sostiene una caja.',
        texto: 'Un lunes por la tarde, el profesor Julián llegó al salón de cuarto grado con una caja llena de libros. Les contó a sus estudiantes que el salón tenía un rincón vacío al lado de la ventana y que podían utilizarlo para crear una pequeña biblioteca. La idea alegró a varios niños, quienes se organizaron para preparar el lugar.' },
      { ilustracion: 'biblio2', alt: 'Niños junto a un estante vacío y varios cojines.',
        texto: 'Valentina y Mateo se encargaron de limpiar el estante, mientras que Sofía y Daniel trajeron cojines para sentarse a leer. El profesor Julián entregó libros de cuentos, de animales y de adivinanzas. Después, explicó que cada grupo debía ubicar los libros en una tabla diferente del estante y pegar una etiqueta con el nombre de cada tipo de libro.' },
      { ilustracion: 'biblio3', alt: 'Un estante con libros y etiquetas, una alfombra y cajas vacías.',
        texto: 'Al terminar de ordenar los libros, Valentina trajo una alfombra y la extendió en el piso. Mateo pegó las etiquetas en el estante, mientras Sofía y Daniel recogieron las cajas vacías y las llevaron a la portería de la escuela. Antes de salir del salón, el profesor recordó que debían devolver cada libro a su lugar y cuidar sus hojas.' },
      { ilustracion: 'biblio4', alt: 'Un estante con libros, un libro abierto y una ficha de papel.',
        texto: 'Durante las semanas siguientes, los estudiantes visitaron la biblioteca cada martes y viernes. En una de esas visitas encontraron un libro nuevo sobre el mar en el estante. El profesor les pidió que leyeran un libro y anotaran en una ficha el título que habían escogido. Los niños llenaron sus fichas y continuaron visitando la biblioteca.' },
      { ilustracion: 'biblio5', alt: 'Niños leen sentados sobre una alfombra junto al estante.',
        texto: 'Al finalizar el mes, los libros de cuentos y de adivinanzas habían sido los más leídos. Los libros de animales todavía tenían pocas fichas, pero varios niños querían leerlos. El profesor felicitó al grupo por el trabajo realizado y les recordó que debían seguir cuidando los libros para que duraran mucho tiempo.' }
    ]);
    actividades('biblioteca', [
      ['reconocimiento', 1, '¿Cómo se llamaba el profesor?', ['Mateo', 'Daniel', 'Julián', 'Andrés'], 2, 'Fíjate en quién llegó al salón con una caja.'],
      ['reconocimiento', 1, '¿Dónde estaba el rincón que usaron para crear la biblioteca?', ['Al lado de la ventana', 'Junto a la puerta del salón', 'Detrás del escritorio del profesor', 'Cerca de la portería de la escuela'], 0, 'Busca la parte donde el profesor habla del rincón vacío.'],
      ['reconocimiento', 2, '¿Qué libros entregó el profesor?', ['De cuentos, de animales y de poemas', 'De cuentos, de animales y de adivinanzas', 'De animales, de adivinanzas y de mapas', 'De cuentos, de adivinanzas y de canciones'], 1, 'Busca la oración que nombra los tres tipos de libros.'],
      ['recuperacion', 2, '¿Qué estudiantes limpiaron el estante?', ['Sofía y Daniel', 'Valentina y Sofía', 'Valentina y Mateo', 'Mateo y Daniel'], 2, 'Lee con atención quiénes se encargaron del estante.'],
      ['recuperacion', 4, '¿Qué días visitaban los estudiantes la biblioteca?', ['Lunes y viernes', 'Martes y jueves', 'Lunes y jueves', 'Martes y viernes'], 3, 'Busca la oración que habla de las visitas a la biblioteca.'],
      ['recuperacion', 5, '¿Qué libros habían sido los más leídos al finalizar el mes?', ['Los de cuentos y de adivinanzas', 'Los de cuentos y de animales', 'Los de animales y de adivinanzas', 'Los de cuentos, de animales y de adivinanzas'], 0, 'Lee la primera oración de esa escena.'],
      ['secuenciacion', 1, '¿Cuál de estos hechos ocurrió primero?', ['Valentina extendió una alfombra en el piso', 'El profesor Julián llegó al salón con una caja de libros', 'Los estudiantes encontraron un libro nuevo sobre el mar', 'Sofía y Daniel llevaron las cajas vacías a la portería'], 1, 'Piensa en cómo empieza el cuento.'],
      ['secuenciacion', 3, '¿Qué hizo Valentina al terminar de ordenar los libros?', ['Pegó las etiquetas en el estante', 'Llevó las cajas vacías a la portería', 'Limpió el estante', 'Trajo una alfombra y la extendió en el piso'], 3, 'Busca lo que pasó justo después de ordenar los libros.'],
      ['secuenciacion', 5, '¿Qué ocurrió al finalizar el mes?', ['El profesor felicitó al grupo por el trabajo realizado', 'El profesor entregó los libros', 'Sofía y Daniel trajeron cojines', 'Mateo pegó las etiquetas en el estante'], 0, 'Piensa en cómo termina el cuento.']
    ], { mostrar: [3, 5, 1, 4, 2], hechos: [
      'El profesor Julián llegó al salón con una caja de libros.',
      'Valentina y Mateo limpiaron el estante.',
      'Valentina extendió una alfombra en el piso.',
      'Los estudiantes encontraron un libro nuevo sobre el mar.',
      'El profesor felicitó al grupo por el trabajo realizado.'] });

    cuentos.huerta.fase = 'inicial';
    cuentos.biblioteca.fase = 'cierre';

    /* ---------------- Intervención: Misión lectora 1 ----------------
     * Cuento y preguntas entregados por el equipo investigador; se usan sin cambios.
     * Las claves, las explicaciones y los fragmentos de evidencia se derivaron del texto
     * y deben ser revisados por el equipo. */
    cuento('semillas', 2, 'El misterio de las semillas desaparecidas', 'Samuel y Valentina descubren que falta un sobre de semillas y lo buscan con la profesora Elena.', 'mision2', [
      { ilustracion: 'huerta1', alt: 'Una profesora en el salón de clases sostiene una bolsa.',
        texto: 'En la Institución Educativa Los Girasoles, los estudiantes de cuarto grado estaban preparando una huerta escolar. La profesora Elena les había entregado tres sobres de semillas: uno de tomate, otro de cilantro y uno de fríjol. Cada sobre tenía una etiqueta con el nombre de la planta y la fecha de siembra.' },
      { ilustracion: 'mision2', alt: 'Dos niños miran una caja de madera abierta.',
        texto: 'El lunes por la mañana, Samuel y Valentina llegaron temprano para organizar los materiales. Samuel llevó una regadera azul y Valentina llevó una pequeña pala. Al abrir la caja donde guardaban las semillas, descubrieron que el sobre de fríjol no estaba. Los otros dos sobres permanecían en su lugar.' },
      { ilustracion: 'mision3', alt: 'Una profesora conversa con dos niños en el salón.',
        texto: 'Los niños avisaron a la profesora Elena. Ella les pidió recordar qué habían hecho el viernes, cuando organizaron la huerta por última vez. Samuel recordó que había colocado los tres sobres dentro de una caja de madera. Valentina recordó que, después de guardar los materiales, el grupo había trasladado la caja desde el salón hasta la caseta de herramientas porque iban a limpiar el aula.' },
      { ilustracion: 'mision4', alt: 'Una mesa con una caja de madera, macetas y una bolsa de tierra.',
        texto: 'La profesora acompañó a los niños hasta la caseta. Allí encontraron la caja de madera sobre una mesa, junto a unas macetas y una bolsa de tierra. Samuel revisó debajo de la mesa, mientras Valentina miró dentro de las macetas vacías. Finalmente, la profesora abrió un cajón de la mesa y encontró el sobre de fríjol.' },
      { ilustracion: 'mision5', alt: 'La profesora y los niños celebran junto a la mesa.',
        texto: 'Samuel recordó entonces que el viernes había sacado ese sobre para leer la fecha de siembra y lo había guardado en el cajón sin darse cuenta. Todos se alegraron al encontrarlo. Antes de comenzar, la profesora propuso una nueva regla: cada material tendría un lugar señalado y, al terminar las actividades, un estudiante comprobaría que todo quedara organizado.' },
      { ilustracion: 'mision6', alt: 'Tres hileras de tierra sembrada y un cartel.',
        texto: 'Ese día, los niños sembraron las semillas de tomate, cilantro y fríjol en tres hileras diferentes. Samuel utilizó la regadera azul y Valentina hizo pequeños hoyos con la pala. Al finalizar, colocaron un cartel que decía: «Nuestra huerta crece cuando todos cuidamos de ella».' }
    ]);
    cuentos.semillas.fase = 'intervencion';
    cuentos.semillas.mision = {
      etiqueta: 'Misión lectora 1',
      proposito: 'Vas a leer un cuento de misterio y a encontrar en él la información exacta: quiénes aparecen, qué datos dice el texto y en qué orden pasan las cosas.',
      instrucciones: ['Lee el cuento con calma, escena por escena.', 'Responde las 9 preguntas. Cada una tiene una sola respuesta correcta.',
        'Si no aciertas, busca la pista en el cuento e inténtalo otra vez.', 'Cada respuesta correcta hace brotar una semilla.']
    };
    actividades('semillas', [
      ['reconocimiento', 1, '¿Cómo se llamaba la profesora de los estudiantes?', ['Profesora Elena', 'Profesora Valentina', 'Profesora de ciencias', 'Profesora de la huerta'], 0,
        'Fíjate en quién entregó los sobres de semillas.',
        'El cuento dice que la profesora Elena entregó los sobres de semillas. Ese es el nombre que aparece escrito. Valentina es una estudiante.',
        'La profesora Elena les había entregado tres sobres de semillas'],
      ['reconocimiento', 2, '¿Qué objeto llevó Samuel para cuidar las plantas?', ['Una pala pequeña', 'Una regadera azul', 'Una caja de madera', 'Una bolsa de tierra'], 1,
        'Busca qué llevó cada niño el lunes por la mañana.',
        'El cuento dice que Samuel llevó una regadera azul. La pala pequeña la llevó Valentina.',
        'Samuel llevó una regadera azul'],
      ['reconocimiento', 1, '¿Qué semillas contenían los tres sobres entregados por la profesora?', ['Tomate, maíz y fríjol', 'Cilantro, lechuga y tomate', 'Tomate, cilantro y fríjol', 'Fríjol, zanahoria y cilantro'], 2,
        'Busca la oración que nombra los tres sobres.',
        'El cuento nombra los tres sobres: uno de tomate, otro de cilantro y uno de fríjol. El maíz, la lechuga y la zanahoria no aparecen en la historia.',
        'uno de tomate, otro de cilantro y uno de fríjol'],
      ['recuperacion', 2, '¿Qué sobre descubrieron que faltaba el lunes por la mañana?', ['El sobre de tomate', 'El sobre de cilantro', 'El sobre de las flores', 'El sobre de fríjol'], 3,
        'Lee lo que pasó cuando abrieron la caja.',
        'Al abrir la caja, los niños descubrieron que el sobre de fríjol no estaba. Los otros dos sobres seguían en su lugar.',
        'descubrieron que el sobre de fríjol no estaba'],
      ['recuperacion', 4, '¿Dónde encontraron finalmente el sobre de fríjol?', ['Debajo de una maceta', 'Dentro de un cajón de la mesa', 'En el salón de clases', 'Dentro de la regadera'], 1,
        'Busca qué hizo la profesora al final de la búsqueda en la caseta.',
        'El cuento dice que la profesora abrió un cajón de la mesa y allí encontró el sobre de fríjol.',
        'la profesora abrió un cajón de la mesa y encontró el sobre de fríjol'],
      ['recuperacion', 5, '¿Qué recordó Samuel que había hecho con el sobre el viernes?', ['Lo había llevado a su casa', 'Lo había dejado junto a la puerta', 'Lo había guardado en un cajón después de leer la fecha', 'Lo había entregado a Valentina'], 2,
        'Lee lo que Samuel recordó después de encontrar el sobre.',
        'Samuel recordó que el viernes sacó el sobre para leer la fecha de siembra y lo guardó en el cajón sin darse cuenta.',
        'el viernes había sacado ese sobre para leer la fecha de siembra y lo había guardado en el cajón sin darse cuenta'],
      ['secuenciacion', 3, '¿Qué hicieron Samuel y Valentina después de descubrir que faltaba un sobre?', ['Avisaron a la profesora Elena', 'Sembraron inmediatamente las semillas', 'Colocaron el cartel de la huerta', 'Regresaron a sus casas'], 0,
        'Fíjate en lo primero que cuenta esa escena.',
        'Después de descubrir que faltaba el sobre, lo siguiente que cuenta la historia es que los niños avisaron a la profesora Elena. La siembra y el cartel ocurrieron mucho después.',
        'Los niños avisaron a la profesora Elena.'],
      ['secuenciacion', 4, '¿Qué ocurrió después de que la profesora les pidió recordar lo sucedido el viernes?', ['Los niños sembraron las semillas', 'La profesora acompañó a los niños hasta la caseta', 'Samuel llevó una regadera azul', 'El grupo escribió el cartel'], 1,
        'Fíjate en cómo empieza esa escena.',
        'Cuando los niños recordaron lo que hicieron el viernes, la profesora los acompañó hasta la caseta. Eso es lo que sigue en la historia. La siembra y el cartel pasaron al final.',
        'La profesora acompañó a los niños hasta la caseta.'],
      ['secuenciacion', 6, '¿Qué hicieron al finalizar la búsqueda y encontrar el sobre?', ['Guardaron la caja sin sembrar', 'Dejaron los materiales en el suelo', 'Regresaron al salón para limpiar', 'Sembraron las tres clases de semillas y colocaron un cartel'], 3,
        'Lee cómo termina el cuento.',
        'Al final del cuento, los niños sembraron las semillas de tomate, cilantro y fríjol y colocaron un cartel en la huerta.',
        'los niños sembraron las semillas de tomate, cilantro y fríjol en tres hileras diferentes']
    ]);

    return { cuentos: cuentos, preguntas: preguntas, claves: claves };
  };
})(window.AL = window.AL || {});
