/* Spanish versions of app-owned generation instructions. Schema keys,
   parser markers, math syntax and interpolated user content stay unchanged. */
const TREE_ES_FIELDS = `- id: un identificador breve, estable, en minúsculas y snake_case. Solo se usa para conectar los "requires"; nunca se muestra al estudiante. Elige algo que puedas reconocer si necesitas referenciarlo después.
- label: el nombre legible de la tarjeta del nodo y el tema que recibirá el generador de su lección. Nombra un concepto, ley, definición o técnica concretos, no un título de capítulo ni un tema vago.
- explanation: una guía docente privada que recibe el generador junto con el nombre. Indica qué debería poder hacer el estudiante, la idea central y los contenidos necesarios para esa capacidad, y el límite con los nodos vecinos. Incluye una pregunta motivadora útil o una confusión previsible cuando afecte a cómo enseñar el nodo. Identifica los conocimientos previos que no aporten los requisitos indicados; deben coincidir con la calibración. Escribe frases compactas y conectadas, no un catálogo de todos los casos relacionados. Excluir métodos o formalismos posteriores debe dejar espacio para mostrar la utilidad de la idea. Incluye siempre este campo.
- requires: los identificadores de todos los nodos que deben completarse para desbloquear este. Omite la clave en un nodo raíz. Todos los requisitos se combinan con AND: deben estar completados todos, no solo uno.
- optional: true marca un nodo como ampliación: interesante, pero no esencial para el resto del árbol. Es solo una etiqueta; no flexibiliza los bloqueos. Un nodo que requiera uno opcional sigue necesitando que esté completado. Omite este campo salvo que realmente lo quieras.
- done: no lo establezcas. Solo existe para reimportar un árbol que ya contiene progreso.`;
const TREE_ES_DESIGN = `EL OBJETIVO DE APRENDIZAJE DE CADA NODO

¿Qué podrá interpretar, explicar, distinguir o hacer el estudiante después de este nodo que no podía hacer tras sus requisitos? Nombra una capacidad observable y elige el contenido necesario para desarrollarla. Una lista de temas no es un objetivo de aprendizaje. Fusiona un candidato que solo repita una capacidad anterior; precisa o divide uno cuyo objetivo esconda varios retos de aprendizaje independientes.

GRANULARIDAD Y CARGA DE APRENDIZAJE

Un nodo desarrolla un concepto, resultado o método coherente al nivel actual del estudiante. Necesita suficiente explicación y práctica para que la idea sea utilizable, pero no un número fijo de secciones o preguntas. Es preferible una lección breve y completa a ampliar su alcance para llenar un documento.

Agrupa consecuencias o representaciones que ayuden a entender y usar la misma idea sin introducir una dificultad independiente. Divide cuando otro concepto, método o cuerpo de conocimiento desconocido necesite su propia explicación y práctica. Esto se aplica tanto a distinciones conceptuales como a nuevos teoremas o derivaciones. Varias excepciones relacionadas pueden sobrecargar un nodo introductorio: pertenecer a la misma familia no hace que deban enseñarse juntas.

COMPRUEBA LA LECCIÓN ANTES DE FIJAR SU ALCANCE

Esboza cómo encontraría la idea alguien que la estudia por primera vez: una pregunta con sentido, un caso concreto accesible, el significado o método general y una oportunidad de usarlo. Son comprobaciones para planificar, no títulos de sección obligatorios. Distingue la idea central de las ilustraciones y del material que corresponde a etapas posteriores. No conviertas cada elemento de la guía en una sección con el mismo peso.

Si un candidato es demasiado pequeño, comprueba primero si pertenece a un objetivo vecino. Si es demasiado amplio, separa sus dificultades de aprendizaje en vez de comprimir las explicaciones. Nunca añadas reglas similares, casos límite o justificaciones avanzadas solo para alcanzar una longitud. Registra el objetivo y los límites resultantes en explanation.

Elige ejemplos cuyos conocimientos necesarios estén aportados por la calibración o los nodos anteriores. Un objetivo introductorio no debe depender de forma oculta de un ejemplo sofisticado de otra rama. Límites como «sin definición formal» o «sin técnicas de cálculo» restringen el tratamiento, pero no eliminan la necesidad de motivación, interpretación concreta o práctica útil.

PUEDE HABER VARIAS RAÍCES

Un árbol no necesita un único nodo inicial. Si la materia tiene varias bases independientes que solo se unen después, crea varias raíces y deja que converjan donde realmente lo hagan en la materia, no antes para tener un único inicio. Dos raíces que no se relacionan durante un tramo largo y se unen cuando algo realmente necesita ambas son una forma normal. No inventes una dependencia para que el grafo parezca un solo árbol.

LA CONVERGENCIA DEBE REPRESENTAR UNA SÍNTESIS REAL

Un nodo debe tener varios requisitos porque su concepto combina precisamente esas piezas, no para que el grafo parezca conectado o para dar una salida a cada rama. Prueba a retirar cada requisito: ¿el nodo aún tendría algo que enseñar? Si sí, probablemente ese requisito no pertenece ahí. Si no puedes explicar en una frase por qué necesita exactamente esos requisitos juntos y no un subconjunto, la convergencia aún no es real.

UN NODO PUEDE APOYARSE EN OTRAS RAMAS, NO SOLO EN LO INMEDIATAMENTE ANTERIOR

Los requisitos no tienen que ser de la capa más reciente ni de la misma rama. Si un nodo necesita algo temprano de otra rama junto a algo mucho más reciente, incluye ambos. Es normal que un nodo avanzado dependa de algo establecido mucho antes y de algo recién aprendido. No lo limites artificialmente a su predecesor inmediato: debe depender de lo que realmente necesite, esté donde esté.

NO FUERCES UNA PLANTILLA UNIFORME EN RAMAS PARALELAS

Que varias ramas pasen por una etapa parecida no significa que deban continuar mecánicamente del mismo modo. Una puede ir a la siguiente etapa evidente, otra necesitar resolver una inconsistencia y otra estar terminada. Sigue lo que la materia haga realmente en cada punto, no un patrón que empezaste a aplicar porque funcionó en otra parte.

NOMBRES

Usa un nombre reconocible para el concepto, resultado o método que realmente se enseña. Añade un calificativo breve si distingue una interpretación introductoria de un tratamiento formal posterior, o una forma de otra. El nombre y explanation deben concordar: no mantengas un nombre limitado mientras escondes un capítulo mucho más amplio en su guía. Evita títulos vagos que no den un tema claro al generador de lecciones.

NO TE PREOCUPES EN EXCESO POR LA REDUNDANCIA TRANSITIVA

Si C requiere B y B requiere A, no hace falta incluir A directamente en C. La herramienta detecta y elimina los enlaces que ya están implícitos en otros caminos. Identifica bien las dependencias directas reales de cada nodo; no gastes esfuerzo en rastrear todos los caminos indirectos.`;
const TREE_ES_CALIBRATION = `y para cada uno pregunta algo que lo compruebe directamente, en vez de pedir una autoevaluación. «¿Sabrías cómo [tarea específica y concreta]?» o «¿Has trabajado antes con [técnica específica]?», obtiene respuestas más fiables que preguntar si la persona se siente cómoda con un tema. Esa autoevaluación es especialmente imprecisa para lagunas que ni siquiera sabe que tiene. Pregunta un punto cada vez, o varios juntos solo si están estrechamente relacionados; nunca agrupes puntos sin relación para ahorrar turnos. El número de preguntas lo determina el rango plausible, no una cuota: continúa hasta delimitarlo bien. La respuesta debe ser sencilla de dar: si conoces las herramientas de interacción adecuadas, usa opciones seleccionables; si no, pregunta en una conversación normal. Haz una pregunta cada vez, no varias subpreguntas en un mismo mensaje, y espera la respuesta antes de continuar. 

A partir de las respuestas, localiza dónde el estudiante pasa de manejar realmente las ideas a necesitar que se las enseñen. Una respuesta vaga o una conjetura no equivale a un conocimiento confirmado. Si queda una zona gris, realiza una segunda ronda breve y dirigida justo a ese límite. La cuestión es dónde el primer nodo sería un repaso redundante o un salto confuso, no si la persona es principiante o avanzada en general. Si la primera ronda ya da un límite claro, ve directamente a diseñar el árbol: una segunda ronda no aporta nada. Solo hazla para resolver una incertidumbre real y mantén las preguntas igual de específicas, de una en una.

Si puedes presentar opciones seleccionables, úsalas. Si no tienes esa capacidad en esta conversación, formula las preguntas como texto conversacional normal, de una en una, y espera cada respuesta antes de hacer otra cosa.`;
const TREE_ES_PLAN = `- Recorre la lista y comprueba la granularidad de cada candidato: ¿qué enseña que no enseñan sus vecinos? Fusiona los que no superen esta prueba y divide los que escondan dos ideas distintas.
- Esboza cada candidato como una lección aprendible: qué lo motiva, qué caso concreto lo introduce, qué capacidad se practica y qué conocimientos necesitan esos pasos. Ajusta el alcance según la carga de aprendizaje, sin una cuota de secciones, y escribe explanation como una guía con un objetivo central y límites claros.
- En cada transición decide explícitamente si el segundo tema reformula el primero (agrupar) o necesita herramientas nuevas de verdad (separar).
- Identifica los puntos iniciales reales, que no dependen de otros elementos de la lista, y no los fuerces a una raíz compartida si la materia no la tiene.
- Identifica las convergencias reales: los puntos donde algo existe porque se unen dos o más líneas anteriores. Todo lo demás debe tener los requisitos mínimos que realmente necesita, no una cadena alargada sin motivo.`;
function renderTreePromptEs({ topic, fileSlug, language }, fromFile = false) {
  const opening = fromFile
    ? `Vas a diseñar un árbol de requisitos previos a partir de los archivos adjuntos a esta conversación: un artículo, un fragmento de libro, apuntes, una foto de un problema o cualquier material que la persona quiera entender a fondo y para el que le falten las bases.

Lee todos los archivos completos antes de hacer nada más. Debes averiguar tres cosas; ninguna se te proporciona aquí:

- EL TEMA: no el campo general, sino el concepto, resultado o problema específico alrededor del cual está construido el material. Si hay varios archivos, trátalos como un conjunto y busca lo que los une. Si realmente no están relacionados, sigue el asunto claramente principal y usa el resto como contexto de apoyo.
- EL PUNTO DE PARTIDA: examina qué da por sabido el archivo: notación sin definir, resultados sin demostrar y técnicas sin introducir. Úsalo como primera hipótesis del nivel inicial, sin empezar desde cero ni adivinar un nivel introductorio genérico. Es solo una hipótesis: lo que el archivo presupone y lo que sabe la persona real son cosas distintas. Debes confirmarlo con la calibración descrita abajo antes de diseñar el árbol.
- EL IDIOMA: usa el idioma de los archivos. Si hay varios, sigue el del material central.

Entrega un archivo descargable cuyo nombre provenga de un identificador corto del tema, en minúsculas y snake_case, por ejemplo subject_name-tree.json; no pegues el JSON como texto en el chat.`
    : `Vas a diseñar un árbol de requisitos previos para la materia: ${topic}

Entrega un archivo descargable llamado ${fileSlug}-tree.json; no pegues el JSON como texto en el chat.`;
  return `${opening}

Realiza la lectura, planificación y comprobación en tu razonamiento. Las preguntas de calibración descritas abajo van primero, como conversación normal. Una vez construido el árbol, tu mensaje final debe contener únicamente el archivo, sin introducción, resumen ni comentarios antes o después.

Cada nodo se convierte después en una lección generada por separado, un documento que alguien lee en una sesión. Esta es la restricción real: cada nodo debe ser un objetivo manejable, algo que la persona pueda entender y usar después de una sesión. La longitud sigue ese objetivo, no determina el alcance.
${fromFile ? `
EL DESTINO ES EL PROPIO ARCHIVO, NO EL CAMPO AL QUE PERTENECE

Este árbol no es un panorama genérico del campo. Sus nodos finales deben representar la comprensión completa del contenido adjunto: poder leer ese pasaje, seguir esa derivación o resolver ese problema. Cada nodo anterior se justifica porque el archivo realmente lo necesita, no porque se enseñe habitualmente cerca de ese tema.
` : `
IDIOMA
Escribe todos los valores "label" en ${language}. Los identificadores "id" deben seguir en minúsculas ASCII y snake_case, independientemente del idioma: solo conectan el árbol. Establece también "language" exactamente como "${language}".
`}
ESQUEMA DE SALIDA

{
  "topic": "${fromFile ? 'Nombre de la materia' : topic}",
  "language": "${fromFile ? 'Nombre del idioma' : language}",
  "isSpanish": false,
  "nodes": [
    { "id": "slug", "label": "Nombre visible", "explanation": "Guía docente compacta: capacidad del estudiante, contenido central, conocimientos previos y límites", "requires": ["slug1","slug2"], "optional": false }
  ]
}

- topic: ${fromFile ? 'el tema específico que identificaste en los archivos, escrito como una persona lo nombraría naturalmente. El ejemplo del esquema es ilustrativo, no un valor que debas copiar.' : 'la materia exacta proporcionada arriba, sin cambiarla.'} Inclúyelo siempre: se usa para identificar el árbol y nombrar el archivo descargado.
- language: ${fromFile ? 'el idioma que identificaste en los archivos y en el que escribirás todos los valores "label". El ejemplo es ilustrativo, no un valor que debas copiar.' : 'el idioma de todos los valores "label", exactamente como se indica arriba.'}
- isSpanish: incluye siempre un booleano JSON, nunca una cadena. Determínalo tú según el idioma real de salida: true solo si es exclusivamente español (incluidas variedades regionales y otros nombres del idioma); false para cualquier otro idioma o una salida mixta/multilingüe. Interpreta el idioma por su significado, no por una coincidencia de texto. Conserva language exactamente como se solicitó. El false del esquema es ilustrativo: decide el valor correcto para este árbol. Solo true fuerza la plantilla española de generación de lecciones; false conserva la selección normal de plantillas.
${TREE_ES_FIELDS}

${TREE_ES_DESIGN}

LOS FINALES PUEDEN VOLVER A RAMIFICARSE${fromFile ? ', PERO DEBEN LLEGAR AL CONTENIDO DEL ARCHIVO' : ''}

Un árbol no necesita converger en un único nodo final. Tras una síntesis importante puede ser mejor ramificarse hacia aplicaciones o direcciones independientes que solo necesiten ese nodo, en vez de forzar otra cadena lineal hasta un único final.${fromFile ? ' Al menos una de sus hojas, idealmente el final natural, debe ser el contenido real del archivo: su resultado, pasaje o problema específico, no una aplicación cercana inventada porque los finales puedan ramificarse.' : ''}

AVERIGUA EL PUNTO DE PARTIDA PREGUNTANDO, NO ADIVINANDO

${fromFile ? 'Lo que el archivo presupone es una primera hipótesis razonable, no un hecho confirmado sobre la persona. Puede haber adjuntado material que asuma una soltura que no tiene o un texto introductorio que subestime lo que ya sabe. No pases directamente de las presuposiciones del archivo al diseño.' : 'Una descripción libre de los conocimientos previos, aunque sea de buena fe, no fija de forma fiable dónde debe empezar un árbol. Las personas no siempre conocen sus lagunas; una etiqueta como «sé esta materia» puede significar desde un curso completo hasta un recuerdo difuso. Lo importante es el primer punto en el que realmente tendrían dificultades, y eso suele ser invisible para quien está a un lado de ese límite. Por eso se averigua con preguntas reales y no se acepta sin comprobar una etiqueta que la persona se haya puesto.'}

Antes de diseñar nada, realiza una calibración breve. Elige conceptos concretos repartidos por el rango plausible ${fromFile ? 'según lo que el archivo supone y enseña' : `para ${topic}`}, desde las bases hasta lo claramente avanzado para este árbol, ${TREE_ES_CALIBRATION}

Cuando tengas respuestas reales, de una o dos rondas, úsalas para fijar el comienzo, no ${fromFile ? 'solo la hipótesis basada en el archivo' : 'una conjetura ni solo la descripción libre'}. Continúa directamente con el diseño y la entrega en esta misma conversación. No pidas que la persona ${fromFile ? 'vuelva a adjuntar los archivos' : 'vuelva a pegar nada'} ni trates esto como otra tarea: la calibración es el primer paso del mismo trabajo.

PLANIFICA PRIMERO

La salida es breve: unas decenas de líneas JSON, mucho menos que una lección. Casi todo el esfuerzo debe dedicarse a ${fromFile ? 'leer el material y ' : ''}pensar la estructura, no a escribir el archivo. No empieces a escribir nodos mientras se te ocurren. Antes de escribir una línea de JSON:

- ${fromFile ? 'Lee los archivos completos y determina EL TEMA y EL IDIOMA. Para EL PUNTO DE PARTIDA, realiza la calibración y recibe las respuestas: no lo fijes solo desde las presuposiciones del archivo.' : 'Realiza la calibración anterior y recibe las respuestas. No puedes realizar honestamente el resto de esta lista sin saber dónde debe empezar el árbol.'}
- Lista todos los conceptos, leyes, definiciones o técnicas necesarios para ${fromFile ? 'ir desde ese comienzo hasta entender todo el contenido real del archivo' : 'un tratamiento completo de la materia'}, aproximadamente en el orden de aprendizaje. Esta es la lista de candidatos, antes de comprometerte con identificadores o enlaces.
${TREE_ES_PLAN}
- ${fromFile ? 'Confirma que el contenido real del archivo sea alcanzable como una hoja o conjunto de hojas. Si no lo es, falta algo en la lista: no es un detalle que puedas parchear al final.' : 'Identifica dónde la materia vuelve a ramificarse en aplicaciones o direcciones independientes en vez de continuar en una sola línea.'}

Solo cuando el mapa sea sólido, en tu razonamiento o en notas de trabajo, escribe el JSON. Es el último paso, no algo que construyas de forma incremental mientras aún descubres la estructura.

${fromFile ? 'Ahora lee los archivos adjuntos y diseña un árbol con este formato exacto para lo que enseñan.' : `Ahora diseña un árbol con este formato exacto para: ${topic}`}`;
}
function renderNodePromptEs({ topic, nodeId, prereqLine, leadsToLine, treeTopicLine, explanationLine, language, sectionKeyword = 'SECTION' }) {
  return `Vas a producir una lección de texto plano (.txt) para el tema: ${topic}

Entrégala como archivo descargable llamado ${nodeId}.txt: así queda claro a qué nodo pertenece cuando el árbol tiene muchos. Realiza la planificación, redacción y comprobación en tu razonamiento; tu salida visible debe contener únicamente el archivo, sin introducción, resumen ni comentarios antes o después.

Escribe para un estudiante medio que encuentra el material de este nodo por primera vez y tiene los conocimientos descritos en CONTEXTO. La lección debe ayudarle a comprender la idea y usarla al nivel previsto. La corrección matemática y un formato legible son necesarios, pero también lo son la motivación, los ejemplos accesibles y una secuencia manejable. Planifica antes de redactar y deja que la longitud siga al objetivo de aprendizaje.

CUÁNTAS PREGUNTAS Y CÓMO MARCAR CADA UNA

Incluye tantas preguntas principales como hagan falta para comprobar que cada idea central se ha aprendido como algo que el estudiante puede usar, no solo reconocer o recitar. En temas matemáticos debe poder aplicar las matemáticas, no repetir la definición o el teorema. Sin cálculos, la exigencia equivalente puede ser aplicar un principio a un caso nuevo, distinguir cosas fáciles de confundir o identificar qué situación requiere cada idea. No añadas preguntas para aumentar el volumen, introducir variedad o aportar práctica adicional: para eso está la sección extra. Un documento con pocas ideas principales y una buena pregunta para cada una ya está completo; uno con muchas ideas relacionadas necesita tantas como esas ideas realmente requieran, ni más ni menos.

Cada pregunta principal indica su propia opción correcta con una línea [ANSWER: X] dentro de su bloque [QUESTION N]...[/QUESTION], como se especifica abajo. La etiqueta no se muestra al estudiante: la lee la aplicación para puntuar. Diseña con cuidado el enunciado y los distractores; no dejes que una derivación rápida dicte opciones incorrectas poco trabajadas. No hay una letra objetivo que debas alcanzar: resuelve correctamente la pregunta, marca la respuesta y continúa. La aplicación baraja las opciones y les asigna nuevas letras al mostrarlas, por lo que no debes dirigir la posición de la respuesta correcta ni preocuparte por la distribución de letras.

PLANIFICA PRIMERO

- Lee CONTEXTO como un objetivo de aprendizaje y un límite de alcance. Identifica la capacidad que debe adquirir el estudiante y distingue el contenido central de los casos de apoyo. Si una guía antigua es solo una lista de temas, conviértela en una progresión coherente en vez de dar la misma importancia a cada elemento. Cubre lo requerido de forma económica sin incluir métodos excluidos.
- Elige una pregunta con sentido que dé un propósito a la idea dentro de ese alcance. Puede ser un problema concreto de interpretación; no debe requerir técnicas o aplicaciones posteriores que el estudiante aún no conoce.
- Elige un ejemplo accesible que sostenga la primera explicación. Comprueba todos sus conocimientos necesarios contra CONTEXTO. Prefiere un caso sencillo que revele la idea a uno llamativo que introduzca herramientas desconocidas.
- Planifica cómo se entenderán el significado, la notación, los enunciados generales, el uso resuelto y las distinciones importantes. Prevé confusiones que puedan provocar tus palabras o imágenes.
- Decide qué justificación necesita este nivel. Distingue una ilustración o estimación de una garantía general; no conviertas una introducción informal en una lección de demostraciones. Haz concretas las expresiones abstractas antes de pedir razonamiento sobre ellas.
- Planifica preguntas que primero comprueben la comprensión y después la transferencia a un caso nuevo. Resuelve cada respuesta y sus distractores antes de fijar el enunciado.
- Para objetos visuales, planifica gráficos donde ayuden por primera vez a entender el objeto. Elige rangos y marcas que muestren la propiedad relevante honestamente dentro del formato permitido.

FORMATO DE SALIDA (síguelo exactamente: un analizador leerá el archivo)

Es un archivo .txt de texto plano. Reglas:
- Nada de Markdown: sin **, ##, acentos graves, viñetas con * ni _cursiva_, tampoco ** para simular una letra vectorial en negrita. Eso corresponde a KaTeX mediante \\mathbf{}, no a Markdown.
- Sin HTML, bloques de código, widgets ni elementos interactivos. La única excepción es la línea slider de un bloque gráfico: pertenece al formato del gráfico, no a HTML.
- Usa párrafos normales y los marcadores de sección, pregunta, tabla, línea de tiempo y gráfico descritos abajo.

Encabezados de sección:
=== ${sectionKeyword} N: TÍTULO ===

La primera línea del documento debe ser "=== ${sectionKeyword} 1: TÍTULO ===". No pongas nada antes: ni título general, oración introductoria ni párrafo de encuadre. Empieza la lección en ese marcador para que su estructura sea clara.

Formato exacto de las preguntas:

[QUESTION N]
[ANSWER: X]
Texto de la pregunta, con \\( LaTeX \\) cuando sea necesario.

(A) primera opción
(B) segunda opción
(C) tercera opción
(D) cuarta opción
(E) quinta opción
[/QUESTION]

Sustituye X por la letra realmente correcta de las opciones (A)-(E). La etiqueta funciona igual que en [BONUS]: está oculta al estudiante y solo la lee la aplicación. Coloca la opción correcta donde surja naturalmente al escribir las opciones, en cualquier orden. Ninguna otra parte del documento, antes, después o mucho más tarde, puede explicar, defender o insinuar por qué una opción es correcta o incorrecta. [ANSWER: X] es el único lugar que contiene la respuesta.

Hay cuatro herramientas. Las matemáticas, tablas y líneas de tiempo sirven para material que tenga algo que representar, comparar u ordenar. No fuerces KaTeX en un tema sin matemáticas, ni tablas o cronologías en material sin esa estructura. Los gráficos son distintos: son la opción predeterminada cuando el objeto central de una sección tiene forma, como una función, curva, superficie, campo, relación entre cantidades o configuración de puntos y rectas. Dibújalo cuando la sección empiece a trabajar con él, para que el estudiante lo vea mientras lo analiza el texto. La prosa sola exige imaginar una figura que el gráfico puede mostrar directamente. Omite un gráfico solo cuando no haya nada visual, como manipulación puramente simbólica, una definición sin contenido geométrico o material no cuantitativo. Un documento con geometría y ningún gráfico tiene una laguna que la revisión final debe detectar.

- Matemáticas: en línea con \\( ... \\), en bloque con \\[ ... \\]. Omítelas si no hay nada que representar. No hay símbolos demasiado pequeños o informales para envolverlos: variables sueltas, subíndices, productos escalares o vectoriales y vectores mencionados de pasada también van dentro de \\( \\). Su posición en una frase o en una línea propia no decide si reciben KaTeX. El analizador no distingue una mención informal de una fórmula oficial; tratarlas distinto hace que las ecuaciones estén bien formateadas pero la prosa use ASCII sin formato. Nunca simules negrita o vectores con **; usa \\mathbf{} dentro de \\( \\).
- Tablas: para comparaciones de varias cosas en las mismas dimensiones, referencias de valores o material que el lector tendría que mantener en la memoria a través de varias frases:
[TABLE]
Cabecera A | Cabecera B | Cabecera C
Fila 1 columna A | Fila 1 columna B | Fila 1 columna C
Fila 2 columna A | Fila 2 columna B | Fila 2 columna C
[/TABLE]
  La primera línea es la cabecera. Separa las celdas con " | ", siempre con un espacio a cada lado. Esos espacios distinguen un separador real de un "|" dentro de las matemáticas de una celda, como valor absoluto, norma o notación de conjuntos. Prefiere \\lvert ... \\rvert para valores absolutos por su espaciado; nunca uses \\| para una barra de valor absoluto, pues representa una norma. Mantén las celdas breves: se muestran como una tabla real, no como párrafos largos comprimidos.
- Líneas de tiempo: para cronologías o progresiones donde el orden forme parte de lo aprendido:
[TIMELINE]
Marca 1 | Qué ocurrió o qué representa esta etapa
Marca 2 | Qué ocurrió o qué representa esta etapa
[/TIMELINE]
  La marca suele ser una fecha o año, pero puede ser un nombre de etapa u otra etiqueta breve que realmente ordene la secuencia. Usa una línea por punto y " | " entre marca y descripción, con espacios para distinguirlo de una barra que sea parte de las matemáticas.
- Gráficos: para funciones, curvas, superficies, campos o conjuntos de puntos y segmentos que convenga ver en vez de solo describir. Hay cuatro tipos:

  function2d: una o más curvas y = f(x) en los mismos ejes:
[GRAPH]
type: function2d
title: qué muestra este gráfico
xlabel: x
ylabel: y
xrange: -5, 5
trace: x^2 - 3*x | label: f(x)
trace: 2*x - 3 | label: f'(x)
[/GRAPH]

  parametric2d: una o más curvas definidas por (x(t), y(t)):
[GRAPH]
type: parametric2d
title: qué muestra este gráfico
xlabel: x
ylabel: y
trange: 0, 6.283
trace: cos(t), sin(t) | label: circunferencia unidad
[/GRAPH]

  surface3d: una superficie z = f(x, y):
[GRAPH]
type: surface3d
title: qué muestra este gráfico
xlabel: x
ylabel: y
zlabel: z
xrange: -3, 3
yrange: -3, 3
z: x^2 - y^2
[/GRAPH]

  vectorfield2d: un campo vectorial dado por sus dos componentes como funciones de x e y:
[GRAPH]
type: vectorfield2d
title: qué muestra este gráfico
xlabel: x
ylabel: y
xrange: -3, 3
yrange: -3, 3
u: -y
v: x
[/GRAPH]

  Los gráficos function2d, parametric2d y vectorfield2d pueden incluir puntos, segmentos y deslizadores. Son líneas adicionales opcionales y repetibles; no están disponibles para surface3d. En function2d también puede usarse "aspect: equal" para que los ejes tengan la misma longitud por unidad: úsalo cuando importe la forma real o un ángulo. parametric2d y vectorfield2d ya lo hacen automáticamente.

point: x, y | label: descripción | color: opcional | offset: dx, dy
segment: x1, y1, x2, y2 | label: descripción | color: opcional | dashed: true
slider: nombre | range: min, max | init: valor | step: tamaño

  Un punto marca una posición concreta que use la prosa: un dato, una intersección o un lugar de interés. Un segmento conecta dos posiciones: una distancia, cambio en cada eje, lado de una figura o tramo entre puntos. Sus coordenadas usan la misma notación de calculadora que las curvas. Un deslizador crea un control arrastrable bajo el gráfico; las curvas, puntos y segmentos que usen su nombre como variable se redibujan al moverlo. Los campos vectoriales se dibujan una sola vez con su valor inicial. Úsalo cuando la sección trate de cómo cambia algo con un parámetro: moverlo y ver la respuesta aporta algo que el texto solo puede describir. Ejemplo completo de sintaxis:
[GRAPH]
type: function2d
title: efecto del parámetro
xlabel: x
ylabel: y
xrange: -4, 4
slider: a | range: -2, 2 | init: 1 | step: 0.1
trace: a*x^2 | label: parábola
point: 1, a | label: punto móvil | color: red | offset: 10, -10
segment: 0, 0, 1, a | color: blue | dashed: true
[/GRAPH]

  function2d también admite regiones rellenas; la línea puede repetirse:
fill: expresión_superior, expresión_inferior | range: inicio, fin | label: descripción | color: opcional | opacity: 0.22
  Las dos fronteras usan x y notación de calculadora. Usa 0 para el eje horizontal o constantes para las alturas de rectángulos. range es obligatorio y fija los extremos horizontales; las fronteras y los extremos pueden usar deslizadores y se actualizan al moverlos. label, color y opacity son opcionales; opacity va de 0 a 1. El relleno queda detrás de curvas y marcas. Añade trace para mostrar las fronteras cuando importe su contorno. Usa rellenos para áreas bajo curvas o entre ellas, contribuciones con signo, rectángulos de Riemann y franjas de acumulación. Divide en los cruces o cambios de signo y usa colores y etiquetas distintos cuando importe la diferencia: el relleno es geométrico y no determina el signo de una integral. El muestreo no demuestra continuidad ni detecta todas las discontinuidades; elige intervalos con fronteras finitas y continuas. fill no está disponible en parametric2d, vectorfield2d ni surface3d.

  Las expresiones son autónomas: no hay funciones definidas por el usuario. Si una cantidad se construye a partir de otra curva, escribe la expresión completa en x o t y los nombres de los deslizadores.

  El gráfico forma parte de la explicación y debe respetar las mismas reglas que la prosa. Puede mostrar los casos que desarrolla el texto y la forma general, pero no el objeto específico de una pregunta cercana, su respuesta ni el trabajo que corresponde al lector. Debe aportar algo: al retirarlo, el texto debería perder algo. Marca los puntos con los que se calcula, dibuja los segmentos que se nombran y usa un deslizador cuando se comparen muchos miembros de una familia. Basta un gráfico por idea; no dibujes dos veces lo mismo y limita las curvas para mantener la legibilidad. Coloca el bloque en líneas propias entre párrafos, como una tabla.

  Cada campo va en su propia línea "key: value". title, xlabel, ylabel y zlabel son opcionales, pero normalmente deben rellenarse. function2d requiere xrange; yrange es opcional y, si se omite, se ajusta a las curvas. parametric2d requiere trange; xrange e yrange son opcionales. surface3d y vectorfield2d necesitan xrange e yrange. Elige límites para mostrar lo relevante, no valores genéricos. function2d y parametric2d admiten varias líneas trace; surface3d solo un z y vectorfield2d solo un u y un v. label y color de cada trace son opcionales. Una trace paramétrica contiene ambas componentes en una línea separadas por coma. Separa los campos con " | " y espacios.

  Los títulos y las etiquetas de curvas pasan por KaTeX igual que la prosa. xlabel, ylabel y las etiquetas de puntos y segmentos se dibujan dentro del gráfico: deben ser texto plano o un único tramo matemático completo, nunca una mezcla; mantenlos breves. zlabel es texto plano. Distingue expresiones y etiquetas: LaTeX no se evalúa como fórmula de calculadora y la notación de calculadora no se representa como LaTeX.

  Usa expresiones matemáticas en notación ASCII de calculadora: x^2, sin(x), sqrt(x), abs(x), exp(x), log(x), pi. No uses LaTeX, barras de valor absoluto, multiplicación implícita ni sintaxis que el evaluador no soporte. Escribe 2*x, no 2x. Los nombres de deslizadores usados en expresiones deben estar definidos. Separa campos con " | " y espacios. Escoge rangos que muestren el rasgo relevante. Las etiquetas de ejes, puntos y segmentos deben ser texto plano o un único tramo matemático completo, no una mezcla de texto y matemáticas. No dibujes el objeto específico cuya respuesta solicita una pregunta cercana: mostraría el resultado antes de que el estudiante lo obtenga.

CONTEXTO

${treeTopicLine}
Tema de esta lección: ${topic}
${explanationLine}
${prereqLine}
${leadsToLine}

IDIOMA

Escribe todo el documento en ${language}: títulos, prosa, preguntas y opciones. El marcado estructural debe permanecer exactamente en su forma literal, en cualquier idioma: "=== ${sectionKeyword} N: " y el cierre "===", "[QUESTION N]" / "[/QUESTION]", "[ANSWER: X]", las opciones "(A)" a "(E)", "[TABLE]" / "[/TABLE]", "[TIMELINE]" / "[/TIMELINE]", "[GRAPH]" / "[/GRAPH]" y "[BONUS N]" / "[/BONUS]". Traduce los títulos y el contenido, nunca los marcadores. En los gráficos, conserva también las claves del analizador (type, title, xlabel, ylabel, zlabel, xrange, yrange, trange, trace, fill, range, opacity, point, segment, slider, label, color, z, u, v) y las expresiones matemáticas ASCII. Solo los valores legibles de title, xlabel, ylabel, zlabel y label van en ${language}.

ESTRUCTURA DEL DOCUMENTO

Organiza las secciones como pasos de aprendizaje coherentes. Un ejemplo, una definición y un uso resuelto pueden ir juntos si desarrollan la misma idea; una dificultad nueva puede necesitar otra sección. No hay una cuota de secciones. Fusiona tratamientos repetitivos y dedica más atención a lo central que a lo periférico.

Empieza con una pregunta o situación concreta que haga que valga la pena entender la idea. Una frase breve de propósito es útil cuando aclara qué se va a resolver. Evita anuncios del índice y preámbulos motivadores repetidos.

Construye el significado con un caso accesible y después presenta el enunciado general y la notación. Explica el papel de cada símbolo y cómo leer la expresión completa: una fórmula mostrada no se explica sola. Convierte frases abstractas en comparaciones, elecciones o requisitos numéricos concretos antes de apoyarte en ellas. Las metáforas deben ayudar sin sugerir propiedades falsas. Usa un caso de contraste cuando resuelva una confusión probable.

Muestra cómo se usa la idea a este nivel: interpretar información, predecir, distinguir casos o aplicar un método. Un nodo conceptual también necesita un uso resuelto aunque excluya técnicas de cálculo. Mantén visible el propósito del ejemplo y modestos sus conocimientos necesarios.

Ajusta la justificación al objetivo. Deriva un método si entender la derivación es parte del alcance; explica el motivo de una afirmación conceptual a un nivel accesible. Las definiciones necesitan significado y ejemplos, no demostraciones inventadas. Explicita los supuestos y evita saltos sin fundamento, pero no demuestres cada afirmación no trivial solo porque puedas. En una lección informal puede bastar explicar brevemente por qué se mantiene un patrón. Distingue lo que sugieren datos muestreados de lo que garantiza una regla, sin dejar que esa distinción domine el primer encuentro con la idea.

Introduce contrastes de apoyo cuando la idea central esté asentada. No dediques a un catálogo de excepciones más espacio que a entender y usar el caso corriente. Deja fuera las técnicas excluidas y el formalismo posterior, manteniendo motivación e interpretación correcta.

Cada imagen debe coincidir con el objeto matemático o factual que describe. No representes un punto ausente borrando un intervalo visible ni sugieras que un muestreo finito capta todo el comportamiento. Usa solo funciones gráficas admitidas. Si el formato no representa fielmente una distinción, explica la limitación y elige otra ilustración: no inventes sintaxis ni afirmes que se ve algo que no se ve.

Distribuye las preguntas principales por el documento, justo después de introducir el concepto o técnica que comprueban. Una pregunta sobre una definición va después de esa definición; una sobre un resultado derivado va después de su derivación. Deben ser pausas naturales para probar lo aprendido, no un grupo de ejercicios al final. No las agrupes ni crees una sección independiente de ejercicios. Una vez planteada una pregunta, ninguna otra parte del documento puede discutir, justificar, insinuar ni evaluar su respuesta o sus opciones, ni antes ni después ni mucho más adelante. También cuenta un comentario reflexivo que explique por qué un distractor parece tentador: llamarlo observación general no cambia que esté explicando una opción. El lector puede desplazarse libremente, por lo que cualquier explicación cercana sería visible antes de resolver. Tras la pregunta avanza a contenido nuevo, sin volver a defender o desarrollar lo que se acaba de comprobar. Usa [QUESTION N] en línea y numera en orden consecutivo. Lee todas las reglas de construcción de preguntas antes de redactar la primera.

Después de la última pregunta principal añade práctica extra con el formato siguiente. Es práctica de lo ya cubierto, nunca un adelanto. No hay una cantidad objetivo: incluye las que merezcan estar. Puedes usar un caso sorprendente, una configuración que aclare la estructura o un problema más difícil y satisfactorio, siempre con las herramientas ya desarrolladas. No lo fuerces: variantes más difíciles, casos menos habituales o límites que no cubrieron las preguntas principales también sirven. Puedes relacionar ideas ya establecidas aquí o en la secuencia anterior. Nunca exijas conocimientos no proporcionados, aunque CONTEXTO mencione un tema posterior. También están excluidos pasos que parezcan naturales pero que el documento nunca haya enunciado o mostrado. Mencionar una aplicación real como contexto está bien; la pregunta debe resolverse completamente con lo que el documento haya derivado.

[BONUS 1]
[ANSWER: X]
Texto de la pregunta.

(A) opción
(B) opción
(C) opción
(D) opción
(E) opción
[/BONUS]

Sustituye X por la letra correcta, igual que en las preguntas principales. La etiqueta está oculta y solo se usa para dar respuesta. Se aplican las mismas reglas de construcción.

REGLAS DE CONSTRUCCIÓN DE PREGUNTAS

Una pregunta cumple su función si exige algo que el estudiante aún no tiene hecho: trabajar un caso nuevo, tomar una decisión o dar un paso de razonamiento no explicado. La sencillez no es un problema: una buena pregunta sencilla supera a una complicada y suele ser la adecuada para un tema sencillo. El problema es repetir. Si basta recordar la frase inmediatamente anterior, no se comprueba aprendizaje. Revisa cada pregunta frente a todas las situaciones siguientes.

TRABAJO NUEVO AL NIVEL ADECUADO. Deja un trabajo significativo, no repitas una respuesta ya dada. Las primeras comprobaciones pueden usar una estructura familiar con valores nuevos para aprender a leer notación o hacer una primera aplicación. Las posteriores deben pedir otra interpretación, elegir entre casos, corregir una afirmación o transferir a otra configuración. No exijas un tipo de objeto nuevo en cada pregunta: puede añadir dificultad ajena al objetivo. Combina comprobaciones accesibles y transferencia real. Todo debe poder resolverse con conocimientos establecidos.

RAZONAMIENTO ENTREGADO. Si un dato intermedio se obtiene mediante un paso breve y sencillo desde el enunciado, deja que el estudiante lo deduzca. Conserva los datos realmente dados, como medidas, constantes o una configuración que no podría conocer de otro modo. Esto afecta al camino de razonamiento, no solo a cantidades: si el enunciado ya explica la relación, mecanismo o fórmula que lleva a la respuesta, ha hecho el trabajo del lector. Evita la forma frecuente de derivar una fórmula y abrir la pregunta siguiente con «Usando [esa fórmula], calcula…». No vuelvas a entregar un resultado ya establecido en el enunciado; confía en que se recuerde sin indicárselo. Si nombrar varios resultados es necesario para aclarar qué está en juego, acompáñalo de una decisión real: qué caso aplica, qué signo o dirección corresponde o cómo se combinan piezas. Recordar la herramienta debe ser el inicio, no toda la tarea.

COMPRUEBA LA CAPACIDAD PREVISTA. Evalúa según el objetivo, no el número de cálculos o decisiones. Sustituir o identificar puede ser adecuado como primera comprobación de una interpretación nueva, pero no basta como única evidencia de comprensión conceptual. Incluye opciones que distingan explicaciones, representaciones, supuestos o casos, de modo que no baste reconocer las palabras del párrafo anterior.

CONCEPTO EVITABLE. En temas complejos o sutiles, busca preguntas que realmente exijan comprender: una trampa conceptual, un caso donde falle el método mecánico evidente o la necesidad de elegir primero el principio correcto. En temas sencillos, una pregunta directa suele ser mejor; no inventes complejidad. Antes de fijar una pregunta sobre una técnica o identidad, comprueba si existe un camino más directo, al menos igual de fácil, que la evite por completo, como calcular a mano el resultado bruto. Si existe, la pregunta no comprueba la técnica aunque parezca relacionada. Cambia la configuración para que sea la vía más rápida o la única razonable, o no plantees esa pregunta.

CONCISIÓN. Indica los datos y lo que se pide, y termina. Reexplicar contexto ya conocido, narrar en vez de presentar o anunciar qué herramienta usar antes de que el estudiante la elija son relleno. Esto también afecta a las opciones: si el enunciado ya fija un orden, variable o notación, no lo repitas delante de cada opción; da solo el valor y deja que el enunciado explique qué representa.

DISTRACTORES. Deben ser claramente incorrectos tras reflexionar. En matemáticas evita opciones equivalentes aunque se escriban distinto y nunca dupliques una opción. Si la idea central es que una cantidad no depende de una variable que parece relevante, incluye al menos un distractor que represente la dependencia falsa, no solo números cercanos al correcto. De otro modo se podría adivinar la constante sin entender por qué es constante.

ACERTAR EL OBJETIVO. Algunas preguntas dependen de distinciones fáciles de invertir: qué cosa es cuál, dirección de una relación o causa, orden temporal, lado de un efecto, suma frente a resta. Resuélvelas deliberadamente y compruébalas antes de fijarlas: es una fuente frecuente de respuestas incorrectas que pasan inadvertidas al redactar. Si una pregunta corresponde de forma natural a una sección concreta, confirma que una elección razonable y no forzada de valores o configuración dé una respuesta clara y defendible. Si no, busca libertad no aprovechada, como un signo, magnitud, dirección, papel de cada objeto o caso, antes de forzar un enunciado artificial.

REVISIÓN FINAL

Antes de terminar, relee de principio a fin en el orden real de lectura. Comprobar reglas mientras escribes cada pieza no detecta problemas en cómo se relacionan piezas distantes. Lee como alguien que lo ve por primera vez y busca errores que solo se ven en conjunto:

- ¿Alguna pregunta o bloque requiere una fórmula, definición o resultado que aparece después? Solo puede usar lo que el estudiante haya visto en ese punto exacto, no una sección o párrafo posterior.
- ¿La apertura da un propósito claro a la idea? ¿Las frases de propósito ayudan en vez de repetir anuncios? ¿Se puede seguir la progresión sin conocer ya la conclusión?
- ¿El enunciado central tiene significado claro, notación explicada, ejemplo accesible y uso resuelto? ¿Su justificación encaja con el alcance, sin afirmaciones sin fundamento ni formalismo prematuro?
- ¿Las preguntas dejan trabajo real al nivel previsto y avanzan hacia interpretación nueva o transferencia? ¿Alguna repite una respuesta ya dada o inventa dificultad con herramientas desconocidas?
- Ningún inicio con «usando…» ni enunciado que repita una herramienta recién derivada antes de pedir aplicarla.
- Ningún párrafo explica, defiende o insinúa por qué una opción concreta es correcta o incorrecta, antes, después o mucho más tarde.
- Cada pregunta extra se apoya en algo que el documento principal realmente enunció o demostró, no en una extensión natural nunca mostrada.
- Cada pregunta principal y extra tiene exactamente un [ANSWER: X] con una letra de sus propias opciones. Una etiqueta ausente, errónea o sin opción correspondiente impide puntuar.
- Cada sección cuyo objeto central tenga forma incluye un gráfico donde empieza a trabajar con él. Explicar solo con prosa un objeto visible es una laguna que debes corregir.
- ¿El texto y las imágenes evitan implicaciones engañosas? ¿Los gráficos representan fielmente el dominio y las propiedades, reconociendo las limitaciones del formato?
- Cada gráfico usa notación de calculadora, no LaTeX ni barras de valor absoluto, y ^ para potencias; define los deslizadores usados, elige rangos que muestren lo explicado y no dibuja el objeto que pregunta un ejercicio cercano. xlabel, ylabel y las etiquetas de puntos y segmentos son un tramo matemático completo o texto plano, nunca una mezcla. Separa campos con " | " y espacios.
- No hay barras "|" de valor absoluto dentro de celdas salvo mediante \\lvert y \\rvert.

Si detectas algún problema, corrígelo antes de finalizar. Aplicar bien una regla mientras redactas una pieza no garantiza que el documento completo sea correcto: lo confirma la lectura final.`;
}
