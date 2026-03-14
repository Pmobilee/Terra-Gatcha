#!/usr/bin/env python3
"""
Quality sweep fixer for vocab-ja batch-032 through batch-036.
Fixes:
  1. "similar X / form of X / type of X / X-like / variant of X / style of X / example of X" near-synonym sets
  2. "and at the same time / in addition to that said / ..." bad grammar-phrase sets
  3. "option-1 / option-2 / ..." placeholder sets
  4. "variant meaning / kindred concept / allied term / ..." other placeholder sets
  5. Long-form verb + away/out/up/back/continue/help/attempt/cause distractor sets

Output format: {"id","q","a","d","e","l1","l2","i"}
  - null means unchanged from source
  - "d" is always the full distractor array (never null)
"""

import json, os, sys

BATCHES_DIR = "/Users/damion/CODE/Recall_Rogue/data/generated/quality-sweep/batches/vocab-ja"
RESULTS_DIR = "/Users/damion/CODE/Recall_Rogue/data/generated/quality-sweep/results/vocab-ja"

# ─── Replacement distractor sets ─────────────────────────────────────────────
# Keyed by id → list of 6-8 semantically appropriate English meanings
# These are hand-crafted plausible wrong answers based on each word's context.

REPLACEMENTS = {

    # ═══ BATCH 032 ═══════════════════════════════════════════════════════════

    # ja-vocab-n1-1007: 惨め (みじめ) "shabby" — adjectives for poor/unpleasant condition
    "ja-vocab-n1-1007": ["pitiful","miserable","wretched","squalid","tattered","rundown","decrepit","dingy"],

    # ja-vocab-n1-1010: 見苦しい (みぐるしい) "unsightly" — adjectives for unappealing appearance
    "ja-vocab-n1-1010": ["unattractive","hideous","unsightly","repulsive","disheveled","homely","garish","tasteless"],

    # ja-vocab-n1-1014: 見地 (けんち) "point of view" — related perspective/opinion nouns
    "ja-vocab-n1-1014": ["standpoint","perspective","viewpoint","angle","opinion","outlook","vantage","position"],

    # ja-vocab-n1-1023: 君主 (くんしゅ) "sovereign" — nouns for rulers/leaders
    "ja-vocab-n1-1023": ["monarch","ruler","emperor","regent","warlord","patriarch","chieftain","tyrant"],

    # ja-vocab-n1-1024: 元年 (がんねん) "first year (of an imperial era)" — period/epoch nouns
    "ja-vocab-n1-1024": ["fiscal year","inaugural year","calendar year","founding decade","opening chapter","inaugural period","foundation year","inaugural term"],

    # ja-vocab-n1-1033: 原則 (げんそく) "principle" — nouns for rules/maxims
    "ja-vocab-n1-1033": ["rule","standard","doctrine","tenet","maxim","axiom","guideline","regulation"],

    # ja-vocab-n1-1038: 原油 (げんゆ) "crude oil" — petroleum/energy nouns
    "ja-vocab-n1-1038": ["refined petroleum","natural gas","mineral fuel","coal tar","diesel fuel","petroleum residue","heavy oil","shale oil"],

    # ja-vocab-n1-1041: 厳密 (げんみつ) "strict" — adjectives for precision/rigor
    "ja-vocab-n1-1041": ["rigorous","precise","meticulous","exact","severe","stringent","thorough","exacting"],

    # ja-vocab-n1-1049: 現在 (げんざい) "present" — time-reference nouns/adverbs
    "ja-vocab-n1-1049": ["past","future","nowadays","currently","at this moment","the present day","today","the current era"],

    # ja-vocab-n1-1060: 呼び止める (よびとめる) "to (call and) stop" — related action verbs
    "ja-vocab-n1-1060": ["to summon","to hail","to beckon","to intercept","to detain","to flag down","to call over","to halt"],

    # ja-vocab-n1-1061: 呼び出し (よびだし) "call" — nouns for summons/signals
    "ja-vocab-n1-1061": ["summons","signal","beep","alert","announcement","page","notice","notification"],

    # ja-vocab-n1-1067: 孤児 (こじ) "orphan" — child/family status nouns
    "ja-vocab-n1-1067": ["waif","foundling","ward","foster child","refugee","runaway","castaway","stray"],

    # ja-vocab-n1-1071: 戸締まり (とじまり) "locking up (doors and windows)" — security action nouns
    "ja-vocab-n1-1071": ["bolting doors","securing the house","fastening shutters","barring windows","latching gates","sealing entrances","chaining doors","securing locks"],

    # ja-vocab-n1-1076: 鼠径部 (そけいぶ) "groin" — body region nouns
    "ja-vocab-n1-1076": ["abdomen","pelvis","thigh","buttock","hip","lower back","flank","pubic area"],

    # ═══ BATCH 033 ═══════════════════════════════════════════════════════════

    # ja-vocab-n1-1082: 顧みる (かえりみる) "to look back on (the past)" — reflective verbs
    "ja-vocab-n1-1082": ["to reminisce","to recollect","to reflect on","to revisit","to recall","to recount","to reconsider","to reexamine"],

    # ja-vocab-n1-1084: 後悔 (こうかい) "regret" — emotional nouns
    "ja-vocab-n1-1084": ["remorse","guilt","shame","sorrow","lament","disappointment","contrition","anguish"],

    # ja-vocab-n1-1088: おむつ "diaper" — infant care nouns
    "ja-vocab-n1-1088": ["pacifier","swaddle","baby blanket","crib","infant formula","rattle","bib","stroller"],

    # ja-vocab-n1-1089: 感じ取る (かんじとる) "to sense" — perception verbs
    "ja-vocab-n1-1089": ["to perceive","to detect","to feel","to notice","to discern","to intuit","to grasp","to pick up on"],

    # ja-vocab-n1-1092: 語源 (ごげん) "origin of a word" — linguistics nouns
    "ja-vocab-n1-1092": ["word history","semantic root","linguistic derivation","phonetic origin","borrowed word","cognate form","word family","lexical ancestor"],

    # ja-vocab-n1-1094: 誤る (あやまる) "to make a mistake (in)" — error verbs
    "ja-vocab-n1-1094": ["to blunder","to err","to slip up","to miscalculate","to bungle","to misjudge","to mishandle","to stumble"],

    # ja-vocab-n1-1095: 誤差 (ごさ) "measurement error" — scientific nouns
    "ja-vocab-n1-1095": ["margin of error","statistical deviation","rounding error","calibration gap","systematic bias","tolerance band","variance","standard deviation"],

    # ja-vocab-n1-1098: 混ぜる (まぜる) "to mix" — combining verbs
    "ja-vocab-n1-1098": ["to blend","to stir","to combine","to mingle","to fuse","to merge","to agitate","to incorporate"],

    # ja-vocab-n1-1100: 交易 (こうえき) "trade" — commerce nouns
    "ja-vocab-n1-1100": ["commerce","barter","exchange","transaction","trafficking","dealing","import-export","merchandising"],

    # ja-vocab-n1-1102: 混合 (こんごう) "mixture" — blending nouns
    "ja-vocab-n1-1102": ["blend","compound","amalgam","alloy","combination","composite","medley","concoction"],

    # ja-vocab-n1-1106: 配達 (はいたつ) "delivery" — transport/logistics nouns
    "ja-vocab-n1-1106": ["shipment","dispatch","courier service","distribution","consignment","package drop","postal service","freight"],

    # ja-vocab-n1-1107: 光学 (こうがく) "optics" — physics/science branch nouns
    "ja-vocab-n1-1107": ["acoustics","thermodynamics","electromagnetism","mechanics","aerodynamics","fluid dynamics","quantum physics","nuclear physics"],

    # ja-vocab-n1-1119: 公開 (こうかい) "open" — accessibility nouns/adjectives
    "ja-vocab-n1-1119": ["public","accessible","disclosed","available","released","published","unveiled","exposed"],

    # ja-vocab-n1-1123: 公募 (こうぼ) "public appeal (e.g. for contributions)" — recruitment nouns
    "ja-vocab-n1-1123": ["open recruitment","public tender","open application","general solicitation","public subscription","competitive bidding","open enrollment","public call for entries"],

    # ja-vocab-n1-1128: 坂 (さか) "slope" — terrain nouns
    "ja-vocab-n1-1128": ["hill","incline","gradient","ramp","embankment","ridge","ascent","descent"],

    # ja-vocab-n1-1131: 鼻歌 (はなうた) "to hum (a tune)" — vocal activity verbs/nouns
    "ja-vocab-n1-1131": ["to whistle","to chant","to croon","to sing softly","to vocalize","to murmur a melody","to warble","to intone"],

    # ja-vocab-n1-1135: 口頭 (こうとう) "oral" — communication mode adjectives
    "ja-vocab-n1-1135": ["written","verbal","spoken","auditory","face-to-face","scripted","recorded","signed"],

    # ja-vocab-n1-1138: 今後 (こんご) "hereafter" — time-reference adverbs
    "ja-vocab-n1-1138": ["formerly","heretofore","henceforth","thereafter","presently","beforehand","retrospectively","eventually"],

    # ja-vocab-n1-1140: 汚れ (よごれ) "dirt" — contamination nouns
    "ja-vocab-n1-1140": ["grime","filth","stain","soot","muck","debris","residue","smudge"],

    # ja-vocab-n1-1142: 好い (よい) "nice" — positive quality adjectives
    "ja-vocab-n1-1142": ["pleasant","agreeable","fine","lovely","delightful","charming","satisfactory","favorable"],

    # ja-vocab-n1-1150: 巧み (たくみ) "ingenious" — cleverness adjectives
    "ja-vocab-n1-1150": ["clever","skillful","resourceful","inventive","shrewd","dexterous","astute","crafty"],

    # ja-vocab-n1-1152: 抗原 (こうげん) "antigen" — immunology nouns
    "ja-vocab-n1-1152": ["antibody","pathogen","allergen","virus","bacterium","protein marker","cytokine","lymphocyte"],

    # ja-vocab-n1-1155: 控える (ひかえる) "to be temperate in" — restraint verbs
    "ja-vocab-n1-1155": ["to refrain from","to abstain from","to hold back from","to restrain oneself","to limit","to moderate","to curb","to avoid"],

    # ja-vocab-n1-1158: 更新 (こうしん) "renewal" — update/replacement nouns
    "ja-vocab-n1-1158": ["revision","update","replacement","extension","overhaul","refresh","reinstatement","upgrade"],

    # ja-vocab-n1-1162: 構造 (こうぞう) "structure" — organizational nouns
    "ja-vocab-n1-1162": ["framework","composition","arrangement","configuration","layout","format","architecture","pattern"],

    # ═══ BATCH 034 ═══════════════════════════════════════════════════════════

    # ja-vocab-n1-1172: 考証 (こうしょう) "investigation into historical evidence" — historical research nouns
    "ja-vocab-n1-1172": ["historical verification","textual criticism","archival research","source examination","documentary analysis","archaeological study","scholarly authentication","historical corroboration"],

    # ja-vocab-n1-1174: 荒っぽい (あらっぽい) "wild" — rough behavior adjectives
    "ja-vocab-n1-1174": ["rough","coarse","violent","aggressive","brutal","uncouth","rowdy","fierce"],

    # ja-vocab-n1-1176: 荒廃 (こうはい) "ruin" — deterioration nouns
    "ja-vocab-n1-1176": ["decay","wreckage","devastation","desolation","collapse","degradation","dilapidation","debris"],

    # ja-vocab-n1-1178: 行為 (こうい) "act" — action nouns
    "ja-vocab-n1-1178": ["deed","conduct","behavior","action","move","step","measure","gesture"],

    # ja-vocab-n1-1179: 行進 (こうしん) "march" — movement nouns
    "ja-vocab-n1-1179": ["parade","procession","advance","trek","hike","journey","column","cortege"],

    # ja-vocab-n1-1187: 酵母 (こうぼ) "yeast" — fermentation/biology nouns
    "ja-vocab-n1-1187": ["mold","bacteria","enzyme","fungus","leaven","culture","ferment","microbe"],

    # ja-vocab-n1-1193: 香辛料 (こうしんりょう) "spice" — flavor/seasoning nouns
    "ja-vocab-n1-1193": ["herb","seasoning","condiment","flavoring","relish","garnish","marinade","dressing"],

    # ja-vocab-n1-1194: 高まる (たかまる) "to rise" — elevation verbs
    "ja-vocab-n1-1194": ["to increase","to surge","to escalate","to soar","to heighten","to swell","to intensify","to mount"],

    # ja-vocab-n1-1195: 高尚 (こうしょう) "dignity" — noble quality nouns
    "ja-vocab-n1-1195": ["nobility","refinement","elegance","distinction","prestige","grace","respectability","grandeur"],

    # ja-vocab-n1-1199: 高揚 (こうよう) "high" — elevated state adjectives/nouns
    "ja-vocab-n1-1199": ["elevated","lofty","exalted","raised","eminent","towering","superior","heightened"],

    # ja-vocab-n1-1200: 号数 (ごうすう) "number" — numerical nouns
    "ja-vocab-n1-1200": ["figure","count","digit","numeral","total","quantity","amount","tally"],

    # ja-vocab-n1-1202: 合わせる (あわせる) "to match (rhythm, speed, etc.)" — coordination verbs
    "ja-vocab-n1-1202": ["to synchronize","to align","to coordinate","to adjust","to calibrate","to harmonize","to tune","to adapt"],

    # ja-vocab-n1-1205: 合間 (あいま) "interval" — gap/pause nouns
    "ja-vocab-n1-1205": ["pause","gap","break","lull","intermission","recess","interlude","breathing space"],

    # ja-vocab-n1-1208: 合掌 (がっしょう) "pressing one's hands together in prayer" — gesture/ritual nouns
    "ja-vocab-n1-1208": ["kneeling in prayer","bowing deeply","making a vow","clapping hands in ritual","burning incense","offering flowers","reciting a sutra","making a pilgrimage"],

    # ja-vocab-n1-1220: 黒字 (くろじ) "(being in) the black" — finance nouns
    "ja-vocab-n1-1220": ["net loss","in the red","deficit spending","operating loss","fiscal deficit","negative balance","budget shortfall","running a debt"],

    # ja-vocab-n1-1225: 込める (こめる) "to load (a gun, etc.)" — loading/packing verbs
    "ja-vocab-n1-1225": ["to stuff","to insert","to pack","to fill","to charge","to prime","to cram","to load up"],

    # ja-vocab-n1-1231: 根拠 (こんきょ) "basis" — foundation nouns
    "ja-vocab-n1-1231": ["foundation","ground","evidence","rationale","justification","premise","support","backing"],

    # ja-vocab-n1-1234: 混血 (こんけつ) "mixed race" — heritage nouns
    "ja-vocab-n1-1234": ["pure lineage","single ethnicity","racial heritage","ethnic background","ancestry","genealogy","mixed heritage","multiethnic background"],

    # ja-vocab-n1-1241: 残高 (ざんだか) "balance" — financial account nouns
    "ja-vocab-n1-1241": ["surplus","deficit","total","sum","remainder","account balance","net worth","running total"],

    # ja-vocab-n1-1243: 詐欺 (さぎ) "fraud" — deception nouns
    "ja-vocab-n1-1243": ["deception","swindle","scam","forgery","embezzlement","extortion","hoax","forgery"],

    # ja-vocab-n1-1245: 債券 (さいけん) "bond" — financial instruments
    "ja-vocab-n1-1245": ["stock","debenture","treasury note","equity","certificate","promissory note","mortgage","share"],

    # ja-vocab-n1-1248: 再- (さい-) "re-" — prefixes for repetition
    "ja-vocab-n1-1248": ["pre-","post-","anti-","co-","counter-","semi-","sub-","over-"],

    # ja-vocab-n1-1252: 再現 (さいげん) "reappearance" — recreation nouns
    "ja-vocab-n1-1252": ["reenactment","reproduction","replica","recreation","reconstruction","simulation","duplicate","revival"],

    # ja-vocab-n1-1254: 再来 (さいらい) "return" — coming back nouns
    "ja-vocab-n1-1254": ["departure","absence","farewell","emigration","withdrawal","exit","retreat","vacation"],

    # ═══ BATCH 035 ═══════════════════════════════════════════════════════════

    # ja-vocab-n1-1275: 際限 (さいげん) "limits" — boundary nouns
    "ja-vocab-n1-1275": ["boundary","boundary line","ceiling","cap","threshold","extent","outer edge","constraint"],

    # ja-vocab-n1-1280: 澄み渡る (すみわたる) "to be clear (of a sight, sound, colour, etc.)" — clarity verbs
    "ja-vocab-n1-1280": ["to become turbid","to cloud over","to grow dim","to fade","to blur","to muddy","to darken","to haze over"],

    # ja-vocab-n1-1282: 細工 (さいく) "making" — craftsmanship nouns
    "ja-vocab-n1-1282": ["crafting","manufacturing","assembly","construction","production","fabrication","designing","fashioning"],

    # ja-vocab-n1-1283: 作戦 (さくせん) "tactics" — strategy nouns
    "ja-vocab-n1-1283": ["strategy","plan","maneuver","operation","campaign","ploy","scheme","gambit"],

    # ja-vocab-n1-1290: 錯誤 (さくご) "mistake" — error nouns
    "ja-vocab-n1-1290": ["blunder","error","lapse","slip","miscalculation","oversight","inaccuracy","fault"],

    # ja-vocab-n1-1294: 殺人 (さつじん) "murder" — crime nouns
    "ja-vocab-n1-1294": ["homicide","manslaughter","assassination","killing","slaying","execution","patricide","fratricide"],

    # ja-vocab-n1-1298: 雑木 (ぞうき) "various kinds of small trees" — vegetation nouns
    "ja-vocab-n1-1298": ["undergrowth","brushwood","scrubland","shrubbery","copse","thicket","woodland","dense foliage"],

    # ja-vocab-n1-131: キャッチ "catch" — reception/grabbing nouns
    "ja-vocab-n1-131": ["throw","release","drop","pitch","toss","fumble","pass","miss"],

    # ja-vocab-n1-1312: 産婦人科 (さんふじんか) "maternity and gynaecology department (gynecology)" — hospital departments
    "ja-vocab-n1-1312": ["orthopedics","cardiology","neurology","pediatrics","oncology","radiology","dermatology","urology"],

    # ja-vocab-n1-1326: 仕入れる (しいれる) "to buy (stock, materials, etc.)" — procurement verbs
    "ja-vocab-n1-1326": ["to sell","to distribute","to export","to donate","to dispose of","to liquidate","to auction","to consign"],

    # ja-vocab-n1-133: クイズ "quiz" — assessment nouns
    "ja-vocab-n1-133": ["examination","test","survey","questionnaire","poll","contest","competition","game show"],

    # ja-vocab-n1-1330: 仕方 (しかた) "way" — method nouns
    "ja-vocab-n1-1330": ["manner","method","approach","technique","procedure","means","path","mode"],

    # ja-vocab-n1-1332: 使い (つかい) "errand" — task nouns
    "ja-vocab-n1-1332": ["chore","mission","assignment","message","delivery","commission","task","duty"],

    # ja-vocab-n1-1333: 使命 (しめい) "purpose" — objective nouns
    "ja-vocab-n1-1333": ["mission","objective","goal","calling","vocation","duty","function","aim"],

    # ja-vocab-n1-1334: 使者 (ししゃ) "envoy" — diplomatic/messenger nouns
    "ja-vocab-n1-1334": ["ambassador","emissary","delegate","messenger","representative","courier","liaison","herald"],

    # ja-vocab-n1-1336: 使用人 (しようにん) "employee" — labor relationship nouns
    "ja-vocab-n1-1336": ["employer","contractor","manager","supervisor","owner","executive","patron","proprietor"],

    # ja-vocab-n1-1339: 担当する (たんとうする) "to be in charge of" — responsibility verbs
    "ja-vocab-n1-1339": ["to oversee","to manage","to handle","to supervise","to administer","to lead","to direct","to coordinate"],

    # ja-vocab-n1-134: ナイトクラブ "nightclub" — entertainment venues
    "ja-vocab-n1-134": ["cinema","restaurant","theater","sports bar","concert hall","arcade","bowling alley","jazz club"],

    # ja-vocab-n1-1344: 始発 (しはつ) "first departure (of the day)" — transit nouns
    "ja-vocab-n1-1344": ["last train","express service","local stop","direct route","transfer point","platform departure","scheduled service","final run"],

    # ═══ BATCH 036 ═══════════════════════════════════════════════════════════

    # ja-vocab-n1-1353: 志 (こころざし) "will" — resolve nouns
    "ja-vocab-n1-1353": ["determination","resolve","aspiration","ambition","motivation","desire","intent","spirit"],

    # ja-vocab-n1-1356: 志望 (しぼう) "wish" — desire nouns
    "ja-vocab-n1-1356": ["desire","hope","ambition","aspiration","longing","goal","preference","inclination"],

    # ja-vocab-n1-1357: 思いつき (おもいつき) "idea" — creative thought nouns
    "ja-vocab-n1-1357": ["notion","thought","inspiration","whim","impulse","insight","concept","brainwave"],

    # ja-vocab-n1-1358: 思考 (しこう) "thought" — cognition nouns
    "ja-vocab-n1-1358": ["reasoning","reflection","contemplation","deliberation","cognition","consideration","reckoning","meditation"],

    # ja-vocab-n1-1362: 示す (しめす) "indication" — signaling nouns
    "ja-vocab-n1-1362": ["signal","sign","pointer","clue","hint","marker","evidence","demonstration"],

    # ja-vocab-n1-1365: 指示 (しじ) "order" — command nouns
    "ja-vocab-n1-1365": ["instruction","directive","command","guideline","mandate","direction","ruling","decree"],

    # ja-vocab-n1-1367: 与える (あたえる) "to give (time, money, goods)" — giving verbs
    "ja-vocab-n1-1367": ["to take","to receive","to withhold","to deny","to acquire","to collect","to seize","to retain"],

    # ja-vocab-n1-1368: 施設 (しせつ) "facility" — infrastructure nouns
    "ja-vocab-n1-1368": ["equipment","building","institution","installation","plant","establishment","premises","structure"],

    # ja-vocab-n1-1371: 死産 (しざん) "stillbirth" — birth-related medical nouns
    "ja-vocab-n1-1371": ["premature birth","miscarriage","cesarean section","natural childbirth","live birth","breech birth","twin birth","induced labor"],

    # ja-vocab-n1-1373: 私 (わたし) "I" — first-person pronouns
    "ja-vocab-n1-1373": ["you","he","she","we","they","one","it","this person"],

    # ja-vocab-n1-1374: 私有 (しゆう) "private" — ownership adjectives
    "ja-vocab-n1-1374": ["public","communal","state-owned","collective","shared","municipal","national","cooperative"],

    # ja-vocab-n1-1375: 私立 (しりつ) "private" — institution type adjectives
    "ja-vocab-n1-1375": ["public","state-run","municipal","national","government-funded","nonprofit","chartered","community"],

    # ja-vocab-n1-1379: 脂肪 (しぼう) "fat" — macronutrient nouns
    "ja-vocab-n1-1379": ["protein","carbohydrate","fiber","cholesterol","vitamin","mineral","glucose","calorie"],

    # ja-vocab-n1-1380: しみじみ "very much" — emotional depth adverbs
    "ja-vocab-n1-1380": ["keenly","deeply","profoundly","sincerely","earnestly","wholeheartedly","genuinely","heartily"],

    # ja-vocab-n1-1381: 至宝 (しほう) "greatest treasure" — valued thing nouns
    "ja-vocab-n1-1381": ["priceless relic","national heirloom","cultural artifact","rare jewel","masterpiece","prized possession","crown jewel","invaluable asset"],

    # ja-vocab-n1-1383: 視察 (しさつ) "inspection" — examination nouns
    "ja-vocab-n1-1383": ["survey","review","audit","oversight","investigation","monitoring","assessment","evaluation"],

    # ja-vocab-n1-1388: 詩的 (してき) "poetic" — literary quality adjectives
    "ja-vocab-n1-1388": ["lyrical","prose-like","rhythmic","metaphorical","narrative","dramatic","elegiac","romantic"],

    # ja-vocab-n1-1394: 資金 (しきん) "funds" — financial resource nouns
    "ja-vocab-n1-1394": ["capital","budget","assets","reserves","revenue","endowment","investment","financing"],

    # ja-vocab-n1-140: コマーシャル "commercial (TV or radio advertisement)" — advertising nouns
    "ja-vocab-n1-140": ["documentary","news bulletin","weather report","sitcom","talk show","variety show","infomercial","public service announcement"],

    # ja-vocab-n1-1400: 飼育 (しいく) "breeding" — animal care nouns
    "ja-vocab-n1-1400": ["raising animals","farming","herding","livestock management","animal husbandry","keeping pets","wildlife conservation","zookeeping"],

    # ja-vocab-n1-1405: 事前 (じぜん) "prior" — time ordering adjectives/adverbs
    "ja-vocab-n1-1405": ["subsequent","following","concurrent","simultaneous","retrospective","post-event","immediate","eventual"],

    # ja-vocab-n1-1406: 事柄 (ことがら) "matter" — subject nouns
    "ja-vocab-n1-1406": ["affair","topic","issue","subject","concern","case","point","theme"],

    # ja-vocab-n1-1410: 字画 (じかく) "strokes in a Chinese character" — writing system nouns
    "ja-vocab-n1-1410": ["radical components","phonetic element","semantic marker","calligraphic form","brush technique","character variant","ink strokes","ideographic element"],

    # ja-vocab-n1-1414: 時の話題 (ときのわだい) "hot topic" — current affairs nouns
    "ja-vocab-n1-1414": ["old news","settled matter","resolved issue","past controversy","forgotten scandal","outdated debate","historical event","archived story"],

    # ja-vocab-n1-1415: 持てる (もてる) "to be able to possess (hold, get, etc.)" — possession verbs
    "ja-vocab-n1-1415": ["to release","to surrender","to relinquish","to abandon","to forfeit","to discard","to yield","to let go of"],

    # ja-vocab-n1-1419: 時刻表 (じこくひょう) "timetable" — scheduling nouns
    "ja-vocab-n1-1419": ["calendar","agenda","itinerary","roster","program","lineup","syllabus","planner"],

    # ja-vocab-n1-1421: 次 (つぎ) "next" — sequential adjectives
    "ja-vocab-n1-1421": ["previous","prior","current","final","last","former","preceding","initial"],

    # ja-vocab-n1-1423: 治まる (おさまる) "to die down (storm, anger, conflict, etc.)" — calming verbs
    "ja-vocab-n1-1423": ["to escalate","to intensify","to flare up","to erupt","to worsen","to surge","to spread","to explode"],

    # ja-vocab-n1-1430: 自我 (じが) "ego" — psychology nouns
    "ja-vocab-n1-1430": ["superego","id","persona","psyche","consciousness","identity","self-image","alter ego"],

    # ja-vocab-n1-1432: 自惚れ (うぬぼれ) "conceit" — self-image nouns
    "ja-vocab-n1-1432": ["modesty","humility","self-deprecation","diffidence","shyness","bashfulness","reserve","meekness"],

    # ja-vocab-n1-1437: 自転 (じてん) "rotation (on an axis)" — rotational motion nouns
    "ja-vocab-n1-1437": ["revolution (around another body)","translation","oscillation","precession","vibration","linear motion","orbital drift","tidal locking"],

    # ja-vocab-n1-1439: 自律 (じりつ) "autonomy (in Kantian ethics)" — ethical philosophy nouns
    "ja-vocab-n1-1439": ["heteronomy","obedience","submission","conformity","deference","compliance","dependency","servitude"],

    # ja-vocab-n1-1441: 辞職 (じしょく) "resignation" — employment status nouns
    "ja-vocab-n1-1441": ["appointment","promotion","retention","reinstatement","tenure","recruitment","engagement","hiring"],

    # ja-vocab-n1-1443: 式場 (しきじょう) "ceremonial hall (e.g. wedding, funeral)" — venue nouns
    "ja-vocab-n1-1443": ["gymnasium","lecture hall","conference room","waiting room","storage facility","parking garage","rooftop garden","utility room"],
}


def needs_fix(record):
    """Return True if any distractor is a placeholder or derivative pattern."""
    a = record["a"].lower().strip()
    for d in record["d"]:
        dl = d.lower()
        # placeholder variants
        if "option-" in dl:
            return True
        if dl in ("allied term", "variant meaning", "kindred concept",
                  "parallel concept", "associated meaning"):
            return True
        # near-synonym derivatives
        if (("similar " in dl and a in dl) or
            ("form of " in dl and a in dl) or
            ("type of " in dl and a in dl) or
            ("variant of " in dl and a in dl) or
            ("style of " in dl and a in dl) or
            ("example of " in dl and a in dl) or
            (dl.endswith("-like") and a in dl)):
            return True
        # long-form answer + verb particle patterns
        if len(a) > 6:
            for suffix in (" away", " out", " up", " back"):
                if dl == a + suffix:
                    return True
            for prefix in ("to continue ", "to help ", "to attempt ", "to cause "):
                if dl.startswith(prefix) and a in dl:
                    return True
        # bad grammar-phrase distractors
        if d.startswith((
            "and at the same", "in addition to that",
            "it is not the case", "on the other hand",
            "when all is said", "in the final analysis",
            "the key point being", "as far as I know"
        )):
            return True
    return False


def process_batch(batch_num):
    src = f"{BATCHES_DIR}/batch-0{batch_num}.jsonl"
    dst = f"{RESULTS_DIR}/batch-0{batch_num}.jsonl"

    with open(src) as f:
        records = [json.loads(line) for line in f if line.strip()]

    out_lines = []
    fixed = 0
    for rec in records:
        rid = rec["id"]
        if needs_fix(rec):
            if rid in REPLACEMENTS:
                new_d = REPLACEMENTS[rid]
                # Ensure no duplicates and not equal to answer
                ans_lower = rec["a"].lower().strip()
                new_d = [x for x in dict.fromkeys(new_d) if x.lower().strip() != ans_lower]
                result = {
                    "id": rid,
                    "q": None,
                    "a": None,
                    "d": new_d,
                    "e": None,
                    "l1": None,
                    "l2": None,
                    "i": None,
                }
                fixed += 1
            else:
                # No replacement defined — pass through with existing d (flag for review)
                print(f"  WARNING: no replacement defined for {rid} ({rec['a']})", file=sys.stderr)
                result = {
                    "id": rid,
                    "q": None,
                    "a": None,
                    "d": rec["d"],
                    "e": None,
                    "l1": None,
                    "l2": None,
                    "i": None,
                }
        else:
            # Clean record — emit with full d array (unchanged), all others null
            result = {
                "id": rid,
                "q": None,
                "a": None,
                "d": rec["d"],
                "e": None,
                "l1": None,
                "l2": None,
                "i": None,
            }
        out_lines.append(json.dumps(result, ensure_ascii=False))

    os.makedirs(RESULTS_DIR, exist_ok=True)
    with open(dst, "w") as f:
        f.write("\n".join(out_lines) + "\n")

    print(f"batch-0{batch_num}: wrote {len(out_lines)} records, fixed {fixed} distractor sets → {dst}")
    return fixed


if __name__ == "__main__":
    total = 0
    for n in [32, 33, 34, 35, 36]:
        total += process_batch(n)
    print(f"\nTotal distractor sets replaced: {total}")
