#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ────────────────────────────────────────────────
// 200 NEW JLPT N3 vocabulary words (ja-n3-201 through ja-n3-400)
// These are all DIFFERENT from entries ja-n3-001 through ja-n3-200.
// ────────────────────────────────────────────────

/** @type {Array<{word: string, reading: string, meaning: string, explanation: string, distractors: string[]}>} */
const verbs = [
  {
    word: '増える',
    reading: 'ふえる',
    meaning: 'to increase',
    explanation: '増える (fueru) is an intransitive verb meaning for something to grow in number or quantity on its own.',
    distractors: ['to decrease', 'to remain', 'to shrink', 'to disappear', 'to stabilize', 'to double', 'to overflow', 'to multiply'],
  },
  {
    word: '減る',
    reading: 'へる',
    meaning: 'to decrease',
    explanation: '減る (heru) is an intransitive verb meaning for something to diminish in number or quantity.',
    distractors: ['to increase', 'to grow', 'to expand', 'to remain', 'to double', 'to stabilize', 'to overflow', 'to accumulate'],
  },
  {
    word: '役立つ',
    reading: 'やくだつ',
    meaning: 'to be useful',
    explanation: '役立つ (yakudatsu) means to serve a purpose or be of practical help.',
    distractors: ['to be useless', 'to hinder', 'to waste', 'to interfere', 'to complicate', 'to confuse', 'to delay', 'to obstruct'],
  },
  {
    word: '申し込む',
    reading: 'もうしこむ',
    meaning: 'to apply / to request',
    explanation: '申し込む (moushikomu) means to formally submit an application or make a request.',
    distractors: ['to cancel', 'to reject', 'to withdraw', 'to postpone', 'to complain', 'to inquire', 'to approve', 'to register'],
  },
  {
    word: '取り替える',
    reading: 'とりかえる',
    meaning: 'to exchange / to replace',
    explanation: '取り替える (torikaeru) means to swap one thing for another or to replace a broken item.',
    distractors: ['to keep', 'to repair', 'to discard', 'to borrow', 'to return', 'to arrange', 'to collect', 'to purchase'],
  },
  {
    word: '泊まる',
    reading: 'とまる',
    meaning: 'to stay overnight',
    explanation: '泊まる (tomaru) means to lodge or spend the night somewhere, such as a hotel or friend\'s house.',
    distractors: ['to visit', 'to leave', 'to check in', 'to depart', 'to rest', 'to sleep', 'to arrive', 'to camp'],
  },
  {
    word: '乾かす',
    reading: 'かわかす',
    meaning: 'to dry (something)',
    explanation: '乾かす (kawakasu) is the transitive form meaning to make something dry, like hanging laundry.',
    distractors: ['to wet', 'to soak', 'to rinse', 'to wash', 'to steam', 'to iron', 'to fold', 'to hang'],
  },
  {
    word: '騒ぐ',
    reading: 'さわぐ',
    meaning: 'to make noise / to be rowdy',
    explanation: '騒ぐ (sawagu) means to create a disturbance or commotion, being loud and disorderly.',
    distractors: ['to be quiet', 'to whisper', 'to listen', 'to sleep', 'to rest', 'to complain', 'to sing', 'to celebrate'],
  },
  {
    word: '悩む',
    reading: 'なやむ',
    meaning: 'to worry / to be troubled',
    explanation: '悩む (nayamu) means to feel anxious or distressed about a problem or decision.',
    distractors: ['to relax', 'to decide', 'to forget', 'to celebrate', 'to laugh', 'to sleep', 'to accept', 'to ignore'],
  },
  {
    word: '預ける',
    reading: 'あずける',
    meaning: 'to deposit / to entrust',
    explanation: '預ける (azukeru) means to leave something in someone else\'s care or to deposit money at a bank.',
    distractors: ['to withdraw', 'to borrow', 'to steal', 'to carry', 'to hide', 'to lose', 'to hold', 'to keep'],
  },
  {
    word: '飾る',
    reading: 'かざる',
    meaning: 'to decorate',
    explanation: '飾る (kazaru) means to adorn or embellish a place or object to make it look attractive.',
    distractors: ['to clean', 'to destroy', 'to remove', 'to paint', 'to build', 'to arrange', 'to hide', 'to cover'],
  },
  {
    word: '磨く',
    reading: 'みがく',
    meaning: 'to polish / to brush',
    explanation: '磨く (migaku) means to make something shine by rubbing it, or to brush teeth.',
    distractors: ['to dirty', 'to scratch', 'to break', 'to wash', 'to rinse', 'to scrub', 'to wipe', 'to paint'],
  },
  {
    word: '混ぜる',
    reading: 'まぜる',
    meaning: 'to mix',
    explanation: '混ぜる (mazeru) means to combine two or more things together into one mixture.',
    distractors: ['to separate', 'to pour', 'to stir', 'to filter', 'to strain', 'to dissolve', 'to melt', 'to boil'],
  },
  {
    word: '包む',
    reading: 'つつむ',
    meaning: 'to wrap',
    explanation: '包む (tsutsumu) means to cover something by wrapping it in paper, cloth, or another material.',
    distractors: ['to unwrap', 'to tear', 'to fold', 'to cut', 'to tie', 'to open', 'to seal', 'to stack'],
  },
  {
    word: '吹く',
    reading: 'ふく',
    meaning: 'to blow',
    explanation: '吹く (fuku) means to move air with the mouth or for wind to blow.',
    distractors: ['to suck', 'to breathe', 'to inhale', 'to whistle', 'to cough', 'to sneeze', 'to sigh', 'to hum'],
  },
  {
    word: '押す',
    reading: 'おす',
    meaning: 'to push / to press',
    explanation: '押す (osu) means to exert force against something to move it away or to press a button.',
    distractors: ['to pull', 'to lift', 'to hold', 'to touch', 'to grab', 'to release', 'to squeeze', 'to tap'],
  },
  {
    word: '引く',
    reading: 'ひく',
    meaning: 'to pull / to draw',
    explanation: '引く (hiku) means to exert force to bring something toward oneself, or to draw a line.',
    distractors: ['to push', 'to throw', 'to drop', 'to lift', 'to carry', 'to release', 'to press', 'to turn'],
  },
  {
    word: '投げる',
    reading: 'なげる',
    meaning: 'to throw',
    explanation: '投げる (nageru) means to propel something through the air by a motion of the arm.',
    distractors: ['to catch', 'to drop', 'to kick', 'to roll', 'to hold', 'to carry', 'to hit', 'to bounce'],
  },
  {
    word: '替える',
    reading: 'かえる',
    meaning: 'to change / to replace',
    explanation: '替える (kaeru) means to substitute one thing for another or to switch items.',
    distractors: ['to keep', 'to repair', 'to add', 'to remove', 'to copy', 'to fix', 'to match', 'to return'],
  },
  {
    word: '乗り換える',
    reading: 'のりかえる',
    meaning: 'to transfer (vehicles)',
    explanation: '乗り換える (norikaeru) means to change from one train, bus, or vehicle to another.',
    distractors: ['to get off', 'to get on', 'to walk', 'to drive', 'to stop', 'to wait', 'to arrive', 'to depart'],
  },
  {
    word: '通り過ぎる',
    reading: 'とおりすぎる',
    meaning: 'to pass by / to go past',
    explanation: '通り過ぎる (toorisugiru) means to move past a point without stopping.',
    distractors: ['to stop at', 'to arrive at', 'to return to', 'to enter', 'to approach', 'to wait at', 'to turn at', 'to visit'],
  },
  {
    word: '追いかける',
    reading: 'おいかける',
    meaning: 'to chase / to pursue',
    explanation: '追いかける (oikakeru) means to run after someone or something to catch them.',
    distractors: ['to flee', 'to hide', 'to wait', 'to follow', 'to watch', 'to escape', 'to search', 'to catch'],
  },
  {
    word: '見つかる',
    reading: 'みつかる',
    meaning: 'to be found / to be discovered',
    explanation: '見つかる (mitsukaru) is the intransitive form meaning something is discovered or located.',
    distractors: ['to be lost', 'to be hidden', 'to disappear', 'to be stolen', 'to be forgotten', 'to be mistaken', 'to be broken', 'to be missed'],
  },
  {
    word: '見つける',
    reading: 'みつける',
    meaning: 'to find / to discover',
    explanation: '見つける (mitsukeru) is the transitive form meaning to actively locate or discover something.',
    distractors: ['to lose', 'to hide', 'to miss', 'to overlook', 'to forget', 'to ignore', 'to search', 'to notice'],
  },
  {
    word: '飽きる',
    reading: 'あきる',
    meaning: 'to get tired of / to lose interest',
    explanation: '飽きる (akiru) means to become bored with or lose enthusiasm for something after doing it too much.',
    distractors: ['to enjoy', 'to begin', 'to continue', 'to discover', 'to prefer', 'to choose', 'to admire', 'to try'],
  },
  {
    word: '似合う',
    reading: 'にあう',
    meaning: 'to suit / to look good on',
    explanation: '似合う (niau) means that something matches well or looks good on a person.',
    distractors: ['to clash with', 'to dislike', 'to differ from', 'to outgrow', 'to wear', 'to choose', 'to prefer', 'to buy'],
  },
  {
    word: '気づく',
    reading: 'きづく',
    meaning: 'to notice / to realize',
    explanation: '気づく (kidzuku) means to become aware of something that was not previously noticed.',
    distractors: ['to ignore', 'to forget', 'to overlook', 'to misunderstand', 'to assume', 'to doubt', 'to remember', 'to guess'],
  },
  {
    word: '思いつく',
    reading: 'おもいつく',
    meaning: 'to come up with / to think of',
    explanation: '思いつく (omoitsuku) means for an idea or plan to suddenly occur to someone.',
    distractors: ['to forget', 'to remember', 'to plan', 'to decide', 'to doubt', 'to worry', 'to expect', 'to hope'],
  },
  {
    word: '戻る',
    reading: 'もどる',
    meaning: 'to return / to go back',
    explanation: '戻る (modoru) means to go back to a previous place or state.',
    distractors: ['to leave', 'to advance', 'to arrive', 'to depart', 'to continue', 'to stay', 'to wander', 'to proceed'],
  },
  {
    word: '叶う',
    reading: 'かなう',
    meaning: 'to come true / to be fulfilled',
    explanation: '叶う (kanau) means for a wish, dream, or hope to be realized or granted.',
    distractors: ['to fail', 'to break', 'to forget', 'to give up', 'to lose', 'to fade', 'to collapse', 'to disappear'],
  },
  {
    word: '落ち着く',
    reading: 'おちつく',
    meaning: 'to calm down / to settle',
    explanation: '落ち着く (ochitsuku) means to become composed and peaceful after being agitated.',
    distractors: ['to panic', 'to worry', 'to rush', 'to argue', 'to cry', 'to shout', 'to tremble', 'to hesitate'],
  },
  {
    word: '興奮する',
    reading: 'こうふんする',
    meaning: 'to get excited',
    explanation: '興奮する (koufun suru) means to become emotionally aroused or thrilled about something.',
    distractors: ['to calm down', 'to relax', 'to sleep', 'to bore', 'to ignore', 'to forget', 'to withdraw', 'to rest'],
  },
  {
    word: '連絡する',
    reading: 'れんらくする',
    meaning: 'to contact / to get in touch',
    explanation: '連絡する (renraku suru) means to communicate with someone by phone, email, or other means.',
    distractors: ['to ignore', 'to avoid', 'to forget', 'to meet', 'to visit', 'to greet', 'to wave', 'to introduce'],
  },
  {
    word: '紹介する',
    reading: 'しょうかいする',
    meaning: 'to introduce',
    explanation: '紹介する (shoukai suru) means to present one person to another or to introduce a topic.',
    distractors: ['to conceal', 'to meet', 'to separate', 'to greet', 'to describe', 'to explain', 'to recommend', 'to mention'],
  },
  {
    word: '参加する',
    reading: 'さんかする',
    meaning: 'to participate',
    explanation: '参加する (sanka suru) means to take part in an event, activity, or group.',
    distractors: ['to withdraw', 'to observe', 'to organize', 'to cancel', 'to refuse', 'to skip', 'to host', 'to watch'],
  },
  {
    word: '反対する',
    reading: 'はんたいする',
    meaning: 'to oppose',
    explanation: '反対する (hantai suru) means to be against something or to express disagreement.',
    distractors: ['to agree', 'to support', 'to accept', 'to approve', 'to comply', 'to follow', 'to allow', 'to permit'],
  },
  {
    word: '賛成する',
    reading: 'さんせいする',
    meaning: 'to agree / to approve',
    explanation: '賛成する (sansei suru) means to express agreement or give approval to a plan or idea.',
    distractors: ['to oppose', 'to refuse', 'to deny', 'to reject', 'to doubt', 'to complain', 'to hesitate', 'to resist'],
  },
  {
    word: '相談する',
    reading: 'そうだんする',
    meaning: 'to consult / to discuss',
    explanation: '相談する (soudan suru) means to seek advice from someone or discuss a matter together.',
    distractors: ['to decide alone', 'to argue', 'to ignore', 'to command', 'to demand', 'to instruct', 'to announce', 'to report'],
  },
  {
    word: '我慢する',
    reading: 'がまんする',
    meaning: 'to endure / to be patient',
    explanation: '我慢する (gaman suru) means to tolerate something unpleasant or to exercise self-restraint.',
    distractors: ['to give up', 'to complain', 'to quit', 'to cry', 'to protest', 'to escape', 'to explode', 'to surrender'],
  },
  {
    word: '注意する',
    reading: 'ちゅういする',
    meaning: 'to be careful / to warn',
    explanation: '注意する (chuui suru) means to pay attention or to caution someone about a danger.',
    distractors: ['to ignore', 'to forget', 'to overlook', 'to dismiss', 'to risk', 'to rush', 'to provoke', 'to challenge'],
  },
  {
    word: '感動する',
    reading: 'かんどうする',
    meaning: 'to be moved / to be touched',
    explanation: '感動する (kandou suru) means to be deeply emotionally moved by something beautiful or impressive.',
    distractors: ['to be bored', 'to be annoyed', 'to be confused', 'to be upset', 'to be indifferent', 'to be disappointed', 'to be frightened', 'to be amused'],
  },
  {
    word: '利用する',
    reading: 'りようする',
    meaning: 'to use / to utilize',
    explanation: '利用する (riyou suru) means to make use of something available, such as a service or facility.',
    distractors: ['to waste', 'to ignore', 'to avoid', 'to discard', 'to create', 'to repair', 'to replace', 'to purchase'],
  },
  {
    word: '輸出する',
    reading: 'ゆしゅつする',
    meaning: 'to export',
    explanation: '輸出する (yushutsu suru) means to send goods or products to another country for sale.',
    distractors: ['to import', 'to produce', 'to store', 'to buy', 'to consume', 'to manufacture', 'to deliver', 'to transport'],
  },
  {
    word: '輸入する',
    reading: 'ゆにゅうする',
    meaning: 'to import',
    explanation: '輸入する (yunyuu suru) means to bring goods or products from another country.',
    distractors: ['to export', 'to produce', 'to sell', 'to manufacture', 'to discard', 'to consume', 'to deliver', 'to distribute'],
  },
  {
    word: '計算する',
    reading: 'けいさんする',
    meaning: 'to calculate',
    explanation: '計算する (keisan suru) means to determine a number or amount by using mathematics.',
    distractors: ['to guess', 'to estimate', 'to measure', 'to count', 'to predict', 'to record', 'to summarize', 'to analyze'],
  },
  {
    word: '翻訳する',
    reading: 'ほんやくする',
    meaning: 'to translate',
    explanation: '翻訳する (honyaku suru) means to convert text or speech from one language to another.',
    distractors: ['to interpret', 'to explain', 'to summarize', 'to copy', 'to read', 'to write', 'to edit', 'to publish'],
  },
  {
    word: '暗記する',
    reading: 'あんきする',
    meaning: 'to memorize',
    explanation: '暗記する (anki suru) means to commit something to memory so it can be recalled without reference.',
    distractors: ['to forget', 'to review', 'to understand', 'to read', 'to study', 'to guess', 'to recite', 'to copy'],
  },
  {
    word: '復習する',
    reading: 'ふくしゅうする',
    meaning: 'to review (studies)',
    explanation: '復習する (fukushuu suru) means to go over previously learned material again to reinforce understanding.',
    distractors: ['to preview', 'to skip', 'to forget', 'to teach', 'to memorize', 'to test', 'to practice', 'to study'],
  },
  {
    word: '予約する',
    reading: 'よやくする',
    meaning: 'to reserve / to book',
    explanation: '予約する (yoyaku suru) means to arrange in advance to have a seat, room, or appointment.',
    distractors: ['to cancel', 'to confirm', 'to postpone', 'to wait', 'to check in', 'to arrive', 'to order', 'to request'],
  },
  {
    word: '準備する',
    reading: 'じゅんびする',
    meaning: 'to prepare',
    explanation: '準備する (junbi suru) means to get ready for something by making necessary arrangements.',
    distractors: ['to finish', 'to delay', 'to forget', 'to start', 'to cancel', 'to skip', 'to rush', 'to complete'],
  },
  {
    word: '移動する',
    reading: 'いどうする',
    meaning: 'to move / to relocate',
    explanation: '移動する (idou suru) means to change one\'s position or location from one place to another.',
    distractors: ['to stay', 'to stop', 'to wait', 'to rest', 'to settle', 'to return', 'to arrive', 'to travel'],
  },
  {
    word: '到着する',
    reading: 'とうちゃくする',
    meaning: 'to arrive',
    explanation: '到着する (touchaku suru) means to reach a destination after a journey.',
    distractors: ['to depart', 'to leave', 'to pass through', 'to approach', 'to travel', 'to transfer', 'to delay', 'to miss'],
  },
  {
    word: '出発する',
    reading: 'しゅっぱつする',
    meaning: 'to depart',
    explanation: '出発する (shuppatsu suru) means to leave a place to begin a journey or trip.',
    distractors: ['to arrive', 'to return', 'to stay', 'to wait', 'to stop', 'to rest', 'to cancel', 'to delay'],
  },
  {
    word: '延期する',
    reading: 'えんきする',
    meaning: 'to postpone',
    explanation: '延期する (enki suru) means to delay or push back an event to a later date.',
    distractors: ['to cancel', 'to advance', 'to schedule', 'to confirm', 'to begin', 'to complete', 'to organize', 'to rush'],
  },
  {
    word: '中止する',
    reading: 'ちゅうしする',
    meaning: 'to cancel / to discontinue',
    explanation: '中止する (chuushi suru) means to stop or call off something that was planned.',
    distractors: ['to continue', 'to start', 'to resume', 'to postpone', 'to confirm', 'to schedule', 'to begin', 'to repeat'],
  },
  {
    word: '完成する',
    reading: 'かんせいする',
    meaning: 'to complete / to finish',
    explanation: '完成する (kansei suru) means to bring something to its finished state, such as a building or project.',
    distractors: ['to start', 'to abandon', 'to delay', 'to plan', 'to design', 'to begin', 'to fail', 'to destroy'],
  },
  {
    word: '焼ける',
    reading: 'やける',
    meaning: 'to be burned / to be baked',
    explanation: '焼ける (yakeru) is the intransitive form meaning something burns or gets baked on its own.',
    distractors: ['to freeze', 'to cool', 'to melt', 'to boil', 'to steam', 'to dry', 'to soak', 'to rot'],
  },
  {
    word: '壊す',
    reading: 'こわす',
    meaning: 'to break / to destroy',
    explanation: '壊す (kowasu) is a transitive verb meaning to damage or destroy something intentionally.',
    distractors: ['to repair', 'to build', 'to fix', 'to protect', 'to create', 'to save', 'to clean', 'to arrange'],
  },
  {
    word: '壊れる',
    reading: 'こわれる',
    meaning: 'to be broken / to break down',
    explanation: '壊れる (kowareru) is the intransitive form meaning something breaks or stops working on its own.',
    distractors: ['to be fixed', 'to be built', 'to work', 'to function', 'to improve', 'to last', 'to survive', 'to strengthen'],
  },
  {
    word: '汚す',
    reading: 'よごす',
    meaning: 'to make dirty / to stain',
    explanation: '汚す (yogosu) is a transitive verb meaning to make something unclean or contaminated.',
    distractors: ['to clean', 'to wash', 'to polish', 'to rinse', 'to wipe', 'to tidy', 'to purify', 'to bleach'],
  },
  {
    word: '汚れる',
    reading: 'よごれる',
    meaning: 'to get dirty / to become stained',
    explanation: '汚れる (yogoreru) is the intransitive form meaning something becomes dirty on its own.',
    distractors: ['to get clean', 'to shine', 'to dry', 'to fade', 'to brighten', 'to improve', 'to clear up', 'to refresh'],
  },
  {
    word: '植える',
    reading: 'うえる',
    meaning: 'to plant',
    explanation: '植える (ueru) means to put a seed, seedling, or plant into the ground to grow.',
    distractors: ['to harvest', 'to cut', 'to water', 'to dig', 'to mow', 'to trim', 'to uproot', 'to gather'],
  },
  {
    word: '育つ',
    reading: 'そだつ',
    meaning: 'to grow up / to be raised',
    explanation: '育つ (sodatsu) is the intransitive counterpart of 育てる, meaning to grow or develop naturally.',
    distractors: ['to shrink', 'to age', 'to decline', 'to weaken', 'to stop', 'to regress', 'to fade', 'to stagnate'],
  },
  {
    word: '染める',
    reading: 'そめる',
    meaning: 'to dye',
    explanation: '染める (someru) means to change the color of fabric, hair, or other materials using dye.',
    distractors: ['to bleach', 'to wash', 'to dry', 'to iron', 'to fold', 'to sew', 'to cut', 'to weave'],
  },
  {
    word: '縫う',
    reading: 'ぬう',
    meaning: 'to sew',
    explanation: '縫う (nuu) means to join fabric together using a needle and thread.',
    distractors: ['to cut', 'to tear', 'to iron', 'to fold', 'to dye', 'to weave', 'to wash', 'to knit'],
  },
  {
    word: '組む',
    reading: 'くむ',
    meaning: 'to assemble / to cross (arms)',
    explanation: '組む (kumu) means to put together parts to form a whole, or to fold arms or cross legs.',
    distractors: ['to separate', 'to unfold', 'to break apart', 'to loosen', 'to untie', 'to remove', 'to stretch', 'to bend'],
  },
  {
    word: '抱く',
    reading: 'だく',
    meaning: 'to hold / to embrace',
    explanation: '抱く (daku) means to hold someone closely in one\'s arms, or to harbor a feeling.',
    distractors: ['to release', 'to push away', 'to avoid', 'to drop', 'to shake', 'to wave', 'to point', 'to touch'],
  },
  {
    word: '撫でる',
    reading: 'なでる',
    meaning: 'to stroke / to pat',
    explanation: '撫でる (naderu) means to gently touch or rub something with the hand.',
    distractors: ['to hit', 'to scratch', 'to pinch', 'to poke', 'to slap', 'to grab', 'to push', 'to squeeze'],
  },
  {
    word: '握る',
    reading: 'にぎる',
    meaning: 'to grip / to grasp',
    explanation: '握る (nigiru) means to hold something tightly in one\'s hand.',
    distractors: ['to release', 'to drop', 'to throw', 'to touch', 'to point', 'to wave', 'to fold', 'to open'],
  },
  {
    word: '振る',
    reading: 'ふる',
    meaning: 'to wave / to shake',
    explanation: '振る (furu) means to move something back and forth, such as waving a hand or shaking a bottle.',
    distractors: ['to hold still', 'to drop', 'to catch', 'to squeeze', 'to press', 'to fold', 'to twist', 'to lift'],
  },
  {
    word: '鳴る',
    reading: 'なる',
    meaning: 'to ring / to sound',
    explanation: '鳴る (naru) means for a bell, phone, alarm, or instrument to produce sound.',
    distractors: ['to be silent', 'to stop', 'to break', 'to turn off', 'to vibrate', 'to flash', 'to glow', 'to fade'],
  },
  {
    word: '光る',
    reading: 'ひかる',
    meaning: 'to shine / to glow',
    explanation: '光る (hikaru) means to emit or reflect light, to sparkle or glitter.',
    distractors: ['to darken', 'to fade', 'to dim', 'to disappear', 'to shadow', 'to hide', 'to melt', 'to burn'],
  },
  {
    word: '揺れる',
    reading: 'ゆれる',
    meaning: 'to shake / to sway',
    explanation: '揺れる (yureru) means to move back and forth unsteadily, as in an earthquake.',
    distractors: ['to stand still', 'to freeze', 'to stop', 'to harden', 'to settle', 'to balance', 'to stabilize', 'to strengthen'],
  },
  {
    word: '溶ける',
    reading: 'とける',
    meaning: 'to melt / to dissolve',
    explanation: '溶ける (tokeru) means for a solid to become liquid from heat or for a substance to dissolve in liquid.',
    distractors: ['to freeze', 'to harden', 'to solidify', 'to thicken', 'to cool', 'to dry', 'to evaporate', 'to condense'],
  },
  {
    word: '凍る',
    reading: 'こおる',
    meaning: 'to freeze',
    explanation: '凍る (kooru) means for a liquid to become solid due to cold temperature.',
    distractors: ['to melt', 'to boil', 'to evaporate', 'to heat', 'to flow', 'to pour', 'to drip', 'to warm'],
  },
  {
    word: '腐る',
    reading: 'くさる',
    meaning: 'to rot / to decay',
    explanation: '腐る (kusaru) means for food or organic matter to decompose and become inedible.',
    distractors: ['to ripen', 'to freshen', 'to grow', 'to dry', 'to cook', 'to ferment', 'to preserve', 'to freeze'],
  },
  {
    word: '枯れる',
    reading: 'かれる',
    meaning: 'to wither / to die (plants)',
    explanation: '枯れる (kareru) means for a plant to dry up and die from lack of water or age.',
    distractors: ['to bloom', 'to grow', 'to sprout', 'to ripen', 'to flower', 'to spread', 'to thrive', 'to bud'],
  },
  {
    word: '叩く',
    reading: 'たたく',
    meaning: 'to hit / to knock',
    explanation: '叩く (tataku) means to strike something with the hand or an object, or to knock on a door.',
    distractors: ['to stroke', 'to touch', 'to hold', 'to rub', 'to press', 'to squeeze', 'to wave', 'to pat'],
  },
  {
    word: '潰す',
    reading: 'つぶす',
    meaning: 'to crush / to smash',
    explanation: '潰す (tsubusu) means to press or squeeze something until it is flat or broken.',
    distractors: ['to inflate', 'to expand', 'to build', 'to stretch', 'to fill', 'to shape', 'to repair', 'to mold'],
  },
  {
    word: '散る',
    reading: 'ちる',
    meaning: 'to scatter / to fall (petals)',
    explanation: '散る (chiru) means for leaves, petals, or things to scatter and fall, often poetically.',
    distractors: ['to gather', 'to bloom', 'to grow', 'to pile up', 'to stick', 'to stay', 'to rise', 'to collect'],
  },
]

/** @type {Array<{word: string, reading: string, meaning: string, explanation: string, distractors: string[]}>} */
const nouns = [
  {
    word: '状態',
    reading: 'じょうたい',
    meaning: 'condition / state',
    explanation: '状態 (joutai) refers to the current situation or condition of something.',
    distractors: ['process', 'change', 'result', 'cause', 'method', 'reason', 'purpose', 'event'],
  },
  {
    word: '方針',
    reading: 'ほうしん',
    meaning: 'policy / direction',
    explanation: '方針 (houshin) refers to a guiding principle or course of action for an organization.',
    distractors: ['opinion', 'suggestion', 'rule', 'law', 'method', 'theory', 'plan', 'strategy'],
  },
  {
    word: '材料',
    reading: 'ざいりょう',
    meaning: 'material / ingredient',
    explanation: '材料 (zairyou) refers to raw substances used to make or cook something.',
    distractors: ['product', 'tool', 'recipe', 'result', 'method', 'equipment', 'sample', 'portion'],
  },
  {
    word: '道具',
    reading: 'どうぐ',
    meaning: 'tool / instrument',
    explanation: '道具 (dougu) refers to a device or implement used for a particular task.',
    distractors: ['material', 'machine', 'vehicle', 'weapon', 'furniture', 'container', 'device', 'appliance'],
  },
  {
    word: '機械',
    reading: 'きかい',
    meaning: 'machine / machinery',
    explanation: '機械 (kikai) refers to a mechanical device that performs a task, often powered by electricity.',
    distractors: ['tool', 'vehicle', 'computer', 'robot', 'engine', 'device', 'equipment', 'appliance'],
  },
  {
    word: '製品',
    reading: 'せいひん',
    meaning: 'product / manufactured goods',
    explanation: '製品 (seihin) refers to something that has been made or manufactured for sale.',
    distractors: ['material', 'ingredient', 'tool', 'package', 'sample', 'order', 'brand', 'model'],
  },
  {
    word: '商品',
    reading: 'しょうひん',
    meaning: 'goods / merchandise',
    explanation: '商品 (shouhin) refers to items for sale in a store or market.',
    distractors: ['gift', 'sample', 'material', 'ingredient', 'receipt', 'coupon', 'brand', 'advertisement'],
  },
  {
    word: '品物',
    reading: 'しなもの',
    meaning: 'article / goods',
    explanation: '品物 (shinamono) is a general term for physical items or articles.',
    distractors: ['money', 'service', 'information', 'receipt', 'order', 'delivery', 'package', 'material'],
  },
  {
    word: '荷物',
    reading: 'にもつ',
    meaning: 'luggage / package',
    explanation: '荷物 (nimotsu) refers to bags, suitcases, or parcels that someone carries.',
    distractors: ['furniture', 'souvenir', 'ticket', 'document', 'receipt', 'clothing', 'equipment', 'supply'],
  },
  {
    word: '空気',
    reading: 'くうき',
    meaning: 'air / atmosphere',
    explanation: '空気 (kuuki) refers to the invisible gaseous substance surrounding the earth, or the mood of a place.',
    distractors: ['water', 'wind', 'sky', 'cloud', 'smoke', 'steam', 'oxygen', 'weather'],
  },
  {
    word: '温度',
    reading: 'おんど',
    meaning: 'temperature',
    explanation: '温度 (ondo) refers to the degree of heat or cold measured on a scale.',
    distractors: ['humidity', 'pressure', 'climate', 'weather', 'heat', 'cold', 'degree', 'warmth'],
  },
  {
    word: '湿度',
    reading: 'しつど',
    meaning: 'humidity',
    explanation: '湿度 (shitsudo) refers to the amount of moisture in the air.',
    distractors: ['temperature', 'pressure', 'rainfall', 'dryness', 'climate', 'weather', 'wind speed', 'dew'],
  },
  {
    word: '汚染',
    reading: 'おせん',
    meaning: 'pollution / contamination',
    explanation: '汚染 (osen) refers to the introduction of harmful substances into the environment.',
    distractors: ['purification', 'recycling', 'conservation', 'protection', 'sanitation', 'cleaning', 'prevention', 'restoration'],
  },
  {
    word: '年代',
    reading: 'ねんだい',
    meaning: 'era / age / decade',
    explanation: '年代 (nendai) refers to a period of time, often expressed as a decade or generation.',
    distractors: ['century', 'moment', 'season', 'year', 'date', 'time', 'period', 'generation'],
  },
  {
    word: '時代',
    reading: 'じだい',
    meaning: 'era / period / age',
    explanation: '時代 (jidai) refers to a distinct historical period with particular characteristics.',
    distractors: ['moment', 'season', 'year', 'century', 'generation', 'date', 'day', 'future'],
  },
  {
    word: '歴史',
    reading: 'れきし',
    meaning: 'history',
    explanation: '歴史 (rekishi) refers to the study or record of past events.',
    distractors: ['geography', 'science', 'tradition', 'culture', 'legend', 'myth', 'memory', 'record'],
  },
  {
    word: '伝統',
    reading: 'でんとう',
    meaning: 'tradition',
    explanation: '伝統 (dentou) refers to customs or beliefs passed down through generations.',
    distractors: ['culture', 'history', 'religion', 'ceremony', 'festival', 'custom', 'habit', 'ritual'],
  },
  {
    word: '宗教',
    reading: 'しゅうきょう',
    meaning: 'religion',
    explanation: '宗教 (shuukyou) refers to a system of faith and worship of a higher power.',
    distractors: ['philosophy', 'tradition', 'culture', 'belief', 'ceremony', 'history', 'mythology', 'spirituality'],
  },
  {
    word: '教育',
    reading: 'きょういく',
    meaning: 'education',
    explanation: '教育 (kyouiku) refers to the process of teaching and learning, especially in schools.',
    distractors: ['training', 'research', 'knowledge', 'discipline', 'culture', 'wisdom', 'study', 'practice'],
  },
  {
    word: '研究',
    reading: 'けんきゅう',
    meaning: 'research',
    explanation: '研究 (kenkyuu) refers to systematic investigation to establish facts or reach new conclusions.',
    distractors: ['study', 'education', 'experiment', 'survey', 'analysis', 'theory', 'discovery', 'report'],
  },
  {
    word: '調査',
    reading: 'ちょうさ',
    meaning: 'investigation / survey',
    explanation: '調査 (chousa) refers to a detailed examination or inquiry into something.',
    distractors: ['research', 'report', 'experiment', 'analysis', 'study', 'review', 'inspection', 'observation'],
  },
  {
    word: '報告',
    reading: 'ほうこく',
    meaning: 'report',
    explanation: '報告 (houkoku) refers to a formal account or statement of findings or activities.',
    distractors: ['announcement', 'news', 'article', 'document', 'summary', 'review', 'notice', 'letter'],
  },
  {
    word: '記事',
    reading: 'きじ',
    meaning: 'article / news story',
    explanation: '記事 (kiji) refers to a piece of writing in a newspaper, magazine, or website.',
    distractors: ['book', 'letter', 'report', 'essay', 'document', 'review', 'column', 'advertisement'],
  },
  {
    word: '情報',
    reading: 'じょうほう',
    meaning: 'information',
    explanation: '情報 (jouhou) refers to facts or data about a subject or situation.',
    distractors: ['knowledge', 'news', 'data', 'advice', 'opinion', 'rumor', 'report', 'message'],
  },
  {
    word: '知識',
    reading: 'ちしき',
    meaning: 'knowledge',
    explanation: '知識 (chishiki) refers to understanding or awareness gained through learning or experience.',
    distractors: ['information', 'wisdom', 'skill', 'education', 'memory', 'talent', 'intelligence', 'experience'],
  },
  {
    word: '行動',
    reading: 'こうどう',
    meaning: 'behavior / action',
    explanation: '行動 (koudou) refers to the way someone acts or the actions they take.',
    distractors: ['thought', 'feeling', 'opinion', 'plan', 'idea', 'decision', 'attitude', 'habit'],
  },
  {
    word: '自由',
    reading: 'じゆう',
    meaning: 'freedom / liberty',
    explanation: '自由 (jiyuu) refers to the state of being free to act or live without restrictions.',
    distractors: ['restriction', 'duty', 'obligation', 'rule', 'order', 'discipline', 'control', 'permission'],
  },
  {
    word: '平和',
    reading: 'へいわ',
    meaning: 'peace',
    explanation: '平和 (heiwa) refers to a state of tranquility without war or conflict.',
    distractors: ['war', 'conflict', 'tension', 'violence', 'chaos', 'danger', 'crisis', 'struggle'],
  },
  {
    word: '幸福',
    reading: 'こうふく',
    meaning: 'happiness / well-being',
    explanation: '幸福 (koufuku) refers to a state of great happiness and contentment.',
    distractors: ['sadness', 'misery', 'loneliness', 'anxiety', 'suffering', 'sorrow', 'regret', 'despair'],
  },
  {
    word: '犯罪',
    reading: 'はんざい',
    meaning: 'crime',
    explanation: '犯罪 (hanzai) refers to an illegal act punishable by law.',
    distractors: ['justice', 'law', 'punishment', 'investigation', 'trial', 'arrest', 'evidence', 'victim'],
  },
  {
    word: '解決',
    reading: 'かいけつ',
    meaning: 'solution / resolution',
    explanation: '解決 (kaiketsu) refers to finding an answer to a problem or settling a dispute.',
    distractors: ['problem', 'question', 'difficulty', 'conflict', 'cause', 'complaint', 'argument', 'confusion'],
  },
  {
    word: '問題',
    reading: 'もんだい',
    meaning: 'problem / question',
    explanation: '問題 (mondai) refers to a difficult situation or a question requiring an answer.',
    distractors: ['answer', 'solution', 'result', 'method', 'idea', 'opinion', 'advice', 'explanation'],
  },
  {
    word: '質問',
    reading: 'しつもん',
    meaning: 'question',
    explanation: '質問 (shitsumon) refers to a sentence or phrase asking for information.',
    distractors: ['answer', 'explanation', 'opinion', 'comment', 'suggestion', 'response', 'statement', 'request'],
  },
  {
    word: '答え',
    reading: 'こたえ',
    meaning: 'answer / response',
    explanation: '答え (kotae) refers to a reply given to a question or the solution to a problem.',
    distractors: ['question', 'problem', 'hint', 'clue', 'guess', 'opinion', 'request', 'explanation'],
  },
  {
    word: '意見',
    reading: 'いけん',
    meaning: 'opinion',
    explanation: '意見 (iken) refers to a personal view or judgment about something.',
    distractors: ['fact', 'truth', 'knowledge', 'information', 'evidence', 'proof', 'answer', 'result'],
  },
  {
    word: '感想',
    reading: 'かんそう',
    meaning: 'impression / thoughts',
    explanation: '感想 (kansou) refers to one\'s personal thoughts or feelings about an experience.',
    distractors: ['opinion', 'review', 'criticism', 'analysis', 'summary', 'report', 'comment', 'reaction'],
  },
  {
    word: '反応',
    reading: 'はんのう',
    meaning: 'reaction / response',
    explanation: '反応 (hannou) refers to how someone or something responds to a stimulus or event.',
    distractors: ['action', 'effect', 'cause', 'result', 'impression', 'feeling', 'opinion', 'behavior'],
  },
  {
    word: '常識',
    reading: 'じょうしき',
    meaning: 'common sense',
    explanation: '常識 (joushiki) refers to basic knowledge and judgment that most people share.',
    distractors: ['knowledge', 'wisdom', 'intelligence', 'education', 'experience', 'skill', 'talent', 'logic'],
  },
  {
    word: '想像',
    reading: 'そうぞう',
    meaning: 'imagination',
    explanation: '想像 (souzou) refers to the ability to form mental images or ideas of things not present.',
    distractors: ['memory', 'reality', 'dream', 'thought', 'creativity', 'fantasy', 'vision', 'idea'],
  },
  {
    word: '感謝',
    reading: 'かんしゃ',
    meaning: 'gratitude / thanks',
    explanation: '感謝 (kansha) refers to the feeling of being thankful and appreciative.',
    distractors: ['apology', 'regret', 'complaint', 'request', 'praise', 'respect', 'sympathy', 'kindness'],
  },
  {
    word: '約束',
    reading: 'やくそく',
    meaning: 'promise / appointment',
    explanation: '約束 (yakusoku) refers to a commitment to do something or a scheduled meeting.',
    distractors: ['plan', 'schedule', 'contract', 'agreement', 'rule', 'request', 'invitation', 'reservation'],
  },
  {
    word: '挨拶',
    reading: 'あいさつ',
    meaning: 'greeting / salutation',
    explanation: '挨拶 (aisatsu) refers to words or actions used to greet someone or show politeness.',
    distractors: ['farewell', 'introduction', 'conversation', 'speech', 'compliment', 'apology', 'request', 'invitation'],
  },
  {
    word: '礼儀',
    reading: 'れいぎ',
    meaning: 'manners / etiquette',
    explanation: '礼儀 (reigi) refers to polite behavior and social conventions.',
    distractors: ['custom', 'tradition', 'rule', 'law', 'habit', 'culture', 'style', 'fashion'],
  },
  {
    word: '迷惑',
    reading: 'めいわく',
    meaning: 'annoyance / trouble',
    explanation: '迷惑 (meiwaku) refers to causing inconvenience or bother to others.',
    distractors: ['kindness', 'favor', 'help', 'support', 'benefit', 'gratitude', 'pleasure', 'comfort'],
  },
  {
    word: '噂',
    reading: 'うわさ',
    meaning: 'rumor / gossip',
    explanation: '噂 (uwasa) refers to unverified information passed from person to person.',
    distractors: ['news', 'fact', 'truth', 'report', 'announcement', 'story', 'article', 'evidence'],
  },
  {
    word: '冗談',
    reading: 'じょうだん',
    meaning: 'joke',
    explanation: '冗談 (joudan) refers to something said or done to cause laughter.',
    distractors: ['lie', 'truth', 'story', 'insult', 'compliment', 'riddle', 'prank', 'rumor'],
  },
  {
    word: '趣味',
    reading: 'しゅみ',
    meaning: 'hobby / interest',
    explanation: '趣味 (shumi) refers to an activity done regularly for enjoyment in one\'s leisure time.',
    distractors: ['work', 'study', 'duty', 'skill', 'talent', 'habit', 'routine', 'career'],
  },
  {
    word: '世話',
    reading: 'せわ',
    meaning: 'care / assistance',
    explanation: '世話 (sewa) refers to looking after someone or providing help and support.',
    distractors: ['trouble', 'burden', 'demand', 'complaint', 'order', 'control', 'command', 'punishment'],
  },
  {
    word: '留守',
    reading: 'るす',
    meaning: 'absence from home',
    explanation: '留守 (rusu) refers to being away from home, or the state of a house being empty.',
    distractors: ['presence', 'return', 'arrival', 'visit', 'stay', 'residence', 'home', 'vacation'],
  },
  {
    word: '贅沢',
    reading: 'ぜいたく',
    meaning: 'luxury / extravagance',
    explanation: '贅沢 (zeitaku) refers to living or spending in an excessively comfortable or expensive way.',
    distractors: ['poverty', 'simplicity', 'modesty', 'savings', 'necessity', 'economy', 'frugality', 'hardship'],
  },
  {
    word: '我儘',
    reading: 'わがまま',
    meaning: 'selfishness / willfulness',
    explanation: '我儘 (wagamama) refers to being self-centered and insisting on having one\'s own way.',
    distractors: ['kindness', 'patience', 'generosity', 'modesty', 'obedience', 'consideration', 'cooperation', 'politeness'],
  },
  {
    word: '都合',
    reading: 'つごう',
    meaning: 'convenience / circumstances',
    explanation: '都合 (tsugou) refers to whether the timing or situation is suitable or convenient for someone.',
    distractors: ['inconvenience', 'schedule', 'plan', 'appointment', 'reason', 'excuse', 'preference', 'priority'],
  },
  {
    word: '用事',
    reading: 'ようじ',
    meaning: 'errand / business to attend to',
    explanation: '用事 (youji) refers to a task or piece of business that needs to be done.',
    distractors: ['hobby', 'rest', 'vacation', 'leisure', 'entertainment', 'meeting', 'work', 'appointment'],
  },
  {
    word: '退屈',
    reading: 'たいくつ',
    meaning: 'boredom / tedium',
    explanation: '退屈 (taikutsu) refers to the state of being bored due to lack of interest or stimulation.',
    distractors: ['excitement', 'fun', 'interest', 'enthusiasm', 'pleasure', 'enjoyment', 'delight', 'curiosity'],
  },
  {
    word: '偶然',
    reading: 'ぐうぜん',
    meaning: 'coincidence / by chance',
    explanation: '偶然 (guuzen) refers to something happening without being planned or expected.',
    distractors: ['intention', 'plan', 'fate', 'necessity', 'certainty', 'purpose', 'design', 'arrangement'],
  },
  {
    word: '勇気',
    reading: 'ゆうき',
    meaning: 'courage / bravery',
    explanation: '勇気 (yuuki) refers to the mental strength to face danger or difficulty without fear.',
    distractors: ['cowardice', 'fear', 'hesitation', 'weakness', 'doubt', 'anxiety', 'timidity', 'caution'],
  },
  {
    word: '誤解',
    reading: 'ごかい',
    meaning: 'misunderstanding',
    explanation: '誤解 (gokai) refers to an incorrect interpretation of someone\'s words or intentions.',
    distractors: ['understanding', 'agreement', 'explanation', 'communication', 'confirmation', 'clarification', 'translation', 'discussion'],
  },
  {
    word: '評判',
    reading: 'ひょうばん',
    meaning: 'reputation / popularity',
    explanation: '評判 (hyouban) refers to the general opinion that people have about someone or something.',
    distractors: ['rumor', 'gossip', 'secret', 'review', 'comment', 'criticism', 'praise', 'advertisement'],
  },
  {
    word: '面接',
    reading: 'めんせつ',
    meaning: 'interview',
    explanation: '面接 (mensetsu) refers to a formal meeting to evaluate a candidate, typically for a job.',
    distractors: ['examination', 'test', 'meeting', 'presentation', 'conference', 'lecture', 'discussion', 'evaluation'],
  },
  {
    word: '給料',
    reading: 'きゅうりょう',
    meaning: 'salary / wages',
    explanation: '給料 (kyuuryou) refers to the money regularly paid to an employee for their work.',
    distractors: ['bonus', 'tax', 'expense', 'debt', 'loan', 'savings', 'profit', 'income'],
  },
  {
    word: '届け',
    reading: 'とどけ',
    meaning: 'notification / report / delivery',
    explanation: '届け (todoke) refers to a formal notification or document submitted to an authority.',
    distractors: ['receipt', 'invoice', 'letter', 'application', 'certificate', 'contract', 'permit', 'license'],
  },
  {
    word: '看板',
    reading: 'かんばん',
    meaning: 'signboard / sign',
    explanation: '看板 (kanban) refers to a board displaying information, such as a shop sign or notice.',
    distractors: ['poster', 'advertisement', 'billboard', 'flag', 'banner', 'notice', 'label', 'ticket'],
  },
  {
    word: '家賃',
    reading: 'やちん',
    meaning: 'rent (for housing)',
    explanation: '家賃 (yachin) refers to the money paid regularly for the use of a rented house or apartment.',
    distractors: ['mortgage', 'deposit', 'utility bill', 'tax', 'insurance', 'loan', 'savings', 'income'],
  },
  {
    word: '交差点',
    reading: 'こうさてん',
    meaning: 'intersection / crossroads',
    explanation: '交差点 (kousaten) refers to a point where two or more roads cross each other.',
    distractors: ['highway', 'bridge', 'tunnel', 'sidewalk', 'parking lot', 'station', 'roundabout', 'overpass'],
  },
  {
    word: '踏切',
    reading: 'ふみきり',
    meaning: 'railroad crossing',
    explanation: '踏切 (fumikiri) refers to a place where a road crosses a railway at the same level.',
    distractors: ['station', 'platform', 'bridge', 'tunnel', 'intersection', 'highway', 'overpass', 'signal'],
  },
  {
    word: '駐車場',
    reading: 'ちゅうしゃじょう',
    meaning: 'parking lot',
    explanation: '駐車場 (chuushajou) refers to an area designated for parking vehicles.',
    distractors: ['garage', 'road', 'highway', 'sidewalk', 'driveway', 'intersection', 'gas station', 'bus stop'],
  },
  {
    word: '締め切り',
    reading: 'しめきり',
    meaning: 'deadline',
    explanation: '締め切り (shimekiri) refers to the latest time or date by which something must be completed.',
    distractors: ['schedule', 'plan', 'goal', 'start date', 'appointment', 'extension', 'break', 'holiday'],
  },
  {
    word: '手続き',
    reading: 'てつづき',
    meaning: 'procedure / paperwork',
    explanation: '手続き (tetsuzuki) refers to the official steps or formalities required to complete a process.',
    distractors: ['document', 'form', 'application', 'result', 'certificate', 'receipt', 'permission', 'approval'],
  },
  {
    word: '見舞い',
    reading: 'みまい',
    meaning: 'visiting the sick / sympathy call',
    explanation: '見舞い (mimai) refers to visiting someone who is ill or has suffered a misfortune to show concern.',
    distractors: ['celebration', 'greeting', 'invitation', 'farewell', 'gift', 'party', 'ceremony', 'vacation'],
  },
  {
    word: '土産',
    reading: 'みやげ',
    meaning: 'souvenir / gift',
    explanation: '土産 (miyage) refers to a present brought back from a trip for friends, family, or coworkers.',
    distractors: ['luggage', 'ticket', 'postcard', 'photograph', 'receipt', 'memory', 'schedule', 'reservation'],
  },
]

/** @type {Array<{word: string, reading: string, meaning: string, explanation: string, distractors: string[]}>} */
const adjectives = [
  {
    word: '正確な',
    reading: 'せいかくな',
    meaning: 'accurate / precise',
    explanation: '正確な (seikaku na) means free from error, conforming exactly to truth or a standard.',
    distractors: ['vague', 'rough', 'approximate', 'incorrect', 'careless', 'uncertain', 'doubtful', 'misleading'],
  },
  {
    word: '適当な',
    reading: 'てきとうな',
    meaning: 'suitable / appropriate',
    explanation: '適当な (tekitou na) means fitting for a particular purpose, though colloquially it can mean "random" or "halfhearted."',
    distractors: ['inappropriate', 'excessive', 'insufficient', 'incorrect', 'perfect', 'ideal', 'strict', 'formal'],
  },
  {
    word: '単純な',
    reading: 'たんじゅんな',
    meaning: 'simple / uncomplicated',
    explanation: '単純な (tanjun na) means not complex or difficult to understand.',
    distractors: ['complicated', 'complex', 'difficult', 'confusing', 'detailed', 'sophisticated', 'advanced', 'elaborate'],
  },
  {
    word: '穏やかな',
    reading: 'おだやかな',
    meaning: 'calm / gentle / mild',
    explanation: '穏やかな (odayaka na) means tranquil and free from disturbance, used for weather, personality, or situations.',
    distractors: ['stormy', 'violent', 'fierce', 'rough', 'intense', 'wild', 'chaotic', 'aggressive'],
  },
  {
    word: '不思議な',
    reading: 'ふしぎな',
    meaning: 'mysterious / strange',
    explanation: '不思議な (fushigi na) means something that is hard to explain or understand, evoking wonder.',
    distractors: ['ordinary', 'normal', 'obvious', 'expected', 'common', 'boring', 'familiar', 'predictable'],
  },
  {
    word: '素敵な',
    reading: 'すてきな',
    meaning: 'wonderful / lovely',
    explanation: '素敵な (suteki na) is a complimentary word meaning something or someone is attractive and delightful.',
    distractors: ['terrible', 'ugly', 'awful', 'boring', 'plain', 'dull', 'ordinary', 'mediocre'],
  },
  {
    word: '立派な',
    reading: 'りっぱな',
    meaning: 'splendid / admirable',
    explanation: '立派な (rippa na) means impressive or worthy of admiration in quality or character.',
    distractors: ['shameful', 'poor', 'mediocre', 'average', 'inferior', 'humble', 'ordinary', 'plain'],
  },
  {
    word: '地味な',
    reading: 'じみな',
    meaning: 'plain / modest / subdued',
    explanation: '地味な (jimi na) means not flashy or showy, having a quiet and unassuming appearance.',
    distractors: ['flashy', 'showy', 'colorful', 'bright', 'bold', 'extravagant', 'fancy', 'glamorous'],
  },
  {
    word: '派手な',
    reading: 'はでな',
    meaning: 'flashy / showy',
    explanation: '派手な (hade na) means eye-catching and loud in color or style, sometimes excessively so.',
    distractors: ['plain', 'modest', 'subtle', 'dull', 'quiet', 'simple', 'conservative', 'dark'],
  },
  {
    word: '乱暴な',
    reading: 'らんぼうな',
    meaning: 'rough / violent',
    explanation: '乱暴な (ranbou na) means using excessive force or being aggressive in behavior.',
    distractors: ['gentle', 'calm', 'peaceful', 'kind', 'careful', 'soft', 'polite', 'tender'],
  },
  {
    word: '真剣な',
    reading: 'しんけんな',
    meaning: 'serious / earnest',
    explanation: '真剣な (shinken na) means showing deep sincerity and commitment to something.',
    distractors: ['playful', 'casual', 'careless', 'humorous', 'lighthearted', 'relaxed', 'lazy', 'indifferent'],
  },
  {
    word: '熱心な',
    reading: 'ねっしんな',
    meaning: 'enthusiastic / eager',
    explanation: '熱心な (nesshin na) means showing intense interest and passion toward something.',
    distractors: ['indifferent', 'lazy', 'bored', 'apathetic', 'reluctant', 'passive', 'careless', 'unmotivated'],
  },
  {
    word: '得意な',
    reading: 'とくいな',
    meaning: 'good at / skilled',
    explanation: '得意な (tokui na) means being proficient or having confidence in a particular area.',
    distractors: ['bad at', 'weak in', 'struggling with', 'unfamiliar with', 'afraid of', 'bored with', 'tired of', 'confused by'],
  },
  {
    word: '苦手な',
    reading: 'にがてな',
    meaning: 'bad at / not good with',
    explanation: '苦手な (nigate na) means lacking ability or comfort in dealing with something.',
    distractors: ['good at', 'skilled in', 'fond of', 'comfortable with', 'confident in', 'familiar with', 'talented at', 'experienced in'],
  },
  {
    word: '有名な',
    reading: 'ゆうめいな',
    meaning: 'famous / well-known',
    explanation: '有名な (yuumei na) means widely recognized and known by many people.',
    distractors: ['unknown', 'obscure', 'anonymous', 'ordinary', 'forgotten', 'unpopular', 'insignificant', 'minor'],
  },
  {
    word: '明らかな',
    reading: 'あきらかな',
    meaning: 'obvious / clear',
    explanation: '明らかな (akiraka na) means easy to see or understand without any doubt.',
    distractors: ['unclear', 'vague', 'hidden', 'mysterious', 'doubtful', 'uncertain', 'ambiguous', 'confusing'],
  },
  {
    word: '急な',
    reading: 'きゅうな',
    meaning: 'sudden / steep',
    explanation: '急な (kyuu na) means happening quickly without warning, or having a sharp incline.',
    distractors: ['gradual', 'slow', 'gentle', 'flat', 'expected', 'planned', 'smooth', 'steady'],
  },
  {
    word: '細かい',
    reading: 'こまかい',
    meaning: 'detailed / fine / small',
    explanation: '細かい (komakai) means consisting of small parts, or being thorough and precise.',
    distractors: ['rough', 'coarse', 'broad', 'vague', 'simple', 'large', 'general', 'basic'],
  },
  {
    word: '柔らかい',
    reading: 'やわらかい',
    meaning: 'soft / tender',
    explanation: '柔らかい (yawarakai) means easily yielding to pressure, not hard or stiff.',
    distractors: ['hard', 'stiff', 'tough', 'rigid', 'firm', 'solid', 'rough', 'dry'],
  },
  {
    word: '固い',
    reading: 'かたい',
    meaning: 'hard / stiff / firm',
    explanation: '固い (katai) means resistant to pressure, not easily bent or broken.',
    distractors: ['soft', 'flexible', 'loose', 'tender', 'weak', 'fragile', 'elastic', 'spongy'],
  },
  {
    word: '鋭い',
    reading: 'するどい',
    meaning: 'sharp / keen',
    explanation: '鋭い (surudoi) means having a fine edge or point, or having acute perception.',
    distractors: ['dull', 'blunt', 'slow', 'vague', 'weak', 'gentle', 'soft', 'round'],
  },
  {
    word: '鈍い',
    reading: 'にぶい',
    meaning: 'dull / slow / blunt',
    explanation: '鈍い (nibui) means lacking sharpness in edge or perception, slow to react.',
    distractors: ['sharp', 'keen', 'quick', 'bright', 'alert', 'fast', 'clever', 'sensitive'],
  },
  {
    word: '温かい',
    reading: 'あたたかい',
    meaning: 'warm',
    explanation: '温かい (atatakai) means having a comfortably moderate temperature, or warm-hearted.',
    distractors: ['cold', 'cool', 'chilly', 'freezing', 'hot', 'icy', 'lukewarm', 'harsh'],
  },
  {
    word: '涼しい',
    reading: 'すずしい',
    meaning: 'cool / refreshing',
    explanation: '涼しい (suzushii) means pleasantly cool, especially in relation to weather.',
    distractors: ['hot', 'warm', 'humid', 'stuffy', 'freezing', 'scorching', 'muggy', 'blazing'],
  },
  {
    word: '蒸し暑い',
    reading: 'むしあつい',
    meaning: 'hot and humid / muggy',
    explanation: '蒸し暑い (mushiatsui) describes weather that is both hot and humid, making it uncomfortable.',
    distractors: ['cool and dry', 'cold', 'refreshing', 'comfortable', 'pleasant', 'breezy', 'mild', 'chilly'],
  },
  {
    word: '眠い',
    reading: 'ねむい',
    meaning: 'sleepy / drowsy',
    explanation: '眠い (nemui) means feeling a strong desire to sleep.',
    distractors: ['awake', 'alert', 'energetic', 'excited', 'restless', 'active', 'refreshed', 'lively'],
  },
  {
    word: '怪しい',
    reading: 'あやしい',
    meaning: 'suspicious / dubious',
    explanation: '怪しい (ayashii) means arousing suspicion or distrust, seeming not quite right.',
    distractors: ['trustworthy', 'reliable', 'honest', 'obvious', 'normal', 'clear', 'innocent', 'genuine'],
  },
  {
    word: '恐ろしい',
    reading: 'おそろしい',
    meaning: 'frightening / terrible',
    explanation: '恐ろしい (osoroshii) means causing great fear or dread.',
    distractors: ['reassuring', 'safe', 'pleasant', 'calm', 'gentle', 'comforting', 'amusing', 'harmless'],
  },
  {
    word: '素直な',
    reading: 'すなおな',
    meaning: 'obedient / honest / docile',
    explanation: '素直な (sunao na) means being straightforward, compliant, and free from deceit.',
    distractors: ['stubborn', 'rebellious', 'dishonest', 'defiant', 'sneaky', 'devious', 'resistant', 'difficult'],
  },
  {
    word: '幼い',
    reading: 'おさない',
    meaning: 'young / childish / immature',
    explanation: '幼い (osanai) means being very young in age, or displaying childlike qualities.',
    distractors: ['mature', 'adult', 'elderly', 'grown-up', 'experienced', 'wise', 'old', 'sophisticated'],
  },
]

/** @type {Array<{word: string, reading: string, meaning: string, explanation: string, distractors: string[]}>} */
const adverbs = [
  {
    word: 'やっと',
    reading: 'やっと',
    meaning: 'finally / at last',
    explanation: 'やっと (yatto) expresses relief that something has happened after a long wait or effort.',
    distractors: ['easily', 'quickly', 'suddenly', 'immediately', 'never', 'already', 'barely', 'almost'],
  },
  {
    word: 'ぜひ',
    reading: 'ぜひ',
    meaning: 'by all means / definitely',
    explanation: 'ぜひ (zehi) is used to strongly encourage or express a sincere desire for something to happen.',
    distractors: ['maybe', 'perhaps', 'never', 'hardly', 'rarely', 'possibly', 'somewhat', 'slightly'],
  },
  {
    word: 'いつの間にか',
    reading: 'いつのまにか',
    meaning: 'before one knows it',
    explanation: 'いつの間にか (itsu no ma ni ka) means something happened without the person realizing when.',
    distractors: ['obviously', 'clearly', 'suddenly', 'intentionally', 'slowly', 'deliberately', 'carefully', 'predictably'],
  },
  {
    word: 'わざわざ',
    reading: 'わざわざ',
    meaning: 'going out of one\'s way / on purpose',
    explanation: 'わざわざ (wazawaza) implies someone made a special effort to do something, often unnecessarily.',
    distractors: ['accidentally', 'casually', 'lazily', 'carelessly', 'naturally', 'automatically', 'passively', 'effortlessly'],
  },
  {
    word: '一応',
    reading: 'いちおう',
    meaning: 'tentatively / just in case',
    explanation: '一応 (ichiou) means doing something as a precaution or to a minimal acceptable standard.',
    distractors: ['definitely', 'absolutely', 'thoroughly', 'completely', 'never', 'permanently', 'perfectly', 'certainly'],
  },
  {
    word: 'まさか',
    reading: 'まさか',
    meaning: 'no way / unbelievable',
    explanation: 'まさか (masaka) expresses disbelief that something could be true or could happen.',
    distractors: ['of course', 'naturally', 'obviously', 'certainly', 'definitely', 'surely', 'exactly', 'clearly'],
  },
  {
    word: 'さすが',
    reading: 'さすが',
    meaning: 'as expected / impressive',
    explanation: 'さすが (sasuga) expresses admiration for someone living up to their reputation.',
    distractors: ['surprisingly', 'disappointingly', 'unexpectedly', 'unfortunately', 'strangely', 'rarely', 'barely', 'hardly'],
  },
  {
    word: 'たまたま',
    reading: 'たまたま',
    meaning: 'by chance / accidentally',
    explanation: 'たまたま (tamatama) means something happened coincidentally without being planned.',
    distractors: ['intentionally', 'deliberately', 'always', 'regularly', 'frequently', 'purposely', 'certainly', 'predictably'],
  },
  {
    word: 'ぴったり',
    reading: 'ぴったり',
    meaning: 'exactly / perfectly fitting',
    explanation: 'ぴったり (pittari) means matching precisely or fitting perfectly without any gap.',
    distractors: ['loosely', 'roughly', 'approximately', 'poorly', 'barely', 'slightly', 'vaguely', 'partially'],
  },
  {
    word: 'そっと',
    reading: 'そっと',
    meaning: 'softly / gently / quietly',
    explanation: 'そっと (sotto) means doing something in a gentle, quiet, or secretive manner.',
    distractors: ['loudly', 'roughly', 'violently', 'quickly', 'boldly', 'openly', 'noisily', 'carelessly'],
  },
  {
    word: 'ぐっすり',
    reading: 'ぐっすり',
    meaning: 'soundly (sleeping)',
    explanation: 'ぐっすり (gussuri) describes sleeping very deeply and peacefully.',
    distractors: ['lightly', 'restlessly', 'briefly', 'badly', 'uncomfortably', 'barely', 'fitfully', 'nervously'],
  },
  {
    word: 'ぶらぶら',
    reading: 'ぶらぶら',
    meaning: 'strolling / wandering idly',
    explanation: 'ぶらぶら (burabura) describes walking around without any particular purpose or destination.',
    distractors: ['rushing', 'hurrying', 'marching', 'running', 'sprinting', 'racing', 'dashing', 'jogging'],
  },
  {
    word: 'ぺらぺら',
    reading: 'ぺらぺら',
    meaning: 'fluently',
    explanation: 'ぺらぺら (perapera) describes speaking a language very smoothly and without hesitation.',
    distractors: ['poorly', 'haltingly', 'slowly', 'barely', 'incorrectly', 'quietly', 'nervously', 'stiffly'],
  },
  {
    word: 'にこにこ',
    reading: 'にこにこ',
    meaning: 'smiling / beaming',
    explanation: 'にこにこ (nikoniko) describes a warm, pleasant smile on someone\'s face.',
    distractors: ['frowning', 'crying', 'scowling', 'glaring', 'pouting', 'yawning', 'grimacing', 'staring'],
  },
  {
    word: 'どきどき',
    reading: 'どきどき',
    meaning: 'heart pounding / nervous excitement',
    explanation: 'どきどき (dokidoki) is an onomatopoeia for the sound and feeling of a rapidly beating heart.',
    distractors: ['calmly', 'peacefully', 'boringly', 'sleepily', 'quietly', 'lazily', 'indifferently', 'coldly'],
  },
  {
    word: 'わくわく',
    reading: 'わくわく',
    meaning: 'excited / thrilled',
    explanation: 'わくわく (wakuwaku) describes the feeling of excited anticipation about something enjoyable.',
    distractors: ['bored', 'anxious', 'depressed', 'tired', 'scared', 'indifferent', 'disappointed', 'nervous'],
  },
  {
    word: 'のんびり',
    reading: 'のんびり',
    meaning: 'leisurely / in a relaxed way',
    explanation: 'のんびり (nonbiri) describes doing something in an unhurried, carefree manner.',
    distractors: ['hastily', 'busily', 'anxiously', 'nervously', 'frantically', 'urgently', 'tensely', 'stressfully'],
  },
  {
    word: 'しっかり',
    reading: 'しっかり',
    meaning: 'firmly / properly / reliably',
    explanation: 'しっかり (shikkari) means doing something in a solid, dependable, and thorough manner.',
    distractors: ['loosely', 'carelessly', 'weakly', 'vaguely', 'lazily', 'poorly', 'sloppily', 'halfheartedly'],
  },
  {
    word: 'うっかり',
    reading: 'うっかり',
    meaning: 'carelessly / absent-mindedly',
    explanation: 'うっかり (ukkari) means doing something without paying enough attention, making a careless mistake.',
    distractors: ['carefully', 'deliberately', 'intentionally', 'attentively', 'cautiously', 'precisely', 'thoroughly', 'wisely'],
  },
  {
    word: 'がっかり',
    reading: 'がっかり',
    meaning: 'disappointed / let down',
    explanation: 'がっかり (gakkari) expresses the feeling of disappointment when expectations are not met.',
    distractors: ['delighted', 'satisfied', 'relieved', 'pleased', 'excited', 'grateful', 'proud', 'impressed'],
  },
]

// ────────────────────────────────────────────────
// Rarity & scoring helpers (same as generate-vocab.mjs)
// ────────────────────────────────────────────────

const RARITY_CYCLE = [
  'common',   // 0
  'common',   // 1
  'uncommon', // 2
  'common',   // 3
  'common',   // 4
  'uncommon', // 5
  'common',   // 6
  'common',   // 7
  'uncommon', // 8
  'rare',     // 9
  'common',   // 10
  'common',   // 11
  'uncommon', // 12
  'common',   // 13
  'common',   // 14
  'uncommon', // 15
  'common',   // 16
  'common',   // 17
  'rare',     // 18
  'epic',     // 19
]

/**
 * Returns a rarity value based on a rotating pattern.
 * @param {number} index - Zero-based entry index.
 * @returns {string} The rarity tier.
 */
function getRarity(index) {
  return RARITY_CYCLE[index % RARITY_CYCLE.length]
}

/**
 * Returns a difficulty value 1-5, cycling through entries.
 * @param {number} index - Zero-based entry index.
 * @returns {number} Difficulty 1-5.
 */
function getDifficulty(index) {
  return (index % 5) + 1
}

/**
 * Returns a funScore in the 3-7 range.
 * @param {number} index - Zero-based entry index.
 * @returns {number} Fun score 3-7.
 */
function getFunScore(index) {
  return 3 + (index % 5)
}

/**
 * Pads a number to 3 digits for stable IDs.
 * @param {number} value - The number to pad.
 * @returns {string} The padded numeric string.
 */
function padId(value) {
  return String(value).padStart(3, '0')
}

// ────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────

function main() {
  const vocabPath = join(__dirname, '..', 'src', 'data', 'seed', 'vocab-n3.json')

  // 1. Read existing entries
  const existing = JSON.parse(readFileSync(vocabPath, 'utf8'))
  console.log(`Existing entries: ${existing.length}`)

  if (existing.length === 400) {
    // Already extended — truncate back to the original 200 and re-extend
    console.log('File already has 400 entries. Truncating back to 200 to re-extend with updated data.')
    existing.length = 200
  } else if (existing.length !== 200) {
    console.error(`ERROR: Expected 200 existing entries, got ${existing.length}`)
    process.exit(1)
  }

  // 2. Build new entries (201-400)
  /** @type {Array<{word: string, reading: string, meaning: string, explanation: string, distractors: string[], pos: string}>} */
  const allNewWords = [
    ...verbs.map(v => ({ ...v, pos: 'Verbs' })),
    ...nouns.map(n => ({ ...n, pos: 'Nouns' })),
    ...adjectives.map(a => ({ ...a, pos: 'Adjectives' })),
    ...adverbs.map(a => ({ ...a, pos: 'Adverbs' })),
  ]

  console.log(`New words defined: ${allNewWords.length}`)

  if (allNewWords.length !== 200) {
    console.error(`ERROR: Expected 200 new words, got ${allNewWords.length}`)
    process.exit(1)
  }

  // Check for duplicates against existing entries
  const existingWords = new Set(existing.map(e => e.statement.split(' (')[0]))
  const duplicates = allNewWords.filter(w => existingWords.has(w.word))
  if (duplicates.length > 0) {
    console.warn(`WARNING: ${duplicates.length} duplicate(s) found with existing data:`)
    duplicates.forEach(d => console.warn(`  - ${d.word} (${d.reading})`))
    // Non-fatal: we allow some overlap for transitive/intransitive pairs etc.
  }

  const newEntries = allNewWords.map((item, index) => {
    const num = 201 + index  // IDs 201-400
    return {
      id: `ja-n3-${padId(num)}`,
      type: 'vocabulary',
      statement: `${item.word} (${item.reading}) means '${item.meaning}'`,
      explanation: item.explanation,
      quizQuestion: `What does ${item.word} (${item.reading}) mean?`,
      correctAnswer: item.meaning,
      distractors: item.distractors,
      category: ['Language', 'Japanese', 'JLPT N3', item.pos],
      rarity: getRarity(index),
      difficulty: getDifficulty(index),
      funScore: getFunScore(index),
      ageRating: 'kid',
      language: 'ja',
      pronunciation: item.reading,
    }
  })

  // 3. Combine and write
  const combined = [...existing, ...newEntries]
  writeFileSync(vocabPath, JSON.stringify(combined, null, 2) + '\n', 'utf8')

  // 4. Report
  const verbCount = newEntries.filter(e => e.category[3] === 'Verbs').length
  const nounCount = newEntries.filter(e => e.category[3] === 'Nouns').length
  const adjCount = newEntries.filter(e => e.category[3] === 'Adjectives').length
  const advCount = newEntries.filter(e => e.category[3] === 'Adverbs').length

  const rarityCounts = {}
  for (const e of newEntries) {
    rarityCounts[e.rarity] = (rarityCounts[e.rarity] || 0) + 1
  }

  console.log(`\nAdded ${newEntries.length} new entries (IDs ja-n3-201 through ja-n3-${padId(200 + newEntries.length)})`)
  console.log(`Total entries in file: ${combined.length}`)
  console.log(`  New — Verbs: ${verbCount}, Nouns: ${nounCount}, Adjectives: ${adjCount}, Adverbs: ${advCount}`)
  console.log(`  Rarity: ${Object.entries(rarityCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`)
  console.log(`\nFirst new ID: ${newEntries[0].id}`)
  console.log(`Last new ID:  ${newEntries[newEntries.length - 1].id}`)
}

main()
