# dps-maximizer

[![CI](https://github.com/keivanmalhani/dps-maximizer/actions/workflows/ci.yml/badge.svg)](https://github.com/keivanmalhani/dps-maximizer/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) | Espanol

En vivo: https://keivanmalhani.github.io/dps-maximizer/

Inicia sesion con Bungie, elige tu clase y lo que estas haciendo (un modo
generico o una incursion, mazmorra o encuentro de Panteon especifico), y
obten el loadout de maximo dano que puedas armar con lo que realmente tienes,
la rotacion que requiere de ti, y lo unico mejor que te falta desbloquear.

## Para que sirve

light.gg te dice que un arma es god roll. God roll para que? Weapon Report te
dice que usas, Fireteam Report te dice que correr; este responde la pregunta
que esta debajo de cada discusion de fase de dano: **dado mi arsenal real,
que es lo mas fuerte que puedo ponerme ahora mismo, y que se supone que haga
con eso?**

La respuesta llega como una sola tarjeta, antes de cualquier tabla:

- armas por ranura, cada una con el razonamiento propio de la lista de tiers,
  citado
- la armadura exotica y la super para tu clase, con la misma procedencia
- los trabajos de fireteam (Tractor, Lumina, Divinity) separados de tus
  ranuras, porque un debuff es un trabajo que alguien hace, no un arma con la
  que tu personalmente haces DPS
- la rotacion como pasos numerados en palabras simples: "golpea una vez con
  cada arma, unos 7 segundos entre golpes, el tercer golpe arma un bono
  grande"
- lo unico mejor que no tienes, con su ruta de obtencion concreta y tu conteo
  de Cifrado Exotico cuando el Monumento a las Luces Perdidas lo vende
- tus estadisticas de Armadura 3.0, leidas de tu personaje equipado, contra
  los techos de dano publicados
- la hoja de referencia de la aritmetica de buffs: los cuatro grupos, que se
  acumula, y los mitos, para que el conocimiento tribal este en la pagina en
  vez de en un Discord

Sin sesion iniciada, la pagina entera corre sobre un arsenal de demostracion
claramente marcado como inventado, asi que nunca hay una pantalla vacia.

## Por que los datos no pueden quedar obsoletos

**Datos vigentes a partir de la Actualizacion 9.7.0.4, 28 de julio de 2026. El
juego ya no recibe parches de balance, asi que esto no se vuelve obsoleto.**

Destiny 2 dejo de recibir actualizaciones de contenido el 9 de junio de 2026
(Actualizacion 9.7.0; el hotfix final fue 9.7.0.4 el 28 de julio de 2026). El
meta que describe este sitio es el meta permanente. Por eso un conjunto de
datos curado a mano es la arquitectura correcta aqui en vez de un
compromiso: ya no queda nada de lo que pueda alejarse. El sello arriba
aparece en la propia pagina, porque un lector merece saber por que una lista
de tiers estatica es confiable.

## Por que tiers y no numeros

La hoja de calculo de DPS autorizada de la comunidad (la hoja Aegis) tiene sus
pestanas de ranking numerico ocultas a mitad de una reconstruccion, lo que
significa que **ahora mismo no existen cifras de DPS por arma confiables y
publicas**. Este sitio se niega a inventar ninguna.

Asi que clasifica por TIER, con las anotaciones propias de la hoja citadas
textualmente como razonamiento, y cada afirmacion en el conjunto de datos
lleva un campo `source`. Los pocos porcentajes que aparecen (30 de Tractor,
35 de Lumina, 10 de No Hesitation, el 25 a 30 de Wolfpack sobre dano base de
cohete, el ~4 por ciento de costo de dejar caer una tercera arma de rotacion)
son los que estan verificados y vigentes via Aegis; en todo lo demas la
pagina dice "prueba comunitaria pendiente" en lugar de llenar el vacio con un
decimal que parece autorizado y no lo es. La tabla general de porcentajes de
buff esta pendiente de la transcripcion de Court de junio de 2026 y esta
etiquetada asi en la pagina.

Otras reglas de honestidad que dieron forma al codigo:

- La propiedad es dos cosas distintas y la pagina dice cual: un objeto en tu
  arsenal o en un personaje se puede armar ya; un objeto que solo esta
  iluminado en Colecciones se puede sacar si es exotico y no se puede si es
  una legendaria de roll aleatorio.
- Los catalizadores se leen de los sockets de tu objeto donde el perfil los
  expone; donde no, la pagina dice "estado del catalizador desconocido" en
  vez de adivinar.
- Los rolls deseados (Overflow o Envious Assassin de Hezen Vengeance mas Bait
  and Switch o Cluster Bomb o Elemental Honing; Perfect Fifth de Ergo Sum) se
  verifican contra tus instancias reales, perks base o mejorados.
- Los stuns de campeon se derivan del frame intrinseco de cada arma resuelto
  desde el manifiesto, usando el mapeo de frames Anti-Campeon 2.0 del dev
  insight del 2026-05-29. Los intrinsecos exoticos que el mapeo no nombra se
  reportan como pendientes, no adivinados. Ergo Sum tiene su frame aleatorio,
  asi que su efecto de campeon se reporta como desconocido.
- El despeje de adds es donde la hoja fuente esta mas delgada, y la pagina lo
  dice; la ranura de energia en ese modo esta honestamente vacia en vez de
  rellenada.
- PvP esta fuera de alcance, y elegirlo lo dice en vez de responder a medias.
- Si el propio disparo que activa Bait and Switch se beneficia esta en
  disputa en las pruebas de la comunidad, y la tarjeta de rotacion dice
  exactamente eso.
- Divinity hace cero dano a Insurrection Prime desde el hotfix 9.7.0.3 (su
  jaula no lo dana; Fallen Tech bloquea el arma ahi), y funciona en todos
  lados mas - la investigacion de encuentros del 2026-08-08 corrigio la
  afirmacion mas amplia anterior, y el sitio ahora declara el alcance
  corregido. Si la jaula todavia se forma para companeros ahi es sin
  confirmar y se dice que lo es. Igualmente la rareza verificada de que un
  Well of Radiance ANULA Radiant para Golden Gun aparece exactamente cuando
  Golden Gun es la super recomendada.

## Encuentros: la misma honestidad, un nivel mas profundo

El selector de actividad ahora va mas alla de los cuatro modos genericos:
las 10 incursiones, las 11 mazmorras y los tres gauntlets permanentes de
Panteon 2.0, encuentro por encuentro, desde `docs/encounter-research.md` (el
informe de investigacion con fuentes que es el UNICO origen de los datos de
encuentros en el sitio). Cada pagina de encuentro muestra su perfil de dano
(segundos de ventana de la pestana Aegis Bosses, alcance, movimiento, critico)
y cada regla especial con su fuente y codigo de confianza.

Tiers-no-numeros se mantiene a nivel de encuentro, y importa mas ahi. El
informe registra REGLAS (el Templario resiste explosivos fuera de su estado
elevado; Atraks-1 es un blanco proxy donde los criticos y debuffs no sirven;
Crota recibe 35 por ciento mas de espadas; Morgeth resiste francotiradores;
Oryx y el Testigo rompen el seguimiento de proyectiles y el tether), no
cifras de DPS por encuentro - asi que el motor dobla los mismos conjuntos de
tiers segun esas reglas y dice que id de regla hizo el doblez en la tarjeta,
en vez de inventar numeros de DPS de encuentro que nadie publico. Donde el
informe marca una afirmacion en disputa (el 5x de Atheon) la pagina muestra
"reportado pero sin confirmar"; donde lista un vacio (duracion de fases de
Panteon, mecanicas del Desert Perpetual Epico) la pagina dice desconocido;
donde no existe consenso de loadout por encuentro, la pagina dice que aplica
el razonamiento generico de DPS de jefe en vez de disfrazar la respuesta
generica de sabiduria especifica del encuentro.

La respuesta tambien crecio en profundidad:

- El Loadout A es la respuesta; las Opciones B y C son las siguientes
  mejores construcciones LEGALES que son significativamente distintas (otro
  asiento exotico o ninguno), de la misma busqueda de un solo exotico, nunca
  un reacomodo de una sola ranura.
- "Todo lo que tienes que califica": la tabla de arsenal completo (924 armas
  horneadas del manifiesto en `src/data/arsenal.json`) filtrada a lo que
  posees, clasificada por el orden de arquetipos con fuente para el estilo
  de ventana del encuentro, con tus rolls de perk de dano reales leidos de
  los sockets del objeto - "Tu roll: Envious Assassin + Bait and Switch" o
  la wishlist honesta cuando tu copia no tiene uno. Los arquetipos mas alla
  del orden con fuente se listan, no se clasifican, y lo dicen. El JSON de
  arsenal pesa ~505 KB, asi que carga como su propio chunk perezoso al
  primer uso; una prueba falla el build si algo lo importa de forma
  estatica.
- Enlaces profundos: `?activity=vault-of-glass&encounter=templar&class=titan`
  restaura la pagina exacta, asi que un loadout de encuentro es una URL que
  le puedes dar a tu fireteam.

## La armeria: todo lo que tienes, y moverlo

La segunda pestana es un gestor de inventario completo. Ranuras al costado,
tus tres Guardianes y el arsenal arriba, cada objeto como una casilla con su
poder, su estado de bloqueo y masterwork, y sus perks al hacer clic. Doble
clic equipa. Los loadouts guardan lo que un personaje trae puesto y lo
regresan despues.

**Por que abre al instante y DIM no.** DIM descarga la tabla de objetos de
Destiny en la primera corrida y la guarda en IndexedDB. Esa tabla pesa 199 MB
de JSON, medido el 2026-08-08 contra el manifiesto
244213.26.06.29.2000-1-bnet.65583. DIM tiene que funcionar asi porque el
juego solia cambiar cada temporada. Este no, porque el juego se detuvo, asi
que la tabla se recorta en tiempo de build por `scripts/build-armory.mjs` y
se entrega como un archivo estatico:

    8,237 definiciones de armas y armadura     997 KB,   307 KB por la red
    9,661 plugs de socket con descripciones  1,870 KB,   502 KB por la red

La tabla de plugs es la mitad mas grande y la cuadricula nunca la necesita,
asi que es un chunk separado que carga la primera vez que se abre un panel de
detalle. Un visitante que solo lee la pestana de respuesta no descarga
ninguna de las dos.

**Cada escritura vive en un solo archivo.** `src/write.ts` es el unico modulo
en el repositorio que puede cambiar tu cuenta, y sus funciones no compilan
sin una `Confirmation`, que solo puede acunar `confirmWrite()` con la frase
exacta que un humano acepto. Un render no puede producir una. La prueba que
importa es `tests/armory-panel.test.ts`: dibujar toda la cuadricula envia
cero solicitudes, y quitar el candado de armado hace fallar dos pruebas, lo
cual se verifico quitandolo.

**La division de consentimiento, dicha en vez de escondida.** Los cambios en
vivo estan apagados por defecto y activarlos es un dialogo que nombra lo que
permite. Despues de eso, equipar algo que un personaje ya tiene sucede sin
mas aviso, porque es reversible en un clic y no puede perder un objeto.
Cualquier cosa que MUEVA un objeto, y cada loadout, imprime el plan completo
y pregunta de nuevo, porque una transferencia a un correo lleno es la unica
forma en que este sitio le podria costar a alguien equipo real.

**Aplicar un loadout es un plan, no un bucle.** Destiny no tiene
transferencia de personaje a personaje, asi que un intercambio entre
Guardianes son dos saltos por el arsenal, y un objeto equipado no se puede
mover en absoluto. `src/loadouts.ts` construye todo como datos primero: cada
salida antes de cualquier llegada, para que un plan no pueda llenar una
ranura y luego fallar a medias, y un solo equipado masivo al final cuyos
resultados por objeto se leen en vez de su sobre. Bungie responde
`ErrorCode 1` para el sobre mientras objetos individuales fallaron dentro de
`equipResults`, que es como una herramienta reporta un loadout como aplicado
mientras la mitad sigue en el arsenal.

Lo que no puede hacer, lo dice, con la solucion: un objeto equipado en tu
otro Hunter regresa como "equipa Vault Gun en ese personaje primero" en vez
de `DestinyCannotPerformActionOnEquippedItem`.

## Como lee tu cuenta

Una sola llamada autenticada a `GetProfile` con componentes
`100,102,200,201,205,300,305,800,900`: perfil, arsenal, personajes,
inventarios de personaje, equipo, instancias de objeto, sockets de objeto,
coleccionables, records. El arsenal y Colecciones son componentes
autenticados, por eso este sitio es solo con inicio de sesion; una busqueda
por Bungie Name veria en silencio una fraccion de la verdad y fingiria que
era todo.

**Inicia sesion con Bungie.** Un boton. Va a bungie.net, regresa por
[d2-auth](https://github.com/keivanmalhani/d2-auth), y lee la cuenta con la
que iniciaste sesion. Cada sitio en `keivanmalhani.github.io` comparte
origen y por lo tanto comparte la sesion, asi que iniciar sesion en uno te
conecta en todos. Bungie no emite refresh token a un cliente publico, lo que
significa que la sesion dura una hora y no se puede extender, solo
reemplazar; la pagina dice cuanto queda de la hora y ofrece el boton de
nuevo cuando se acaba. Los cuatro codigos de plataforma que significan que
el inicio de sesion termino (99, 2111, 2123, 2124) nunca se reintentan; el
bucle de reintento se ramifica primero por el codigo de error y solo deja
votar al estado HTTP cuando no hay codigo alguno, porque Bungie devuelve
errores de aplicacion comunes como HTTP 500.

La API key propia del sitio va incluida en el JavaScript compilado. Eso no
es un descuido: un navegador tiene que enviarla con cada solicitud, asi que
no hay donde ponerla que un lector no pueda alcanzar, y toda herramienta
estatica de Destiny funciona asi. Lo unico que protege es un limite de tasa.

## El manifiesto horneado

El sitio no envia ni descarga el manifiesto completo de objetos del lado del
cliente; solo la tabla de objetos en ingles pesa unos 190 MB de JSON. Como
el juego esta congelado, `scripts/build-data.mjs` obtiene el manifiesto UNA
VEZ en tiempo de build (endpoint sin llave), resuelve SOLO la lista curada
en `src/data/items.json` (unos 19 KB), y el sitio entrega eso.

El script es paranoico a proposito. El nombre visible de cada hash resuelto
se verifica contra el nombre de objeto esperado y el build FALLA
RUIDOSAMENTE ante cualquier discrepancia, ausencia o ambiguedad, porque un
hash equivocado significa recomendar el arma equivocada con toda seriedad.
Tambien resuelve, con la misma verificacion:

- cada version del manifiesto de cada objeto (tener cualquier Edge Transit
  cuenta, y el Hezen y Praedyth's Timelost cuentan para sus nombres base)
- hashes de coleccionables, para la mitad de Colecciones de la propiedad
- ranuras de arma, cubetas de armadura y bloqueos de clase desde
  `DestinyEquipmentSlotDefinition` y las definiciones de objeto, asi que
  ninguna ranura se recuerda mal jamas (el manifiesto dice que Ergo Sum es
  un arma de energia, diga lo que diga tu memoria)
- frames intrinsecos para el mapeo de campeones
- los hashes de perk plug para las verificaciones de roll deseado, base y
  mejorados
- los hashes de plug de catalizador y el plug de Socket de Catalizador Vacio
- el hash de objeto del Cifrado Exotico y los seis hashes de estadistica de
  personaje de Armadura 3.0

`src/data/items.json` esta commiteado, asi que `npm ci && npm test && npm run
build` no necesita red mas alla de npm. Volver a correr `npm run data`
re-verifica contra el manifiesto en vivo (congelado); las pruebas cruzan el
JSON contra la lista curada en `src/data/tiers.ts`, asi que los dos no
pueden desalinearse en silencio.

## Desarrollo

```
npm ci
npm test          # vitest
npm run build     # typecheck luego vite build
npm run dev       # servidor de desarrollo local
npm run data      # re-verifica y regenera src/data/items.json desde el manifiesto
npm run ascii     # falla ante cualquier byte no-ascii en un archivo de texto
```

`src/auth.ts` viene copiado tal cual de `d2-auth/src/client.ts` y debe
cambiarse ahi en vez de aqui. Se copia en vez de depender de el porque el
unico contrato real entre estos sitios es el nombre y la forma de una llave
de `sessionStorage`, lo cual no amerita un paquete publicado.

No hay dependencias en tiempo de ejecucion. El motor de recomendacion
(`src/recommend.ts`), el parser de propiedad (`src/ownership.ts`) y cada
pieza de logica de copy son funciones puras, probadas contra inventarios de
fixture: el loadout elegido, los pasos de rotacion, la siguiente eleccion de
desbloqueo, los fallbacks de tier cuando un jugador no tiene nada, las
anotaciones de campeon, y las condiciones exactas bajo las que aparece la
advertencia de Well/Golden Gun.

La tarjeta para compartir se renderiza a `public/og.png` por
`scripts/render-og.mjs`, que esta deliberadamente fuera del build porque
necesita un canvas nativo:

```
npm install --no-save @napi-rs/canvas
node scripts/render-og.mjs
```

## Estructura

```
src/
  data/tiers.ts        el conjunto de datos de tiers curado, citas y fuentes (datos puros)
  data/encounters.ts   la base de datos de encuentros, transcrita de docs/encounter-research.md
  data/rotations.ts    conocimiento de rotacion como datos
  data/buffs.ts        los cuatro grupos, rarezas, mitos
  data/champions.ts    mapeo de frames Anti-Campeon 2.0
  data/class-notes.ts  llamadas de super por clase y letra pequena
  data/armor-stats.ts  techos de estadistica de dano de Armadura 3.0
  data/items.json      hechos del manifiesto horneados, generado, verificado, commiteado
  data/items.ts        acceso tipado al horneado
  data/arsenal.json    el horneado del arsenal completo de armas, carga perezosa, commiteado
  recommend.ts         el motor (puro), busqueda de un exotico + ajustes de encuentro
  encounter.ts         reglas de encuentro compiladas en ajustes de motor (puro)
  arsenal.ts           puerta de arsenal perezosa + deteccion de roll + ranking de tabla (puro)
  url-state.ts         (de)serializacion de enlace profundo (puro)
  ownership.ts         respuesta de GetProfile a modelo de propiedad (puro)
  card.ts              el dibujo de la tarjeta para compartir de 1200x630 (puro)
  signin.ts            la sesion como estado de UI y texto de error (puro)
  bungie.ts            cliente de plataforma, regla de reintento por codigo primero
  auth.ts              copiado de d2-auth, no editar aqui
  format.ts            escape y limitado
  ui/sections.ts        markup como funciones puras de string
  ui/app.ts             el shell
  main.ts                punto de entrada
docs/encounter-research.md  el informe de encuentros con fuentes; el unico origen de datos de encuentros
fixtures/demo.ts       el arsenal de demostracion inventado, pasado por el parser real
scripts/build-data.mjs el horneado del manifiesto, ruidoso ante cualquier discrepancia
scripts/build-arsenal.mjs el horneado del arsenal
scripts/render-og.mjs  el render de la tarjeta OG
tests/                 la suite de vitest
```

## Lo que no hara

- **No te dara un numero.** Ninguna cifra de DPS por arma es confiable ahora
  mismo, asi que no hay ninguna aqui. Tiers mas razonamiento citado es lo
  que la evidencia sostiene.
- **No leera el arsenal de alguien mas.** El arsenal y Colecciones necesitan
  el token del dueno. No hay caja de busqueda porque solo podria funcionar a
  medias.
- **No clasifica PvP.** Fuera de alcance en v1, dicho en la pagina.
- **No conoce tu artefacto ni tu configuracion de subclase.** Lee equipo,
  Colecciones, sockets y estadisticas.
- **No tiene cuentas y no guarda nada propio.** Cierra la pestana y el unico
  rastro es una sesion que muere con ella si iniciaste sesion.
- **No esta afiliado a Bungie** ni a la hoja Aegis; las anotaciones de la
  hoja se citan como el registro comunitario que son, con atribucion.

## Seguridad

Ver [SECURITY.md](SECURITY.md). Version corta: reporta en privado por la
pestana de Security, no hay servidor ni llave propia que valga la pena
robar, y el ultimo release etiquetado es el que tiene soporte.

## Licencia

MIT. Ver [LICENSE](LICENSE).

Los nombres de armas e iconos vienen del manifiesto publico de Destiny. El
razonamiento de tiers es citado de la pestana de equipo de la hoja de dano
de jefes Aegis (2026-07) y los dev insights finales de Bungie, acreditados
en cada tarjeta.
