/*
 * Everything a child reads or hears, in every language. Colours and order come
 * from KidRig.EMOTIONS (src/rig/rig.js).
 *
 * LANGS     the languages the app offers; `tts` is the speech language tag and
 *           `voice` matches the browser voices that can speak it
 * EMOJI     one emoji per feeling, shared by all languages
 * UI        interface words per language
 * FEELINGS  per language and feeling:
 *   label  name on the sticker and the stage
 *   say    what the voice says when the feeling opens
 *   text   one or two short sentences a grown-up can read aloud
 *   tryIt  a tiny thing to do with your own face or body
 * In Spanish, "@" becomes "o" or "a" to match the chosen kid (Enojado / Enojada).
 */
var LANGS = [
  { code: 'en', name: 'English',      short: 'EN', tts: 'en-US', voice: /^en([-_]|$)/i },
  { code: 'es', name: 'Español',      short: 'ES', tts: 'es-ES', voice: /^es([-_]|$)/i },
  { code: 'nb', name: 'Norsk bokmål', short: 'NB', tts: 'nb-NO', voice: /^(nb|no)([-_]|$)/i }
];

var EMOJI = {
  happy: '😄', sad: '😢', angry: '😠', scared: '😨', surprised: '😲', disgusted: '🤢', calm: '😌',
  excited: '🤩', tired: '🥱', proud: '🏆', embarrassed: '😳', confused: '😕', jealous: '😒', grateful: '🙏',
  lonely: '😔', hopeful: '🌈', nervous: '😬', bored: '😑', curious: '🤔', loving: '🥰'
};

var UI = {
  en: {
    title: 'How do you feel today?', hint: 'Tap a feeling to meet it.',
    friend: 'Choose a friend', girl: 'Girl', boy: 'Boy', language: 'Language',
    soundOn: 'Sound on', soundOff: 'Sound off', surprise: 'Surprise me',
    back: 'All feelings', again: 'Say it again', read: 'Read to me', tryIt: 'Try it:',
    prev: 'Previous feeling', next: 'Next feeling', kidFeeling: 'A kid feeling {x}',
    record: 'Record my voice', stop: 'Stop', remove: 'Delete my voice', hasVoice: 'Has your voice',
    confirmRemove: 'Delete your recording of “{x}”?',
    noMic: 'This browser can’t record sound.', micBlocked: 'The microphone is blocked. Allow it in the browser to record.',
    noVoice: 'This device has no English voice. Record your own voice!',
    missing: 'The animation is missing. Run <code>npm run build</code>, then reload.'
  },
  es: {
    title: '¿Cómo te sientes hoy?', hint: 'Toca un sentimiento para conocerlo.',
    friend: 'Elige un amigo', girl: 'Niña', boy: 'Niño', language: 'Idioma',
    soundOn: 'Sonido activado', soundOff: 'Sonido apagado', surprise: 'Sorpréndeme',
    back: 'Todos los sentimientos', again: 'Dilo otra vez', read: 'Léemelo', tryIt: 'Pruébalo:',
    prev: 'Sentimiento anterior', next: 'Sentimiento siguiente', kidFeeling: 'Sentimiento: {x}',
    record: 'Grabar mi voz', stop: 'Parar', remove: 'Borrar mi voz', hasVoice: 'Tiene tu voz',
    confirmRemove: '¿Borrar tu grabación de «{x}»?',
    noMic: 'Este navegador no puede grabar sonido.', micBlocked: 'El micrófono está bloqueado. Permítelo en el navegador para grabar.',
    noVoice: 'Este dispositivo no tiene voz en español. ¡Graba tu propia voz!',
    missing: 'Falta la animación. Ejecuta <code>npm run build</code> y recarga la página.'
  },
  nb: {
    title: 'Hvordan har du det i dag?', hint: 'Trykk på en følelse for å bli kjent med den.',
    friend: 'Velg en venn', girl: 'Jente', boy: 'Gutt', language: 'Språk',
    soundOn: 'Lyd på', soundOff: 'Lyd av', surprise: 'Overrask meg',
    back: 'Alle følelser', again: 'Si det igjen', read: 'Les for meg', tryIt: 'Prøv selv:',
    prev: 'Forrige følelse', next: 'Neste følelse', kidFeeling: 'Følelse: {x}',
    record: 'Ta opp stemmen min', stop: 'Stopp', remove: 'Slett stemmen min', hasVoice: 'Har stemmen din',
    confirmRemove: 'Vil du slette opptaket ditt av «{x}»?',
    noMic: 'Denne nettleseren kan ikke ta opp lyd.', micBlocked: 'Mikrofonen er blokkert. Gi nettleseren tilgang for å ta opp.',
    noVoice: 'Denne enheten har ingen norsk stemme. Ta opp din egen stemme!',
    missing: 'Animasjonen mangler. Kjør <code>npm run build</code> og last inn siden på nytt.'
  }
};

var FEELINGS = {
  en: {
    happy:       { label: 'Happy',       say: 'Happy!',       text: 'Happy is a warm, sunny feeling. You might smile, laugh or want to dance.',            tryIt: 'Show me your biggest smile!' },
    sad:         { label: 'Sad',         say: 'Sad.',         text: 'Sad is a heavy, rainy feeling. You might cry, and a hug can help.',                   tryIt: 'Give yourself a big hug.' },
    angry:       { label: 'Angry',       say: 'Angry!',       text: 'Angry is a hot, stompy feeling. Your face gets red and your hands get tight.',        tryIt: 'Squeeze your fists, then let them go floppy.' },
    scared:      { label: 'Scared',      say: 'Scared!',      text: 'Scared is a shaky feeling. Your heart goes fast and you want someone close.',         tryIt: 'Take three slow, deep breaths.' },
    surprised:   { label: 'Surprised',   say: 'Surprised!',   text: 'Surprised is a jumpy feeling when something happens that you did not expect.',        tryIt: 'Open your eyes and mouth really wide!' },
    disgusted:   { label: 'Disgusted',   say: 'Disgusted!',   text: 'Disgusted is the yucky feeling you get from a bad smell or a strange taste.',         tryIt: 'Scrunch up your nose and say “Eww!”' },
    calm:        { label: 'Calm',        say: 'Calm.',        text: 'Calm is a quiet, floaty feeling, like lying on soft grass.',                          tryIt: 'Breathe in slowly, and breathe out slowly.' },
    excited:     { label: 'Excited',     say: 'Excited!',     text: 'Excited is a bouncy, fizzy feeling when something fun is coming.',                    tryIt: 'Jump up and down three times!' },
    tired:       { label: 'Tired',       say: 'Tired.',       text: 'Tired is a sleepy feeling. Your eyes get heavy and you want to rest.',                tryIt: 'Do a big, big yawn.' },
    proud:       { label: 'Proud',       say: 'Proud!',       text: 'Proud is the tall feeling you get when you worked hard and did it.',                  tryIt: 'Stand up tall like a superhero.' },
    embarrassed: { label: 'Embarrassed', say: 'Embarrassed.', text: 'Embarrassed is a hot-cheeks feeling, when you want to hide for a moment.',             tryIt: 'Cover your face, then peek out!' },
    confused:    { label: 'Confused',    say: 'Confused?',    text: 'Confused is a muddled feeling when something does not make sense yet.',               tryIt: 'Tilt your head and say “Hmm?”' },
    jealous:     { label: 'Jealous',     say: 'Jealous.',     text: 'Jealous is a grumbly feeling when you want what someone else has.',                   tryIt: 'Cross your arms and say “Hmph!”' },
    grateful:    { label: 'Grateful',    say: 'Grateful.',    text: 'Grateful is a thank-you feeling, for people and things that make life nice.',         tryIt: 'Say thank you to someone near you.' },
    lonely:      { label: 'Lonely',      say: 'Lonely.',      text: 'Lonely is an empty feeling when you miss having a friend nearby.',                    tryIt: 'Think of a friend you would like to play with.' },
    hopeful:     { label: 'Hopeful',     say: 'Hopeful!',     text: 'Hopeful is a looking-up feeling, when you think something good will happen.',         tryIt: 'Cross your fingers and make a wish.' },
    nervous:     { label: 'Nervous',     say: 'Nervous.',     text: 'Nervous is a wiggly, butterflies-in-your-tummy feeling before something new.',        tryIt: 'Shake your hands out like wet noodles.' },
    bored:       { label: 'Bored',       say: 'Bored.',       text: 'Bored is a slow, nothing-to-do feeling. Time feels very long.',                       tryIt: 'Let out a long sigh: “Hmmmmm.”' },
    curious:     { label: 'Curious',     say: 'Curious?',     text: 'Curious is a wondering feeling, when you want to find out more.',                     tryIt: 'Ask a grown-up a “why” question.' },
    loving:      { label: 'Loving',      say: 'Loving!',      text: 'Loving is a soft, cuddly feeling for the people and pets you care about.',            tryIt: 'Make a heart with your hands.' }
  },
  es: {
    happy:       { label: 'Feliz',         say: '¡Feliz!',         text: 'La alegría es un sentimiento cálido, como el sol. Puedes sonreír, reír o tener ganas de bailar.', tryIt: '¡Muéstrame tu sonrisa más grande!' },
    sad:         { label: 'Triste',        say: 'Triste.',         text: 'La tristeza es un sentimiento pesado, como la lluvia. Puedes llorar, y un abrazo puede ayudar.',  tryIt: 'Date un abrazo muy grande.' },
    angry:       { label: 'Enojad@',       say: '¡Enojad@!',       text: 'El enojo es un sentimiento caliente que dan ganas de patalear. La cara se pone roja y aprietas las manos.', tryIt: 'Aprieta los puños y luego déjalos flojitos.' },
    scared:      { label: 'Asustad@',      say: '¡Asustad@!',      text: 'El miedo es un sentimiento tembloroso. El corazón late rápido y quieres a alguien cerca.',        tryIt: 'Respira lento y profundo tres veces.' },
    surprised:   { label: 'Sorprendid@',   say: '¡Sorprendid@!',   text: 'La sorpresa es un sentimiento de salto, cuando pasa algo que no esperabas.',                       tryIt: '¡Abre mucho los ojos y la boca!' },
    disgusted:   { label: 'Asquead@',      say: '¡Asquead@!',      text: 'El asco es la sensación fea que sientes con un mal olor o un sabor raro.',                         tryIt: 'Arruga la nariz y di «¡Puaj!»' },
    calm:        { label: 'Tranquil@',     say: 'Tranquil@.',      text: 'La calma es un sentimiento suave y quieto, como descansar sobre el pasto.',                        tryIt: 'Respira despacio y suelta el aire despacio.' },
    excited:     { label: 'Emocionad@',    say: '¡Emocionad@!',    text: 'La emoción es un sentimiento saltarín y burbujeante cuando viene algo divertido.',                 tryIt: '¡Salta tres veces!' },
    tired:       { label: 'Cansad@',       say: 'Cansad@.',        text: 'El cansancio es un sentimiento de sueño. Los ojos pesan y quieres descansar.',                     tryIt: 'Haz un bostezo muy, muy grande.' },
    proud:       { label: 'Orgullos@',     say: '¡Orgullos@!',     text: 'El orgullo es lo que sientes cuando te esforzaste mucho y lo lograste.',                           tryIt: 'Párate muy derecho, como un superhéroe.' },
    embarrassed: { label: 'Avergonzad@',   say: 'Avergonzad@.',    text: 'La vergüenza es cuando se te calientan las mejillas y quieres esconderte un ratito.',              tryIt: 'Tápate la cara y luego, ¡asómate!' },
    confused:    { label: 'Confundid@',    say: '¿Confundid@?',    text: 'La confusión es un sentimiento enredado, cuando algo todavía no tiene sentido.',                    tryIt: 'Inclina la cabeza y di «¿Mmm?»' },
    jealous:     { label: 'Celos@',        say: 'Celos@.',         text: 'Los celos son un sentimiento gruñón, cuando quieres lo que tiene otra persona.',                   tryIt: 'Cruza los brazos y di «¡Hmph!»' },
    grateful:    { label: 'Agradecid@',    say: 'Agradecid@.',     text: 'La gratitud es un sentimiento de gracias por las personas y las cosas bonitas de la vida.',        tryIt: 'Dale las gracias a alguien cerca de ti.' },
    lonely:      { label: 'Sol@',          say: 'Sol@.',           text: 'La soledad es un sentimiento vacío, cuando extrañas tener un amigo cerca.',                        tryIt: 'Piensa en un amigo con quien te gustaría jugar.' },
    hopeful:     { label: 'Esperanzad@',   say: '¡Esperanzad@!',   text: 'La esperanza es un sentimiento de mirar hacia arriba, cuando crees que algo bueno va a pasar.',    tryIt: 'Cruza los dedos y pide un deseo.' },
    nervous:     { label: 'Nervios@',      say: 'Nervios@.',       text: 'Los nervios son un sentimiento inquieto, como mariposas en la panza, antes de algo nuevo.',        tryIt: 'Sacude las manos como fideos mojados.' },
    bored:       { label: 'Aburrid@',      say: 'Aburrid@.',       text: 'El aburrimiento es un sentimiento lento, cuando no hay nada que hacer. El tiempo parece muy largo.', tryIt: 'Suelta un suspiro largo: «Mmmmm.»' },
    curious:     { label: 'Curios@',       say: '¿Curios@?',       text: 'La curiosidad es un sentimiento de preguntarse cosas, cuando quieres saber más.',                  tryIt: 'Hazle a un adulto una pregunta de «¿por qué?».' },
    loving:      { label: 'Cariños@',      say: '¡Cariños@!',      text: 'El cariño es un sentimiento suave y tierno por las personas y mascotas que quieres.',              tryIt: 'Haz un corazón con las manos.' }
  },
  nb: {
    happy:       { label: 'Glad',        say: 'Glad!',        text: 'Glad er en varm og solfylt følelse. Du smiler, ler eller får lyst til å danse.',       tryIt: 'Vis meg ditt største smil!' },
    sad:         { label: 'Trist',       say: 'Trist.',       text: 'Trist er en tung følelse, som regnvær. Kanskje du gråter, og en klem kan hjelpe.',     tryIt: 'Gi deg selv en stor klem.' },
    angry:       { label: 'Sint',        say: 'Sint!',        text: 'Sint er en varm følelse som får deg til å trampe. Ansiktet blir rødt og hendene stramme.', tryIt: 'Knyt nevene, og la dem så bli helt slappe.' },
    scared:      { label: 'Redd',        say: 'Redd!',        text: 'Redd er en skjelvende følelse. Hjertet slår fort, og du vil ha noen nær deg.',         tryIt: 'Pust sakte og dypt tre ganger.' },
    surprised:   { label: 'Overrasket',  say: 'Overrasket!',  text: 'Overrasket er en hoppende følelse når det skjer noe du ikke ventet.',                   tryIt: 'Åpne øynene og munnen kjempestort!' },
    disgusted:   { label: 'Avsky',       say: 'Avsky!',       text: 'Avsky er den ekle følelsen du får av vond lukt eller rar smak.',                       tryIt: 'Rynk på nesen og si «Æsj!»' },
    calm:        { label: 'Rolig',       say: 'Rolig.',       text: 'Rolig er en stille og myk følelse, som å ligge i mykt gress.',                         tryIt: 'Pust sakte inn, og pust sakte ut.' },
    excited:     { label: 'Spent',       say: 'Spent!',       text: 'Spent er en sprettende og boblende følelse når noe gøy skal skje.',                    tryIt: 'Hopp opp og ned tre ganger!' },
    tired:       { label: 'Trøtt',       say: 'Trøtt.',       text: 'Trøtt er en søvnig følelse. Øynene blir tunge, og du vil hvile.',                      tryIt: 'Gjesp et stort, stort gjesp.' },
    proud:       { label: 'Stolt',       say: 'Stolt!',       text: 'Stolt er følelsen du får når du har jobbet hardt og klart det.',                       tryIt: 'Stå rett opp og ned som en superhelt.' },
    embarrassed: { label: 'Flau',        say: 'Flau.',        text: 'Flau er en følelse som gjør kinnene varme, og du vil gjemme deg litt.',                tryIt: 'Gjem ansiktet, og så: tittei!' },
    confused:    { label: 'Forvirret',   say: 'Forvirret?',   text: 'Forvirret er en rotete følelse når noe ikke gir mening ennå.',                         tryIt: 'Legg hodet på skrå og si «Hmm?»' },
    jealous:     { label: 'Sjalu',       say: 'Sjalu.',       text: 'Sjalu er en grinete følelse når du vil ha det noen andre har.',                        tryIt: 'Kryss armene og si «Hmpf!»' },
    grateful:    { label: 'Takknemlig',  say: 'Takknemlig.',  text: 'Takknemlig er en takke-følelse for folk og ting som gjør livet fint.',                  tryIt: 'Si takk til noen i nærheten.' },
    lonely:      { label: 'Ensom',       say: 'Ensom.',       text: 'Ensom er en tom følelse når du savner å ha en venn i nærheten.',                       tryIt: 'Tenk på en venn du har lyst til å leke med.' },
    hopeful:     { label: 'Håpefull',    say: 'Håpefull!',    text: 'Håpefull er en følelse av å se opp, når du tror at noe bra skal skje.',                tryIt: 'Kryss fingrene og ønsk deg noe.' },
    nervous:     { label: 'Nervøs',      say: 'Nervøs.',      text: 'Nervøs er en urolig følelse, som sommerfugler i magen, før noe nytt.',                 tryIt: 'Rist hendene som våte spagetti.' },
    bored:       { label: 'Kjeder seg',  say: 'Kjeder seg.',  text: 'Å kjede seg er en treg følelse når du ikke har noe å gjøre. Tiden føles veldig lang.', tryIt: 'Pust ut et langt sukk: «Hmmmm.»' },
    curious:     { label: 'Nysgjerrig',  say: 'Nysgjerrig?',  text: 'Nysgjerrig er en følelse av å lure på ting, når du vil finne ut mer.',                 tryIt: 'Spør en voksen et «hvorfor»-spørsmål.' },
    loving:      { label: 'Kjærlig',     say: 'Kjærlig!',     text: 'Kjærlig er en myk og god følelse for folk og dyr du er glad i.',                       tryIt: 'Lag et hjerte med hendene.' }
  }
};
