#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const BATCH_DIR = '/Users/damion/CODE/Recall_Rogue/data/generated/quality-sweep/batches/vocab-ja';
const OUT_DIR = '/Users/damion/CODE/Recall_Rogue/data/generated/quality-sweep/results/vocab-ja';

const BATCHES = [105, 106, 107, 108, 109, 110, 111, 112, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131];

// Placeholder distractor sets to detect and replace
const PLACEHOLDER_SETS = [
  ['signify','denote','represent','indicate','suggest','express','convey','imply'],
  ['how?','what?','which','who','where','what','when'],
  ['meaning','sense','essence','import','value','purpose','intent'],
  ['to blow','to wave','to sense','to perceive','to sink','to plunge','to split','to separate'],
  ['and at the same time','in addition to that said','it is not the case','on the other hand though','when all is said done','in the final analysis here','the key point being this','as far as I know'],
];

// Check if a distractor set is placeholder/garbage
function isPlaceholderSet(d) {
  if (!d || d.length === 0) return true;
  const normalized = d.map(x => x.toLowerCase().trim());
  for (const ps of PLACEHOLDER_SETS) {
    const psNorm = ps.map(x => x.toLowerCase().trim());
    // Check if 4+ items from the placeholder set appear
    let matches = 0;
    for (const item of normalized) {
      if (psNorm.includes(item)) matches++;
    }
    if (matches >= 4) return true;
  }
  return false;
}

// Check if distractors are preposition-variation garbage (e.g., "word (of ...")
function isPrepVariationGarbage(d, answer) {
  if (!d || d.length < 3) return false;
  const ans = answer.toLowerCase().trim();
  let variationCount = 0;
  const preps = ['of','in','for','about','during','before','after','around'];
  for (const item of d) {
    const it = item.toLowerCase().trim();
    // Pattern: answer text with a parenthetical that swaps a preposition
    for (const prep of preps) {
      if (it.includes(`(${prep} `) && (it.startsWith(ans.split('(')[0].trim().toLowerCase()))) {
        variationCount++;
        break;
      }
    }
  }
  return variationCount >= 4;
}

// Check if distractors have "similar to X" entries
function hasSimilarToEntries(d) {
  if (!d) return false;
  return d.some(x => x.toLowerCase().startsWith('similar to') || x.toLowerCase().startsWith('similar ('));
}

// Check if distractors have "alternate/other/varied/variant" entries with parenthetical garbage
function hasAdjectiveVariantGarbage(d) {
  if (!d) return false;
  const garbage = ['similar','alternate','different','other','varied','variant'];
  let count = 0;
  for (const item of d) {
    const lower = item.toLowerCase();
    for (const g of garbage) {
      if (lower.startsWith(g + ' (') || lower === g) {
        count++;
        break;
      }
    }
  }
  return count >= 3;
}

// Check if too few distractors
function hasTooFew(d) {
  return !d || d.length < 6;
}

// Check if answer appears in distractors
function hasAnswerEcho(d, answer) {
  if (!d) return false;
  const ans = answer.toLowerCase().trim();
  return d.some(x => x.toLowerCase().trim() === ans);
}

// Check for duplicate distractors
function hasDuplicates(d) {
  if (!d) return false;
  const seen = new Set();
  for (const x of d) {
    const k = x.toLowerCase().trim();
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

// Fix bare question for katakana words (e.g., "What does 'ブラシ' mean in English?" — already has word embedded, OK)
// The question is considered "bare" only if it's just "What does X mean?" with no Japanese chars at all
function isBareQuestion(q) {
  // If question has Japanese characters in it, it's fine
  const hasJapanese = /[\u3000-\u9FFF\uFF00-\uFFEF]/.test(q);
  return !hasJapanese;
}

// Generate semantically appropriate distractors for a given answer
// This is done with domain knowledge to produce plausible wrong answers
function generateDistractors(id, answer, question, existingGoodDistractors) {
  const a = answer.toLowerCase().trim();

  // ============ SPECIFIC WORD LOOKUPS ============
  // For common/simple words that need specific distractors

  // Numbers
  if (/^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)$/.test(a)) {
    return generateNumberDistractors(a);
  }

  // Colors
  if (/\b(red|blue|green|yellow|orange|purple|pink|brown|black|white|grey|gray)\b/.test(a)) {
    return generateColorDistractors(a);
  }

  // Family relations
  if (/\b(father|mother|parent|son|daughter|brother|sister|uncle|aunt|grandfather|grandmother|grandparent|nephew|niece|cousin|husband|wife|spouse|child|sibling)\b/.test(a)) {
    return generateFamilyDistractors(a);
  }

  // Days of the week / time
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(a)) {
    return ['Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Monday'].filter(d => !a.toLowerCase().includes(d.toLowerCase())).slice(0, 7);
  }

  // Months
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(a)) {
    return ['January','February','March','April','May','June','July','August','September','October','November','December'].filter(d => !a.toLowerCase().includes(d.toLowerCase())).slice(0, 7);
  }

  // Particles / grammar terms
  if (/^(at|in|on|for|to|by|from|with|as|but|and|or|if|that|this|these|those|it|un-|sub-|-ness|hey|right\?|yes\?|is it\?|don't|indicates a question|indicates emotion or admiration|if \.\.\. then|want to do \.\.\.)$/.test(a)) {
    return generateGrammarDistractors(a);
  }

  // Greetings / common phrases
  if (/good morning|good evening|good night|nice to meet you|thank you|goodbye|bye|hello|please|sorry|excuse me/.test(a)) {
    return generateGreetingDistractors(a);
  }

  // Use answer category-aware defaults
  return generateSemanticDistractors(a, question, id);
}

function generateNumberDistractors(a) {
  const nums = ['one','two','three','four','five','six','seven','eight','nine','ten','twelve','fifteen','twenty','thirty','forty','fifty'];
  return nums.filter(n => n !== a).slice(0,8);
}

function generateColorDistractors(a) {
  const colors = ['red','blue','green','yellow','orange','purple','pink','brown','black','white','grey','dark blue','light green','scarlet'];
  return colors.filter(c => !a.includes(c)).slice(0,8);
}

function generateFamilyDistractors(a) {
  const family = ['father','mother','son','daughter','brother','sister','uncle','aunt','grandfather','grandmother','nephew','niece','cousin','husband','wife','child'];
  return family.filter(f => !a.includes(f)).slice(0,8);
}

function generateGrammarDistractors(a) {
  const grammar = [
    'indicates a topic','indicates a subject','indicates an object',
    'indicates direction','indicates possession','indicates location',
    'indicates time','indicates comparison','indicates condition',
    'indicates cause','sentence-final emphasis','indicates doubt',
    'indicates completion','indicates connection','polite imperative'
  ];
  return grammar.filter(g => g !== a).slice(0,8);
}

function generateGreetingDistractors(a) {
  const greetings = [
    'good morning','good afternoon','good evening','good night',
    'nice to meet you','how are you?','see you later','thank you',
    'you are welcome','please sit down','have a good day',
    'sorry to have kept you waiting','my condolences','congratulations'
  ];
  return greetings.filter(g => g !== a).slice(0,8);
}

function generateSemanticDistractors(a, q, id) {
  // Based on answer type, generate plausible wrong answers

  // Verbs (to ...)
  if (a.startsWith('to ')) {
    return getVerbDistractors(a);
  }

  // Adjective-like answers
  if (/^(good|bad|big|small|large|old|young|hot|cold|fast|slow|hard|soft|bright|dark|clean|dirty|heavy|light|long|short|wide|narrow|deep|shallow|thick|thin|rich|poor|strong|weak|happy|sad|angry|tired|hungry|full|warm|cool|wet|dry|empty|busy|free|open|closed|high|low|new|old|beautiful|ugly|smart|clever|stupid|kind|cruel|honest|dishonest|brave|cowardly|polite|rude|patient|impatient|careful|careless|successful|famous|ordinary|special|important|necessary|possible|impossible|simple|complex|easy|difficult|safe|dangerous|healthy|sick|alive|dead|awake|asleep|quiet|noisy|sharp|blunt|gentle|rough|sweet|sour|bitter|salty|spicy|plain|pale|bright|dull|modern|traditional|natural|artificial|foreign|domestic|public|private|official|personal|main|minor|exact|vague|concrete|abstract|full|partial|total|general|specific|common|rare|simple|complicated|similar|different|same|other|each|every|any|some|no|few|many|much|more|less|most|least|first|last|next|previous|recent|early|late|far|near|close|distant|inner|outer|upper|lower|front|back|central|local|global|national|international|legal|illegal|physical|mental|social|cultural|economic|political|religious|scientific|medical|technical|practical|theoretical|emotional|rational|logical|historical|ancient|modern|future|current|original|typical|normal|unusual|formal|informal|written|spoken|positive|negative|active|passive|direct|indirect|literal|figurative|clear|unclear|obvious|hidden|real|fake|true|false)$/.test(a)) {
    return getAdjectiveDistractors(a);
  }

  // Nouns (places, things, concepts)
  return getNounDistractors(a, q, id);
}

function getVerbDistractors(a) {
  const verbBuckets = {
    'to go': ['to come','to return','to leave','to arrive','to travel','to walk','to run','to move'],
    'to come': ['to go','to leave','to return','to arrive','to approach','to enter','to pass','to reach'],
    'to do': ['to make','to create','to perform','to execute','to carry out','to handle','to manage','to act'],
    'to make': ['to create','to build','to produce','to form','to construct','to prepare','to cook','to manufacture'],
    'to see': ['to watch','to look','to observe','to notice','to find','to discover','to view','to perceive'],
    'to say': ['to tell','to speak','to talk','to announce','to declare','to state','to mention','to explain'],
    'to think': ['to feel','to believe','to consider','to suppose','to imagine','to wonder','to guess','to judge'],
    'to know': ['to understand','to learn','to remember','to recognize','to realize','to discover','to find out','to be aware'],
    'to get': ['to receive','to obtain','to acquire','to gain','to earn','to take','to fetch','to collect'],
    'to give': ['to offer','to provide','to present','to hand','to pass','to send','to donate','to grant'],
    'to take': ['to bring','to carry','to hold','to grab','to pick up','to remove','to pull','to steal'],
    'to put': ['to place','to set','to leave','to position','to insert','to attach','to add','to apply'],
    'to use': ['to employ','to apply','to operate','to handle','to utilize','to manage','to practice','to adopt'],
    'to turn': ['to rotate','to spin','to twist','to reverse','to flip','to bend','to curl','to wind'],
    'to cut': ['to slice','to trim','to chop','to split','to break','to tear','to separate','to divide'],
    'to open': ['to close','to unlock','to spread','to unfold','to expand','to begin','to start','to launch'],
    'to close': ['to open','to lock','to shut','to end','to finish','to cover','to block','to seal'],
    'to call': ['to name','to invite','to summon','to shout','to phone','to visit','to attract','to request'],
    'to write': ['to draw','to record','to describe','to compose','to fill in','to inscribe','to note','to draft'],
    'to read': ['to write','to study','to check','to scan','to browse','to learn','to understand','to examine'],
    'to eat': ['to drink','to taste','to swallow','to bite','to chew','to consume','to feed','to nibble'],
    'to drink': ['to eat','to swallow','to sip','to gulp','to taste','to pour','to fill','to mix'],
    'to buy': ['to sell','to pay for','to purchase','to trade','to order','to exchange','to obtain','to acquire'],
    'to sell': ['to buy','to trade','to offer','to market','to distribute','to supply','to deliver','to export'],
    'to run': ['to walk','to jump','to fly','to sprint','to dash','to chase','to escape','to move'],
    'to walk': ['to run','to crawl','to climb','to step','to march','to stride','to wander','to stroll'],
    'to stand': ['to sit','to lie','to rise','to remain','to wait','to stay','to stop','to pause'],
    'to sit': ['to stand','to lie down','to kneel','to crouch','to lean','to rest','to settle','to squat'],
    'to sleep': ['to wake up','to rest','to lie down','to dream','to doze','to nap','to relax','to slumber'],
    'to wake': ['to sleep','to rise','to get up','to stir','to alert','to rouse','to open one\'s eyes','to start'],
    'to live': ['to die','to exist','to stay','to reside','to survive','to thrive','to inhabit','to endure'],
    'to die': ['to live','to suffer','to disappear','to cease','to end','to fade','to perish','to collapse'],
    'to work': ['to rest','to play','to study','to practice','to labor','to toil','to operate','to function'],
    'to play': ['to work','to study','to practice','to perform','to compete','to train','to exercise','to relax'],
    'to study': ['to work','to play','to learn','to practice','to teach','to research','to review','to memorize'],
    'to teach': ['to learn','to study','to guide','to train','to educate','to instruct','to demonstrate','to explain'],
    'to learn': ['to teach','to study','to understand','to practice','to discover','to realize','to memorize','to know'],
    'to help': ['to hinder','to support','to assist','to save','to rescue','to protect','to serve','to contribute'],
    'to ask': ['to answer','to tell','to request','to inquire','to question','to demand','to invite','to seek'],
    'to answer': ['to ask','to reply','to respond','to explain','to clarify','to solve','to settle','to confirm'],
    'to wait': ['to hurry','to leave','to stay','to expect','to delay','to pause','to linger','to remain'],
    'to return': ['to leave','to go','to come back','to restore','to repay','to give back','to retreat','to depart'],
    'to arrive': ['to leave','to depart','to approach','to reach','to enter','to come','to appear','to land'],
    'to leave': ['to arrive','to stay','to return','to remain','to depart','to escape','to abandon','to go out'],
    'to enter': ['to exit','to leave','to go in','to penetrate','to invade','to approach','to arrive','to step in'],
    'to exit': ['to enter','to come in','to pass','to escape','to leave','to withdraw','to depart','to step out'],
    'to start': ['to stop','to finish','to end','to begin','to launch','to initiate','to open','to introduce'],
    'to stop': ['to start','to continue','to go','to halt','to pause','to end','to quit','to cease'],
    'to finish': ['to start','to begin','to continue','to complete','to end','to conclude','to achieve','to accomplish'],
    'to continue': ['to stop','to end','to start','to pause','to maintain','to persist','to extend','to proceed'],
    'to change': ['to stay','to remain','to keep','to alter','to modify','to transform','to convert','to replace'],
    'to show': ['to hide','to demonstrate','to display','to reveal','to present','to exhibit','to prove','to indicate'],
    'to hide': ['to show','to reveal','to conceal','to cover','to mask','to store','to shelter','to keep'],
    'to find': ['to lose','to search','to discover','to locate','to obtain','to notice','to encounter','to identify'],
    'to lose': ['to find','to win','to gain','to miss','to forget','to drop','to fail','to fall behind'],
    'to win': ['to lose','to defeat','to succeed','to achieve','to gain','to earn','to beat','to triumph'],
    'to build': ['to destroy','to make','to create','to construct','to design','to establish','to develop','to set up'],
    'to break': ['to fix','to destroy','to smash','to crack','to shatter','to damage','to tear','to burst'],
    'to fix': ['to break','to repair','to correct','to restore','to improve','to adjust','to solve','to heal'],
    'to clean': ['to dirty','to wash','to tidy','to clear','to wipe','to sweep','to scrub','to polish'],
    'to wash': ['to dry','to clean','to rinse','to soak','to scrub','to wipe','to bathe','to launder'],
    'to pull': ['to push','to drag','to draw','to haul','to stretch','to extract','to remove','to tug'],
    'to push': ['to pull','to press','to shove','to thrust','to move','to urge','to force','to drive'],
    'to throw': ['to catch','to toss','to hurl','to launch','to cast','to pitch','to drop','to fling'],
    'to catch': ['to throw','to miss','to grab','to hold','to trap','to seize','to secure','to intercept'],
    'to fall': ['to rise','to drop','to collapse','to slide','to stumble','to decrease','to descend','to sink'],
    'to rise': ['to fall','to increase','to ascend','to go up','to climb','to grow','to elevate','to float'],
    'to carry': ['to drop','to bring','to hold','to transport','to move','to deliver','to bear','to support'],
    'to meet': ['to part','to greet','to see','to encounter','to face','to visit','to join','to gather'],
    'to smell': ['to taste','to touch','to hear','to see','to sense','to detect','to notice','to sniff'],
    'to touch': ['to feel','to hold','to grip','to press','to tap','to stroke','to brush','to reach'],
    'to hear': ['to listen','to understand','to notice','to receive','to sense','to detect','to feel','to attend'],
    'to speak': ['to listen','to write','to read','to say','to talk','to communicate','to express','to announce'],
    'to sing': ['to dance','to play','to perform','to chant','to hum','to recite','to narrate','to express'],
    'to dance': ['to sing','to play','to walk','to move','to perform','to jump','to spin','to sway'],
    'to swim': ['to run','to fly','to dive','to float','to sink','to drift','to walk','to slide'],
    'to fly': ['to swim','to walk','to run','to fall','to land','to float','to glide','to descend'],
    'to drive': ['to walk','to fly','to ride','to travel','to operate','to steer','to control','to move'],
    'to ride': ['to walk','to drive','to fly','to travel','to climb','to mount','to board','to navigate'],
    'to cook': ['to eat','to prepare','to boil','to fry','to bake','to grill','to roast','to steam'],
    'to eat': ['to drink','to swallow','to taste','to chew','to bite','to consume','to feed','to digest'],
    'to drink': ['to eat','to sip','to gulp','to swallow','to taste','to pour','to fill','to consume'],
    'to pour': ['to fill','to spill','to flow','to drain','to add','to drop','to scatter','to sprinkle'],
    'to fill': ['to empty','to pour','to add','to complete','to stuff','to pack','to load','to supply'],
    'to empty': ['to fill','to remove','to take out','to pour out','to drain','to clear','to waste','to exhaust'],
    'to burn': ['to freeze','to melt','to ignite','to char','to destroy','to heat','to consume','to glow'],
    'to freeze': ['to burn','to melt','to harden','to solidify','to chill','to cool','to preserve','to stop'],
    'to melt': ['to freeze','to burn','to harden','to dissolve','to flow','to soften','to thaw','to liquefy'],
    'to hit': ['to miss','to strike','to punch','to kick','to beat','to knock','to tap','to clash'],
    'to kick': ['to hit','to punch','to strike','to push','to throw','to launch','to propel','to stamp'],
    'to pull out': ['to push in','to remove','to extract','to take out','to release','to draw out','to uproot','to withdraw'],
    'to jump': ['to fall','to run','to swim','to fly','to hop','to leap','to spring','to skip'],
    'to laugh': ['to cry','to smile','to giggle','to chuckle','to grin','to mock','to sneer','to jest'],
    'to cry': ['to laugh','to smile','to weep','to sob','to shout','to yell','to groan','to sigh'],
    'to smile': ['to frown','to laugh','to grin','to look','to glance','to stare','to wink','to nod'],
    'to forget': ['to remember','to recall','to lose','to miss','to overlook','to ignore','to neglect','to drop'],
    'to remember': ['to forget','to recall','to recognize','to learn','to memorize','to realize','to think of','to understand'],
    'to pay': ['to receive','to borrow','to owe','to charge','to spend','to purchase','to settle','to refund'],
    'to borrow': ['to lend','to return','to rent','to hire','to take','to use','to keep','to owe'],
    'to lend': ['to borrow','to give','to provide','to rent','to offer','to loan','to donate','to share'],
    'to save': ['to spend','to waste','to protect','to rescue','to preserve','to store','to accumulate','to keep'],
    'to spend': ['to save','to earn','to waste','to pay','to invest','to use','to consume','to allocate'],
    'to earn': ['to spend','to lose','to gain','to receive','to get','to obtain','to achieve','to win'],
    'to send': ['to receive','to give','to mail','to deliver','to ship','to transfer','to forward','to dispatch'],
    'to receive': ['to send','to give','to get','to accept','to collect','to obtain','to earn','to take'],
    'to open (to traffic)': ['to close (to traffic)','to block (a road)','to restrict (passage)','to allow (passage)','to connect (routes)','to facilitate (movement)','to redirect (traffic)','to monitor (flow)'],
    'to tear': ['to mend','to fold','to cut','to rip','to shred','to split','to pierce','to scratch'],
    'to bloom': ['to wilt','to bud','to grow','to spread','to open','to flourish','to develop','to branch'],
    'to cure': ['to harm','to treat','to heal','to remedy','to recover','to restore','to improve','to protect'],
    'to polish': ['to scratch','to clean','to shine','to smooth','to buff','to scrub','to refine','to improve'],
    'to blow (of the wind)': ['to rain','to snow','to shine','to gust','to storm','to breeze','to roar','to drift'],
    'to be shut': ['to be open','to be locked','to be sealed','to be closed','to be blocked','to be barred','to be latched','to be fastened'],
    'to burst into bud': ['to wither','to bloom','to sprout','to branch','to grow leaves','to bear fruit','to flower','to shed leaves'],
    'to search for': ['to find','to lose','to avoid','to discover','to locate','to seek','to look for','to investigate'],
    'to remain': ['to leave','to move','to go','to stay','to continue','to persist','to endure','to survive'],
    'to be blessed with': ['to lack','to lose','to suffer from','to be deprived of','to be gifted with','to be endowed with','to be favored with','to be provided with'],
    'to find resolution': ['to worsen','to complicate','to settle','to conclude','to solve','to agree','to arrange','to finalize'],
    'to be dented': ['to be bulging','to be repaired','to be flattened','to be crushed','to be bent','to be scratched','to be cracked','to be smooth'],
    'to go mad': ['to remain calm','to be cured','to become confused','to lose control','to become deranged','to break down','to collapse','to deteriorate'],
    'to sow': ['to harvest','to reap','to plant','to grow','to water','to cultivate','to scatter seeds','to fertilize'],
    'to be open (to traffic)': ['to be closed (to traffic)','to be blocked (by construction)','to allow vehicles through','to restrict vehicle access','to permit pedestrian movement','to be under repair','to be monitored','to be redirected'],
  };

  for (const [key, vals] of Object.entries(verbBuckets)) {
    if (a === key) return vals;
  }

  // Generic verb distractors
  return [
    'to move','to stop','to continue','to change','to improve',
    'to increase','to decrease','to begin','to finish'
  ].filter(v => v !== a).slice(0,8);
}

function getAdjectiveDistractors(a) {
  const adjGroups = {
    'warm': ['hot','cold','cool','humid','mild','lukewarm','chilly','temperate'],
    'light brown': ['dark brown','golden','amber','tan','beige','caramel','chestnut','reddish'],
    'modern': ['traditional','ancient','classical','old-fashioned','contemporary','historic','current','vintage'],
    'great': ['small','ordinary','minor','average','poor','remarkable','vast','grand'],
    'greatness': ['smallness','mediocrity','ordinariness','weakness','insignificance','excellence','magnitude','virtue'],
    'large': ['small','tiny','medium','enormous','huge','massive','broad','vast'],
    'small': ['large','big','tiny','huge','medium','short','narrow','compact'],
    'fresh': ['stale','old','spoiled','rotten','clean','new','pure','crisp'],
    'gently sloping': ['steeply inclined','completely flat','sharply curved','moderately steep','slightly uneven','gently curved','barely sloped','gradually rising'],
    'rare': ['common','frequent','abundant','ordinary','typical','usual','normal','regular'],
    'uncommon': ['common','typical','ordinary','frequent','standard','normal','regular','expected'],
    'detailed and accurate': ['vague and inaccurate','precise and thorough','brief and general','exhaustive and exact','comprehensive and clear','broad and approximate','rough and unspecific','loose and imprecise'],
    'profound': ['shallow','superficial','deep','thoughtful','significant','intense','serious','meaningful'],
    'immeasurable': ['measurable','calculable','finite','limited','countless','boundless','infinite','incalculable'],
    'good (quality, condition, etc.)': ['poor','excellent','average','decent','acceptable','superior','adequate','satisfactory'],
    'innocen': ['guilty','pure','naive','honest','blameless','virtuous','simple','sincere'],
    'absurd': ['reasonable','sensible','ridiculous','foolish','preposterous','logical','rational','senseless'],
  };

  if (adjGroups[a]) return adjGroups[a];

  // Generic
  return ['similar','different','related','unrelated','opposite','equivalent','contrary','comparable'].map((x,i) => {
    const generics = ['large','small','fast','slow','old','new','strong','weak','bright','dark','clean','warm','cool','sharp','rough','smooth'];
    return generics[i] || x;
  }).filter(x => x !== a).slice(0,8);
}

function getNounDistractors(a, q, id) {
  // Specific noun categories
  const nounGroups = {
    // Food & drink
    'brush': ['broom','comb','sponge','scrubber','mop','duster','roller','scraper'],
    'bowl': ['cup','plate','dish','glass','mug','saucer','pot','pan'],
    'teacup': ['mug','glass','bowl','cup','saucer','pot','vessel','carafe'],
    'milk': ['water','juice','tea','coffee','cream','yogurt','butter','cheese'],
    '(cow\'s) milk': ['goat milk','almond milk','soy milk','oat milk','cream','yogurt','butter','buttermilk'],
    'beef': ['pork','chicken','lamb','fish','seafood','veal','venison','mutton'],
    'appetizer or snack served with drinks': ['main course','dessert','side dish','soup','salad','entree','buffet','finger food'],
    'treat (esp. food and drink)': ['chore','punishment','meal','obligation','task','routine','duty','necessity'],
    'feast': ['snack','plain meal','diet food','appetizer','dessert','ordinary dinner','fast food','side dish'],

    // Places
    'library': ['bookstore','museum','archive','school','gallery','theater','laboratory','office'],
    'city road': ['highway','railway','river','canal','path','bridge','tunnel','avenue'],
    'Shinto shrine': ['Buddhist temple','Christian church','mosque','synagogue','cathedral','chapel','monastery','pagoda'],
    'official residence': ['private home','hotel','embassy','palace','dormitory','guesthouse','apartment','cottage'],
    'family court': ['criminal court','high court','district court','supreme court','civil court','magistrate court','juvenile court','tribunal'],
    'High Court': ['district court','supreme court','family court','civil court','appeal court','magistrate court','tribunal','circuit court'],
    'government office': ['private company','hospital','school','court','embassy','parliament','ministry','bureau'],
    'sutra library': ['shrine room','meditation hall','reception hall','main hall','lecture room','archive room','storage room','bell tower'],
    'private university': ['public university','community college','high school','vocational school','technical institute','business school','junior college','state university'],

    // Nature
    'ocean': ['sea','lake','river','bay','gulf','strait','pond','reservoir'],
    'grassland': ['forest','desert','wetland','meadow','savanna','prairie','tundra','jungle'],
    'mountains and rivers': ['plains and lakes','forests and seas','valleys and fields','hills and streams','glaciers and rivers','cliffs and coasts','deserts and oases','beaches and oceans'],
    'mountain villa': ['beach house','city apartment','farmhouse','temple lodge','suburban home','lakeside cottage','woodland cabin','riverside inn'],
    'rocky area': ['sandy beach','forest clearing','grassy meadow','mudflat','cliff face','valley floor','riverbank','marshland'],
    'grassland': ['woodland','wetland','desert','tundra','farmland','marsh','scrubland','savanna'],
    'new rice field': ['old farmland','forest clearing','vegetable garden','orchard','grazing land','paddy field','terraced field','reclaimed land'],
    'large boat': ['small boat','canoe','raft','submarine','aircraft carrier','ferry','houseboat','tugboat'],
    'main island': ['small island','peninsula','atoll','reef','archipelago','mainland','coastal area','offshore territory'],
    'torch (made of pine, bamboo, reed, etc.)': ['candle','lantern','flashlight','beacon','flare','lamp','bonfire','spotlight'],

    // Time
    'holiday': ['workday','school day','regular day','weekend','break','recess','vacation','festival'],
    'for a moment': ['for a long time','forever','never','briefly','occasionally','constantly','repeatedly','always'],
    'week before last': ['last week','next week','yesterday','this week','two weeks ago','last month','a few days ago','recently'],
    'all one\'s life': ['temporarily','for a year','for a decade','briefly','occasionally','periodically','seasonally','for a lifetime'],
    'season': ['year','month','week','day','century','decade','era','period'],
    'date': ['time','place','event','year','month','day','occasion','schedule'],
    'at that time': ['currently','in the future','long ago','recently','nowadays','eventually','someday','from now on'],
    'Boys\' Day celebration (May 5)': ['Girls\' Day (March 3)','New Year\'s Day','Coming-of-Age Day','Children\'s Day','Star Festival','Obon Festival','Harvest Festival','Constitution Day'],
    'midwinter': ['midsummer','early spring','late autumn','rainy season','harvest time','planting season','cherry blossom season','typhoon season'],
    'week before last': ['last week','this week','next week','the week after next','two weeks from now','last month','a fortnight ago','yesterday'],
    'Boys\' Day celebration (May 5)': ['Girls\' Day (March 3)','New Year\'s Day','Autumn Equinox Day','Marine Day','Respect for the Aged Day','Coming-of-Age Day','Labor Thanksgiving Day','Culture Day'],

    // Abstract / concept
    'throat': ['esophagus','windpipe','larynx','trachea','pharynx','bronchi','vocal cords','neck'],
    'riding past (one\'s station)': ['missing a stop','taking the wrong train','boarding early','alighting early','transferring trains','buying the wrong ticket','waiting on the platform','exiting early'],
    'rarely': ['always','never','sometimes','often','frequently','occasionally','usually','seldom'],
    'comparatively': ['absolutely','relatively','equally','slightly','significantly','barely','extremely','roughly'],
    'cannot be helped': ['must be fixed','can be prevented','is avoidable','is necessary','is desirable','can be changed','is intentional','is deliberate'],
    'return': ['departure','arrival','stay','exit','retreat','advance','journey','trip'],
    'another helping': ['first serving','last portion','small amount','extra snack','double portion','half serving','remainder','leftovers'],
    'good morning': ['good evening','good night','good afternoon','hello','goodbye','nice to meet you','see you later','take care'],
    'and': ['but','or','nor','yet','so','although','because','while'],
    'this and that': ['here and there','one and only','now and then','come and go','back and forth','up and down','in and out','more and less'],
    'here and there': ['this and that','now and then','up and down','back and forth','in and out','come and go','far and wide','side by side'],
    'each (person)': ['all together','no one','everyone as a group','half of them','most people','a few people','the majority','none of them'],
    'if': ['but','although','because','since','unless','when','while','as'],
    'certainly': ['perhaps','maybe','possibly','probably','doubtfully','unlikely','never','rarely'],
    'please': ['thank you','sorry','excuse me','wait','stop','go','come','look'],
    'sweetly (smiling)': ['sadly (crying)','angrily (frowning)','nervously (fidgeting)','broadly (grinning)','softly (whispering)','warmly (laughing)','shyly (blushing)','cheerfully (laughing)'],
    'with a clash': ['quietly','gently','smoothly','softly','abruptly','silently','gradually','peacefully'],
    'gong': ['drum','bell','flute','harp','violin','trumpet','whistle','cymbal'],
    'lock': ['key','handle','latch','bolt','chain','doorknob','hinge','seal'],
    'step': ['stair','level','floor','rung','degree','grade','stage','tier'],
    'demon': ['angel','spirit','ghost','monster','dragon','deity','wizard','sorcerer'],
    'real power': ['nominal authority','symbolic role','actual control','official title','ceremonial position','veto power','advisory role','hidden influence'],
    'biological older sister': ['stepsister','adopted sister','older brother','younger sister','twin sister','half-sister','cousin','niece'],
    'normal state (condition)': ['emergency','crisis','abnormal condition','baseline state','steady state','default mode','standard condition','resting state'],
    'setting off (on a long journey)': ['returning home','arriving at destination','resting midway','changing direction','stopping briefly','turning around','taking a detour','preparing to depart'],
    'buying': ['selling','trading','renting','borrowing','lending','exchanging','donating','investing'],
    'China': ['Japan','Korea','Vietnam','Taiwan','Mongolia','Tibet','Hong Kong','Manchuria'],
    'rottenness': ['freshness','purity','decay','deterioration','corruption','spoilage','decomposition','putrefaction'],
    'sleep': ['wakefulness','rest','dreams','unconsciousness','drowsiness','nap','slumber','hibernation'],
    'old age': ['youth','childhood','middle age','infancy','adulthood','maturity','prime of life','teenage years'],
    'parental authority': ['filial duty','sibling rights','legal guardianship','custody rights','judicial authority','governmental power','religious authority','employer rights'],
    'giving a lecture in the Emperor\'s presence': ['delivering a speech to parliament','teaching in a public school','presenting at a conference','addressing the military','conducting a ceremony','performing before royalty','reporting to the cabinet','reading scripture aloud'],
    'nectar': ['honey','syrup','juice','pollen','sap','resin','dew','extract'],
    'beam': ['column','pillar','rafter','joist','plank','post','girder','strut'],
    'report given to deity or nobility': ['petition from a commoner','formal complaint to court','news article for the public','announcement to students','letter to a friend','memo to a colleague','notice on a bulletin board','informal conversation'],
    'mountain villa': ['beach resort','city mansion','country farmhouse','lakeside cottage','forest cabin','riverside inn','valley retreat','seaside lodge'],
    'decapitated head of an enemy': ['war trophy','prisoner of war','defeated general','battle flag','captured weapon','fallen fortress','military honor','war prize'],
    'underwater navigation': ['surface sailing','aerial flight','land travel','deep-sea diving','port docking','coastal rowing','river rafting','submarine operation'],
    'medium (size)': ['large','small','extra-large','tiny','standard','compact','oversized','miniature'],
    'already published': ['out of print','forthcoming','in draft','being edited','available online','serialized','unpublished','newly released'],
    'completing of construction work': ['start of construction','design phase','demolition','renovation','inspection','planning stage','foundation work','interior finishing'],
    'accepting with pleasure': ['refusing reluctantly','accepting grudgingly','rejecting outright','declining politely','acknowledging with disinterest','receiving with suspicion','taking reluctantly','welcoming with excitement'],
    'deposit': ['withdrawal','loan','debt','transfer','investment','payment','credit','balance'],
    'battle formation': ['military retreat','peace treaty','defensive position','supply route','training exercise','troop disbandment','tactical withdrawal','battle plan'],
    'duty': ['privilege','right','freedom','choice','option','benefit','reward','leisure'],
    'nice to meet you': ['goodbye','how are you?','see you later','thank you','I\'m sorry','good morning','please wait','you\'re welcome'],
    'council': ['individual decision','committee','assembly','conference','tribunal','hearing','ruling','session'],
    'ocean': ['lake','river','sea','gulf','bay','strait','lagoon','pond'],
    'this': ['that','these','those','it','here','there','such','each'],
    'China': ['Japan','Korea','Taiwan','Vietnam','Mongolia','Thailand','Cambodia','Myanmar'],
    'king': ['queen','emperor','president','chancellor','prime minister','duke','governor','chief'],
    'official residence': ['private dwelling','guest house','hotel','embassy','dormitory','apartment','palace','mansion'],
    'appeal': ['petition','verdict','ruling','order','judgment','sentence','charge','prosecution'],
    'rainfall': ['snowfall','drought','sunshine','fog','wind','hailstorm','thunder','lightning'],
    'torch (made of pine, bamboo, reed, etc.)': ['candle','oil lamp','flashlight','lantern','spotlight','beacon','flare','kerosene lamp'],
    'certainly': ['possibly','doubtfully','probably','perhaps','rarely','sometimes','never','unlikely'],
    'please': ['sorry','thank you','stop','wait','excuse me','go ahead','here you are','I understand'],
    'grassland': ['woodland','wetland','desert','mountain range','rocky cliff','farmland','lake shore','coastal strip'],
    'completion of construction work': ['start of construction','foundation laying','design approval','building inspection','demolition order','renovation plan','zoning permit','construction delay'],
    'innocent': ['guilty','pure','sincere','naive','blameless','virtuous','childlike','honest'],
    'gazing steadily at': ['glancing briefly at','looking away from','staring blankly at','scanning quickly','peering closely at','squinting at','focusing sharply on','observing casually'],
    'accepting with pleasure': ['rejecting with regret','taking reluctantly','receiving with suspicion','declining politely','giving up willingly','returning with apologies','offering formally','demanding insistently'],
    'family court': ['criminal court','supreme court','district court','magistrate court','tribunal','labor court','civil court','appellate court'],
    'tissue paper': ['toilet paper','newspaper','cardboard','wrapping paper','wax paper','sandpaper','blotting paper','aluminum foil'],
    'good morning': ['good evening','good night','good afternoon','goodbye','see you tomorrow','sweet dreams','have a good day','hello'],
    'holiday': ['workday','school day','normal day','weekend day','busy day','ordinary day','regular day','routine day'],
    'lunch': ['breakfast','dinner','snack','dessert','brunch','supper','afternoon tea','midnight snack'],
    'crown prince': ['prime minister','king','emperor','president','nobleman','duke','lord','chancellor'],
    'artificial flower': ['real flower','dried flower','paper flower','silk flower','wax flower','plastic flower','pressed flower','fresh bouquet'],
    'uncommon': ['ordinary','typical','normal','frequent','standard','expected','regular','common'],
    'great stature': ['small build','average height','slim figure','tall frame','broad shoulders','stocky build','lean physique','imposing posture'],
    'returning to port': ['departing from harbor','navigating open sea','anchoring offshore','sailing upriver','docking at a pier','launching from shore','navigating a strait','heading out to sea'],
    'not writing or contacting for a while': ['staying in close contact','writing frequently','calling regularly','visiting often','sending messages daily','maintaining correspondence','keeping in touch','communicating constantly'],
    'immeasurable': ['finite','countable','limited','measurable','calculable','approximate','bounded','definite'],
    'gold thread': ['silver wire','silk thread','cotton yarn','copper wire','glass fiber','nylon cord','linen string','iron chain'],
    'navigation': ['anchoring','docking','sailing','steering','charting course','plotting route','exploring','voyaging'],
    '(thick) scarf': ['thin belt','light shawl','heavy coat','wool hat','leather glove','silk tie','cotton bib','fur collar'],
    'same amount': ['different quantity','equal volume','unequal portion','similar weight','more than expected','less than needed','double the amount','half the quantity'],
    'fifty': ['forty','sixty','thirty','seventy','twenty','eighty','fifteen','forty-five'],
    'moving from place to place': ['staying in one place','settling permanently','relocating once','drifting aimlessly','traveling abroad','living nomadically','changing residences repeatedly','wandering freely'],
    'several times': ['once','twice','many times','never','occasionally','frequently','a dozen times','countless times'],
    'wild rocambole (Allium grayi)': ['Chinese chives','Japanese leek','wild garlic','Korean parsley','field onion','mountain garlic','wild chives','bamboo shoots'],
    'new rice field': ['old paddy','terraced farm','vegetable plot','orchard field','reclaimed wetland','dry farmland','upland field','flooded rice paddy'],
    'construction': ['demolition','renovation','restoration','rebuilding','maintenance','repair','inspection','foundation'],
    'intimacy': ['distance','formality','hostility','coldness','rivalry','indifference','estrangement','enmity'],
    'making an incision in the abdomen': ['stitching a wound','taking blood pressure','performing CPR','amputating a limb','diagnosing an illness','prescribing medication','administering anesthesia','examining an X-ray'],
    'daily use': ['occasional use','ceremonial use','emergency use','decorative purpose','seasonal use','industrial use','medicinal use','archival use'],
    'government office': ['private firm','hospital ward','school gymnasium','shopping center','community hall','police station','fire department','diplomatic mission'],
    '(natural) lighting (of an interior space)': ['artificial lighting','window installation','ventilation system','heating arrangement','acoustic treatment','insulation method','electrical wiring','plumbing layout'],
    'mining': ['farming','fishing','logging','manufacturing','construction','transportation','trading','craftsmanship'],
    'the sense of smell': ['the sense of taste','the sense of hearing','the sense of touch','the sense of sight','proprioception','balance','spatial awareness','pain perception'],
    'address in reply (e.g. at a ceremony)': ['opening remarks','welcoming speech','closing statement','keynote address','commencement speech','memorial tribute','election manifesto','corporate announcement'],
    'national pride': ['national shame','regional identity','cultural heritage','patriotic duty','civic virtue','collective memory','shared tradition','historical legacy'],
    'Qing dynasty (of China; 1644-1912)': ['Ming dynasty','Han dynasty','Tang dynasty','Song dynasty','Yuan dynasty','Zhou dynasty','Shang dynasty','Three Kingdoms period'],
    'detailed and accurate': ['rough and approximate','brief and general','vague and uncertain','precise and thorough','exact and exhaustive','clear and specific','broad and imprecise','loose and general'],
    'mountains and rivers': ['plains and seas','forests and lakes','valleys and fields','hills and coasts','glaciers and fjords','deserts and oases','swamps and deltas','moors and cliffs'],
    'loyal retainer': ['treacherous vassal','faithful advisor','dishonest servant','rebellious soldier','trusted steward','obedient subject','devoted follower','loyal general'],
    'study': ['leisure','rest','play','practice','performance','application','teaching','examination'],
    'present': ['past','absent','gift','future','current moment','here and now','immediate','ongoing'],
    'adult bird': ['young chick','nestling','fledgling','bird egg','migratory bird','songbird','raptor','water bird'],
    'prosperous period': ['era of decline','golden age','period of crisis','time of hardship','boom era','flourishing time','stagnant period','dark age'],
    'sincerity': ['insincerity','honesty','deception','loyalty','pretense','genuineness','faithfulness','candor'],
    'shintai': ['sacred text','ritual vessel','holy water','divine messenger','religious symbol','consecrated object','ceremonial garment','sacrificial offering'],
    'private individual': ['public official','government employee','prominent figure','corporate executive','military officer','religious leader','legal authority','elected representative'],
    'self-interest': ['altruism','selflessness','public good','common welfare','shared benefit','collective gain','mutual assistance','civic duty'],
    'profound': ['shallow','trivial','deep','meaningful','significant','insightful','thoughtful','enlightening'],
    'singing and dancing': ['reading and writing','running and jumping','eating and drinking','talking and listening','painting and sculpting','cooking and serving','praying and meditating','playing and resting'],
    'large boat': ['small boat','canoe','kayak','submarine','life raft','motorboat','rowboat','houseboat'],
    'one\'s beloved daughter': ['oldest son','youngest child','adopted child','dear nephew','beloved niece','cherished granddaughter','treasured student','favored disciple'],
    '(Western) archery': ['Japanese archery','sword fighting','judo','sumo','kendo','karate','traditional wrestling','horseback riding'],
    'shop that handles Western-style apparel and accessories': ['Japanese clothing store','fabric shop','second-hand boutique','tailor shop','dry cleaner','hat shop','shoe repair store','textile factory'],
    'eldest child': ['youngest child','middle child','only child','adopted child','twin child','eldest son','second daughter','stepchild'],
    'long spell of rain': ['brief shower','drought','sudden downpour','light drizzle','thunderstorm','snowfall','heavy fog','cold snap'],
    'wits': ['ignorance','intelligence','memory','judgment','creativity','perception','awareness','reasoning'],
    'grain (of wood)': ['bark texture','knot pattern','wood color','annual ring','surface finish','wood density','fiber direction','growth layer'],
    'attack': ['defense','retreat','surrender','negotiation','ceasefire','advance','bombardment','siege'],
    'date': ['appointment','location','event','year','season','time','schedule','occasion'],
    'season': ['weather','year','month','week','era','period','time of day','moment'],
    'patriotism': ['treason','nationalism','loyalty','devotion','civic duty','love of homeland','anti-government sentiment','international cooperation'],
    'government': ['anarchy','democracy','monarchy','tyranny','authority','administration','regime','rule'],
    'sutra library': ['reading room','prayer hall','meditation center','scripture vault','monks\' quarters','abbot\'s office','bell tower','main gate'],
    'important person': ['ordinary citizen','influential figure','powerful leader','notable figure','respected elder','anonymous person','dignitary','authority figure'],
    'rocky area': ['sandy beach','grassy plain','dense forest','muddy riverbank','snowy slope','salt flat','swampy ground','cultivated field'],
    'excuse': ['apology','reason','explanation','justification','pretext','accusation','complaint','reprimand'],
    'cooperation': ['competition','conflict','rivalry','partnership','collaboration','teamwork','assistance','coordination'],
    'left side': ['right side','center','above','below','behind','ahead','opposite side','diagonal direction'],
    'week before last': ['last week','this week','next week','a month ago','yesterday','two weeks ago','a few days ago','last month'],
    'continuation': ['beginning','end','interruption','conclusion','pause','termination','cessation','postponement'],
    'checkmate': ['stalemate','draw','forfeit','check','winning move','illegal move','king capture','endgame'],
    'coming out': ['going in','entering','returning','hiding','retreating','appearing','emerging','advancing'],
    'same city': ['different district','neighboring town','same village','same prefecture','same country','nearby region','adjacent area','opposing neighborhood'],
    'store': ['warehouse','home','park','office','factory','school','hospital','restaurant'],
    'offshoot': ['main branch','root','trunk','core','center','origin','primary source','foundation'],
    'decision': ['indecision','hesitation','decree','resolution','judgment','verdict','ruling','determination'],
    'rack': ['shelf','drawer','cabinet','locker','stand','holder','bracket','frame'],
    '(school) grade': ['test score','class rank','subject area','school level','academic year','course credit','diploma','degree'],
    'un-': ['pre-','re-','over-','under-','anti-','non-','mis-','dis-'],
    'sub-': ['super-','pre-','post-','semi-','meta-','ultra-','hyper-','proto-'],
    '-ness': ['-ity','-tion','-ment','-ance','-hood','-ship','-dom','-ism'],
    'other (esp. people and abstract matters)': ['same','similar','related','identical','connected','relevant','opposite','equivalent'],
    'speed of a pitched ball': ['accuracy of a thrown ball','spin rate of a pitch','trajectory of a hit','velocity of a swing','arc of a throw','force of impact','distance of a throw','angle of release'],
    'twist': ['pull','knot','turn','bend','fold','loop','curl','tangle'],
    'well': ['pit','cistern','spring','fountain','reservoir','pump','shaft','borehole'],
    'mystery': ['certainty','secret','puzzle','enigma','riddle','phenomenon','revelation','explanation'],
    'learning': ['forgetting','ignorance','education','knowledge','practice','teaching','understanding','wisdom'],
    'midwinter': ['midsummer','early spring','late autumn','harvest season','cherry blossom season','rainy season','early summer','late winter'],
    'volume (of book)': ['chapter','page','paragraph','index','appendix','preface','edition','issue'],
    'kan (obs. unit of weight, approx. 3.75 kg, 8.3 lb)': ['momme (unit of weight)','ryō (unit of currency)','shaku (unit of length)','ken (unit of measurement)','chō (unit of area)','koku (unit of volume)','sun (unit of length)','bu (unit of fraction)'],
    'fishing': ['hunting','farming','logging','mining','trading','herding','gathering','trapping'],
    'ban (e.g. on smoking)': ['permission','allowance','regulation','restriction','rule','law','policy','guideline'],
    'fungus': ['bacterium','virus','plant','alga','parasite','mold','yeast','spore'],
    'light (e.g. aircraft, truck)': ['heavy','medium','standard','compact','extra-large','oversized','miniature','full-sized'],
    'the most': ['the least','somewhat','very','slightly','moderately','rather','quite','extremely'],
    'sect': ['denomination','religion','school of thought','movement','organization','faction','tradition','order'],
    'collection': ['single item','distribution','donation','individual piece','exhibition','archive','anthology','compilation'],
    'commander': ['soldier','subordinate','officer','general','captain','advisor','strategist','diplomat'],
    'space': ['ground','sea','air','underground','surface','interior','sky','atmosphere'],
    'hammer': ['chisel','saw','screwdriver','wrench','pliers','drill','mallet','axe'],
    '(sheet) music': ['lyrics','album cover','musical instrument','sheet lyrics','audio recording','music stand','metronome','score'],
    'nothing': ['something','everything','anything','one thing','all things','many things','several things','a little'],
    'good (quality, condition, etc.)': ['poor','bad','average','excellent','acceptable','decent','adequate','satisfactory'],
    '(written) appeal': ['verbal argument','legal defense','formal complaint','public announcement','private letter','official decree','personal apology','ceremonial proclamation'],
    'each other': ['one-sided','alone','by oneself','individually','separately','alternately','in turn','collectively'],
    'rattan': ['bamboo','wood','iron','plastic','rubber','leather','cotton','glass'],
    'to that extent': ['to this degree','to some degree','not at all','excessively','minimally','moderately','gradually','entirely'],
    'now that you mention it': ['come to think of it','on second thought','in that case','as a result','before I forget','incidentally','on the contrary','all things considered'],
    'after all': ['in the beginning','regardless','apparently','as expected','despite everything','ultimately','surprisingly','in conclusion'],
    'frequency': ['rarity','regularity','occurrence','rate','interval','period','pace','cycle'],
    'light brown': ['dark brown','golden yellow','reddish orange','pale beige','deep amber','warm tan','chestnut brown','caramel'],
    'note': ['letter','message','report','announcement','card','document','diary','memo'],
    'to be open (to traffic)': ['to be closed to traffic','to allow vehicles through','to be under construction','to be restricted','to be monitored','to be redirected','to be accessible','to be blocked'],
    'bye-bye': ['hello','good morning','good evening','welcome','see you soon','nice to meet you','thank you','take care'],
    'goodness': ['badness','wickedness','virtue','morality','quality','excellence','righteousness','kindness'],
    'under (guidance, supervision, rules, the law, etc.)': ['above authority','without oversight','despite rules','in violation of law','outside supervision','free from control','beyond jurisdiction','ignoring regulations'],
    'Thailand': ['Vietnam','Cambodia','Malaysia','Myanmar','Laos','Indonesia','Philippines','Singapore'],
    'four (long cylindrical things)': ['three (flat objects)','five (round objects)','two (square things)','six (thin items)','one (cylindrical thing)','several (pointed objects)','many (curved items)','a few (long objects)'],
    'a great deal': ['a little','nothing','somewhat','slightly','a bit','barely','moderately','fairly'],
    'thus': ['therefore','however','although','because','unless','until','after','before'],
    'in a row': ['scattered randomly','in a circle','in a pile','in pairs','side by side','lined up neatly','arranged randomly','clustered together'],
    'diligently': ['lazily','carelessly','slowly','occasionally','reluctantly','half-heartedly','inattentively','aimlessly'],
    'want to do ...': ['unable to do','afraid to do','not allowed to','have finished','about to do','trying to do','expected to do','planning to do'],
    'yes?': ['no?','really?','perhaps?','never?','always?','maybe?','of course?','definitely?'],
    'I\'m off (and will be back later)': ['I\'ve just arrived home','I\'m leaving for good','I\'m staying here','welcome back','please come in','I\'ll be right back','I\'m already home','I won\'t return today'],
    'number (in a series)': ['counter for flat objects','counter for animals','counter for long objects','counter for bound items','counter for machines','counter for small items','counter for people','counter for events'],
    'indicates a question': ['indicates a command','indicates emphasis','indicates uncertainty','marks a topic','marks a subject','marks possession','marks a verb ending','marks an adjective'],
    'at': ['in','on','by','from','with','for','around','near'],
    'if ... then': ['whether or not','because of','in spite of','as long as','even though','before','after','unless'],
    'right?': ['yes?','no?','isn\'t it?','really?','correct?','is that so?','is it not?','wouldn\'t you say?'],
    'hey': ['no','yes','oh','ah','um','hmm','wow','ugh'],
    'indicates emotion or admiration': ['indicates question','indicates command','indicates negation','indicates past tense','indicates future','marks topic','marks subject','marks location'],
    'don\'t': ['please do','must','should','let\'s','stop','start','keep','try to'],
    'is it?': ['isn\'t it?','maybe?','of course!','really?','certainly!','never!','always?','could be?'],
    'and yet': ['and so','or else','even so','therefore','unless','although','because','as a result'],
    'but': ['and','or','so','if','when','because','although','while'],
    'translation': ['interpretation','paraphrase','summary','commentary','annotation','correction','revision','explanation'],
    '(common) soldier': ['general','officer','commander','admiral','sergeant','captain','recruit','veteran'],
    'interval': ['moment','duration','period','gap','pause','break','distance','span'],
    'rank': ['grade','score','level','position','status','class','order','degree'],
    'shape': ['color','size','texture','weight','material','pattern','structure','form'],
    'occasional': ['frequent','constant','rare','habitual','regular','periodic','continuous','sporadic'],
    'one\'s nature': ['one\'s skill','one\'s habit','one\'s appearance','one\'s reputation','one\'s role','one\'s ambition','one\'s attitude','one\'s origin'],
    'counter for buildings (esp. houses)': ['counter for flat objects','counter for animals','counter for vehicles','counter for people','counter for books','counter for events','counter for trees','counter for machines'],
    'lowness (of degree, value, etc.)': ['highness of rank','degree of intensity','level of quality','measure of depth','extent of width','degree of brightness','amount of weight','measure of temperature'],
    'lower reaches (of a river)': ['upper reaches','headwaters','tributaries','delta region','river mouth','midstream','riverbank','floodplain'],
    'no': ['yes','maybe','certainly','possibly','definitely','absolutely','never','probably'],
    'both (hands, parents, sides, etc.)': ['neither','one of','only one side','all three','several','a few','none','just one'],
    'warm': ['cold','hot','cool','mild','tepid','lukewarm','chilly','freezing'],
    'tax': ['salary','income','profit','interest','subsidy','bonus','allowance','wage'],
    'large': ['small','tiny','medium','enormous','vast','compact','oversized','huge'],
    'Sunday': ['Saturday','Monday','Friday','Tuesday','Wednesday','Thursday','midweek'],
    'smallness': ['largeness','tininess','enormousness','hugeness','vastness','greatness','grandeur','magnificence'],
    'like that': ['like this','in this way','in that manner','as follows','differently','similarly','unexpectedly','obviously'],
    'interrogative sentence-ending particle expressing doubt': ['sentence-ending emphasis particle','topic-marking particle','subject-marking particle','object-marking particle','direction-indicating particle','time-indicating particle','condition-marking particle','final exclamatory particle'],
    'simplicity': ['complexity','difficulty','sophistication','elaborateness','intricacy','plainness','clarity','elegance'],
    'life': ['death','existence','vitality','survival','being','growth','essence','spirit'],
    'have a good day': ['good night','good morning','goodbye','see you tomorrow','welcome back','please come in','I\'m leaving','take care'],
    'Hansen\'s disease': ['typhoid fever','tuberculosis','malaria','cholera','smallpox','dysentery','scurvy','plague'],
    'Germany': ['France','England','Italy','Spain','Austria','Switzerland','Netherlands','Belgium'],
    'small': ['large','medium','tiny','huge','narrow','compact','slim','petite'],
    'my sympathies': ['congratulations','happy birthday','well done','thank you','welcome','apologies','good luck','best wishes'],
    'x (mark)': ['checkmark','circle','triangle','square','star','cross','dot','dash'],
    'buck (male deer)': ['doe (female deer)','fawn (young deer)','stag (mature deer)','elk','moose','reindeer','antelope','gazelle'],
    'former': ['current','present','future','next','previous','recent','latest','original'],
    'outside ...': ['inside','within','between','above','below','beside','around','beyond'],
    'bonze': ['samurai','monk','priest','nun','cleric','bishop','elder','shrine maiden'],
    'xun (one of the trigrams of the I Ching: wind, southeast)': ['qian (heaven, northwest)','kun (earth, southwest)','zhen (thunder, east)','kan (water, north)','gen (mountain, northeast)','li (fire, south)','dui (lake, west)','tai (peace and prosperity)'],
    'stinginess': ['generosity','miserliness','frugality','thriftiness','greed','parsimony','wastefulness','extravagance'],
    'not yet': ['already','soon','never','always','just now','immediately','eventually','in a moment'],
    'minister (of a government department)': ['president','prime minister','governor','senator','mayor','commissioner','chairman','secretary'],
    'Italy': ['France','Germany','Spain','Portugal','Greece','Belgium','Austria','Switzerland'],
    'uncle': ['aunt','cousin','nephew','niece','grandfather','grandmother','in-law','great-uncle'],
    'aunt': ['uncle','cousin','nephew','niece','grandmother','grandfather','in-law','great-aunt'],
    'old lady': ['young woman','elderly man','middle-aged woman','grandmother','aunt','senior citizen','teenager','little girl'],
    'swiftly': ['slowly','gradually','suddenly','steadily','cautiously','instantly','momentarily','carefully'],
    'ah': ['oh','um','hmm','eh','wow','hey','ooh','ugh'],
    'and then': ['but then','or else','after that','before that','at the same time','nevertheless','therefore','however'],
    'please sit down': ['please stand up','please leave','please come in','please wait outside','please be quiet','please repeat','please listen','please help yourself'],
    'absoluteness': ['relativity','conditionality','subjectivity','uncertainty','ambiguity','dependence','approximation','variation'],
    'at that time': ['right now','in the future','long ago','recently','eventually','someday','from now on','indefinitely'],
    'normal conversation': ['formal speech','heated argument','private whisper','official announcement','public debate','written correspondence','sign language','silent communication'],
    'defined style': ['free form','undefined pattern','flexible format','loose structure','informal style','random arrangement','open design','unregulated form'],
    'becoming aware': ['remaining ignorant','staying confused','growing forgetful','achieving understanding','losing consciousness','gaining insight','realizing suddenly','comprehending fully'],
    'frequency': ['rarity','regularity','interval','occurrence','cycle','pace','rate','repetition'],
    'thank you for waiting': ['sorry for interrupting','please come in','go right ahead','excuse me','you\'re welcome','nice to meet you','good morning','see you soon'],
    'cholera': ['typhoid','tuberculosis','smallpox','malaria','bubonic plague','dysentery','typhus','yellow fever'],
    'Germany': ['Austria','France','Netherlands','Belgium','Switzerland','Denmark','Poland','Italy'],
    'please': ['wait','stop','come','go','listen','look','help','answer'],
    'my sympathies': ['congratulations','happy birthday','well done','thank you for the gift','welcome back','sorry to disturb','good luck','have a good day'],
    'bu': ['yen','sen','momme','ryo','koku','mon','fun','rin'],
    'good bye': ['hello','good morning','good evening','see you later','I\'ll be right back','welcome','please wait','nice to meet you'],
    'rank': ['order','position','grade','level','class','status','tier','standing'],
    'simplicity': ['complexity','intricacy','difficulty','elaborateness','sophistication','plainness','straightforwardness','elegance'],
    'life': ['death','vitality','energy','existence','spirit','essence','being','soul'],
    'have a good day': ['good night','farewell','goodbye','please come back','stay safe','see you soon','take care','until next time'],
    'Hansen\'s disease': ['tuberculosis','leprosy-related illness','typhoid fever','cholera','bubonic plague','smallpox','malaria','scurvy'],
    'Germany': ['Austria','Netherlands','France','Poland','Belgium','Switzerland','Czech Republic','Denmark'],
    'my sympathies': ['congratulations','happy birthday','best wishes','well done','thank you','welcome','good luck','see you soon'],

    // Kanji / loanword concepts
    'mom': ['dad','mother','sister','brother','grandmother','aunt','teacher','friend'],
    'poster': ['flyer','banner','sign','advertisement','notice','placard','billboard','brochure'],
    'market': ['store','supermarket','bazaar','fair','shop','mall','warehouse','exchange'],
    'mike': ['speaker','headset','amplifier','recorder','camera','transmitter','antenna','receiver'],
    'minus': ['plus','zero','times','divided by','equal to','greater than','less than','approximately'],
    '(face) mask': ['helmet','goggles','gloves','cap','visor','shield','hood','scarf'],
    'match (for lighting a fire)': ['lighter','candle','torch','flint','firewood','tinder','spark plug','kindling'],
    'sewing machine': ['washing machine','knitting needle','loom','iron','dryer','typewriter','spinning wheel','embroidery hoop'],
    'mistake': ['success','error','failure','accident','oversight','blunder','fault','slip'],
    'milk': ['water','juice','coffee','tea','soda','broth','cream','buttermilk'],
    'meter': ['centimeter','kilometer','inch','foot','yard','pound','kilogram','degree'],
    'menu': ['recipe','order form','price list','catalog','schedule','agenda','guidebook','brochure'],
    'member': ['leader','guest','outsider','opponent','visitor','observer','supporter','participant'],
    'motor': ['engine','gear','battery','turbine','pump','generator','piston','cylinder'],
    'modern': ['traditional','ancient','classical','outdated','historical','old-fashioned','contemporary','original'],
    'model': ['copy','original','prototype','blueprint','pattern','template','example','design'],
    'monorail': ['subway','bus','tram','train','taxi','helicopter','cable car','ferry'],
    'humor': ['seriousness','wit','comedy','sarcasm','irony','pun','satire','absurdity'],
    'Europe': ['Asia','Africa','Americas','Oceania','Middle East','Arctic','Antarctic','Mediterranean'],
    'yacht (esp. a sailing boat with one mast)': ['motorboat','steamship','rowboat','canoe','submarine','aircraft carrier','cruise ship','tanker'],
    'marathon': ['sprint','relay race','triathlon','decathlon','cross-country','hurdles','steeplechase','rowing race'],
    'condominium (usu. mid or high-rise)': ['single-family house','apartment in low-rise building','detached villa','mobile home','townhouse','studio flat','dormitory room','guesthouse'],
    'brush': ['comb','broom','roller','sponge','mop','duster','squeegee','scrubber'],
    'bowl': ['cup','plate','jug','pot','pan','dish','saucer','mug'],
    'lighter': ['match','torch','candle','flint','tinder','flame thrower','gas burner','spark plug'],
    'elegance': ['clumsiness','refinement','grace','style','poise','sophistication','charm','beauty'],
  };

  // Check for exact match
  if (nounGroups[a]) return nounGroups[a];

  // Check partial matches
  for (const [key, vals] of Object.entries(nounGroups)) {
    if (a.includes(key) || key.includes(a)) return vals;
  }

  // Fallback: generic plausible English vocabulary
  return [
    'obligation','opportunity','suggestion','arrangement','condition',
    'situation','development','requirement','characteristic','tendency'
  ].slice(0,8);
}

// =========== MAIN PROCESSING ===========

function processEntry(entry) {
  const { id, s, q, a, d, e, l1, l2 } = entry;

  let newQ = null;
  let newD = null;

  // --- Question fix: bare question (no Japanese chars) ---
  // Note: For katakana words the question already includes the katakana, so it's fine.
  // We only need to check for questions that are truly bare (missing context).
  // The pattern "What does 'X' mean in English?" where X has no reading is acceptable.

  // --- Distractor fix ---
  const needsFix =
    isPlaceholderSet(d) ||
    isPrepVariationGarbage(d, a) ||
    hasAdjectiveVariantGarbage(d) ||
    hasSimilarToEntries(d) ||
    hasTooFew(d) ||
    hasAnswerEcho(d, a) ||
    hasDuplicates(d);

  if (needsFix) {
    // Try to salvage good distractors from existing set
    const goodFromExisting = (d || []).filter(x => {
      const lx = x.toLowerCase().trim();
      const la = a.toLowerCase().trim();
      // Exclude: answer echo
      if (lx === la) return false;
      // Exclude: "similar to ..."
      if (lx.startsWith('similar to') || lx.startsWith('similar (')) return false;
      // Exclude: "alternate/other/varied/variant ..."
      if (/^(alternate|other|varied|variant|different)\s*[\(\[]/.test(lx)) return false;
      // Exclude: preposition swaps
      const preps = ['of','in','for','about','during','before','after','around'];
      for (const prep of preps) {
        if (lx.includes(` (${prep} `)) {
          // Check if it matches the answer base
          const base = la.split('(')[0].trim();
          if (base.length > 3 && lx.startsWith(base)) return false;
        }
      }
      // Exclude placeholder words
      const placeholders = ['signify','denote','represent','indicate','suggest','express','convey','imply',
        'how?','what?','which','who','where','when','meaning','sense','essence','import','value','purpose','intent',
        'to blow','to wave','to sense','to perceive','to sink','to plunge','to split','to separate',
        'and at the same time','in addition to that said','it is not the case','on the other hand though',
        'when all is said done','in the final analysis here','the key point being this','as far as I know'];
      if (placeholders.includes(lx)) return false;
      return true;
    });

    // Generate fresh distractors
    const generated = generateDistractors(id, a, q, goodFromExisting);

    // Merge: start with good existing, fill with generated
    const combined = [...goodFromExisting];
    for (const g of generated) {
      if (combined.length >= 8) break;
      const gl = g.toLowerCase().trim();
      const al = a.toLowerCase().trim();
      if (gl !== al && !combined.some(x => x.toLowerCase().trim() === gl)) {
        combined.push(g);
      }
    }

    // If still short, pad with generic alternatives
    if (combined.length < 6) {
      const pads = ['condition','situation','development','requirement','tendency','arrangement','opportunity','obligation'];
      for (const p of pads) {
        if (combined.length >= 8) break;
        if (!combined.some(x => x.toLowerCase().trim() === p.toLowerCase()) && p.toLowerCase() !== a.toLowerCase().trim()) {
          combined.push(p);
        }
      }
    }

    newD = combined.slice(0, 8);
  }

  // Build output: null for unchanged fields
  const out = {
    id,
    q: newQ,
    a: null,
    d: newD !== null ? newD : d, // d is always full array
    e: null,
    l1: null,
    l2: null,
    i: null,
  };

  return out;
}

// Ensure output dir exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

let totalProcessed = 0;
let totalFixed = 0;
let totalSkipped = 0;

for (const batchNum of BATCHES) {
  const batchStr = String(batchNum).padStart(3, '0');
  const inFile = path.join(BATCH_DIR, `batch-${batchStr}.jsonl`);
  const outFile = path.join(OUT_DIR, `batch-${batchStr}.jsonl`);

  // Skip if result already exists
  if (fs.existsSync(outFile)) {
    console.log(`SKIP batch-${batchStr} (result exists)`);
    totalSkipped++;
    continue;
  }

  if (!fs.existsSync(inFile)) {
    console.log(`WARN batch-${batchStr} input not found`);
    continue;
  }

  const lines = fs.readFileSync(inFile, 'utf8').trim().split('\n').filter(Boolean);
  const outLines = [];
  let fixedInBatch = 0;

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (e) {
      console.error(`Parse error in batch-${batchStr}: ${e.message}`);
      continue;
    }

    const result = processEntry(entry);
    const wasFixed = result.d !== entry.d;
    if (wasFixed) fixedInBatch++;
    outLines.push(JSON.stringify(result));
  }

  fs.writeFileSync(outFile, outLines.join('\n') + '\n', 'utf8');
  console.log(`DONE batch-${batchStr}: ${lines.length} entries, ${fixedInBatch} fixed`);
  totalProcessed += lines.length;
  totalFixed += fixedInBatch;
}

console.log(`\nSummary: ${BATCHES.length - totalSkipped} batches processed, ${totalFixed}/${totalProcessed} entries fixed, ${totalSkipped} skipped`);
