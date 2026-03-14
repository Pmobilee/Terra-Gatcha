#!/usr/bin/env node
'use strict';

const fs = require('fs');

// Manual fixes for all 30 known bad entries
const FIXES = {
  // batch-109
  'ja-vocab-n3-371': { a: 'greatness', d: ['excellence','magnificence','grandeur','significance','superiority','enormity','splendor','renown'] },
  'ja-vocab-n3-399': { a: 'medical treatment', d: ['surgical operation','diagnosis','prescription','physical therapy','vaccination','hospitalization','emergency care','rehabilitation'] },
  'ja-vocab-n3-465': { a: 'monkey (esp. the Japanese macaque, Macaca fuscata)', d: ['chimpanzee','baboon','gibbon','lemur','orangutan','gorilla','macaque (other species)','tamarin'] },
  // batch-110
  'ja-vocab-n3-498': { a: 'the figure (diagram, illustration, chart, graph, etc.) below', d: ['the table above','the chart on the right','the appendix at the end','the image overleaf','the graph on the left','the figure previously shown','the illustration in question','the diagram referred to'] },
  'ja-vocab-n3-503': { a: '(state of) apparent death', d: ['actual death','comatose state','deep sleep','unconsciousness','severe illness','near-death experience','hibernation','catalepsy'] },
  'ja-vocab-n3-543': { a: 'taxation', d: ['subsidization','spending','fiscal policy','revenue collection','tariff','income tax','consumption tax','levy'] },
  // batch-111
  'ja-vocab-n3-574': { a: 'rotation', d: ['revolution','oscillation','translation','vibration','circulation','orbit','spin','gyration'] },
  'ja-vocab-n3-627': { a: 'activity (of a person, organization, animal, volcano, etc.)', d: ['inactivity','passiveness','dormancy','stillness','eruption','movement','function','operation'] },
  'ja-vocab-n3-638': { a: 'calculation', d: ['estimation','measurement','counting','computation','formula','arithmetic','evaluation','assessment'] },
  'ja-vocab-n3-666': { a: 'sweat', d: ['tears','blood','saliva','mucus','sebum','urine','bile','lymph'] },
  'ja-vocab-n3-669': { a: 'annulation', d: ['elongation','segmentation','branching','coiling','spiraling','layering','division','constriction'] },
  // batch-112
  'ja-vocab-n3-682': { a: 'observation', d: ['experimentation','calculation','speculation','measurement','recording','monitoring','investigation','analysis'] },
  'ja-vocab-n3-737': { a: 'sensation', d: ['perception','emotion','thought','instinct','reflex','awareness','feeling','consciousness'] },
  'ja-vocab-n3-747': { a: 'commemoration', d: ['celebration','mourning','dedication','consecration','inauguration','anniversary','memorial service','ceremony'] },
  // batch-122
  'ja-vocab-n4-705': { a: 'yuzu (Citrus ichangensis x C. reticulata)', d: ['mandarin orange (Citrus reticulata)','sudachi (Citrus sudachi)','kabosu (Citrus sphaerocarpa)','shikuwasa (Citrus depressa)','bergamot (Citrus bergamia)','citron (Citrus medica)','kumquat (Fortunella japonica)','pomelo (Citrus maxima)'] },
  // batch-123
  'ja-vocab-n5-019': { a: 'that way', d: ['this way','another way','the right way','the wrong way','a different direction','the same direction','an unexpected direction','the opposite direction'] },
  'ja-vocab-n5-043': { a: 'coat', d: ['jacket','overcoat','blazer','vest','cardigan','windbreaker','trench coat','parka'] },
  // batch-126
  'ja-vocab-n5-305': { a: 'plate', d: ['bowl','cup','tray','dish','saucer','platter','pan','container'] },
  // batch-127
  'ja-vocab-n5-413': { a: 'oath', d: ['promise','vow','pledge','commitment','treaty','declaration','covenant','contract'] },
  'ja-vocab-n5-431': { a: 'oath', d: ['promise','vow','pledge','commitment','treaty','declaration','covenant','contract'] },
  'ja-vocab-n5-447': { a: 'death', d: ['life','birth','illness','injury','recovery','survival','immortality','resurrection'] },
  // batch-128
  'ja-vocab-n5-501': { a: 'weather', d: ['climate','temperature','forecast','season','pressure','humidity','wind speed','precipitation'] },
  'ja-vocab-n5-509': { a: 'to', d: ['from','toward','at','into','onto','through','via','beyond'] },
  // batch-129
  'ja-vocab-n5-662': { a: 'rain water', d: ['sea water','river water','tap water','spring water','melted snow','well water','ground water','distilled water'] },
  'ja-vocab-n5-685': { a: 'coat', d: ['jacket','overcoat','blazer','vest','cardigan','windbreaker','trench coat','parka'] },
  // batch-130
  'ja-vocab-n5-707': { a: 'gate', d: ['door','window','fence','wall','entrance','arch','barrier','portal'] },
  'ja-vocab-n5-717': { a: 'consolation', d: ['encouragement','sympathy','congratulation','celebration','criticism','reprimand','indifference','hostility'] },
  'ja-vocab-n5-776': { a: 'patch', d: ['stitch','seam','hem','button','zipper','lining','fabric','thread'] },
  // batch-131
  'ja-vocab-n5-807': { a: 'bath', d: ['shower','sauna','hot spring','steam room','swimming pool','hot tub','foot bath','cold plunge'] },
  'ja-vocab-n5-819': { a: 'what', d: ['who','where','when','which','why','how','whose','whether'] },
};

// Also fix the pronoun "I" case (batch-121)
// ja-vocab-n4-573: 僕 means 'I'
// Check all results for "I" answer with bad distractors
const BATCHES = [109,110,111,112,121,122,123,124,125,126,127,128,129,130,131];

const RESULTS_DIR = '/Users/damion/CODE/Recall_Rogue/data/generated/quality-sweep/results/vocab-ja';
const BATCHES_DIR = '/Users/damion/CODE/Recall_Rogue/data/generated/quality-sweep/batches/vocab-ja';

let totalPatched = 0;

for (const b of BATCHES) {
  const bStr = String(b).padStart(3, '0');
  const outFile = `${RESULTS_DIR}/batch-${bStr}.jsonl`;
  const inFile = `${BATCHES_DIR}/batch-${bStr}.jsonl`;

  if (!fs.existsSync(outFile)) continue;

  const outLines = fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean);
  const inLines = fs.readFileSync(inFile, 'utf8').split('\n').filter(Boolean);
  let changed = false;

  const newLines = outLines.map((line, j) => {
    const out = JSON.parse(line);
    const inp = JSON.parse(inLines[j]);

    // Check if this ID needs patching
    if (FIXES[out.id]) {
      const fix = FIXES[out.id];
      out.d = fix.d;
      changed = true;
      totalPatched++;
      return JSON.stringify(out);
    }

    // Fix pronoun "I" case: answer is 'I' but distractors are wrong
    if (inp.a === 'I' && out.d) {
      const hasWrong = out.d.some(x => ['what','water','juice','coffee','tea','soda','broth','cream'].includes(x.toLowerCase()));
      if (hasWrong) {
        out.d = ['me','my','we','you','he','she','they','one'];
        changed = true;
        totalPatched++;
        return JSON.stringify(out);
      }
    }

    return line;
  });

  if (changed) {
    fs.writeFileSync(outFile, newLines.join('\n') + '\n', 'utf8');
    console.log(`Patched batch-${bStr}`);
  }
}

console.log(`Total patched: ${totalPatched} entries`);
