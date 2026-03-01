#!/usr/bin/env node
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Real JLPT N3 vocabulary organized by category

/** @type {Array<{word: string, reading: string, meaning: string, explanation: string, distractors: string[]}>} */
const verbs = [
  {
    word: '届ける',
    reading: 'とどける',
    meaning: 'to deliver',
    explanation: '届ける (todokeru) is a る-verb meaning to deliver or send something to someone. Used when physically bringing something to its destination.',
    distractors: ['to receive', 'to carry', 'to ship', 'to mail', 'to return', 'to pick up', 'to forward', 'to collect'],
  },
  {
    word: '届く',
    reading: 'とどく',
    meaning: 'to arrive / to reach',
    explanation: '届く (todoku) is the intransitive partner of 届ける. It describes something arriving at its destination on its own, e.g. a package that has arrived.',
    distractors: ['to depart', 'to fall short', 'to overflow', 'to return', 'to pass by', 'to approach', 'to disappear', 'to spread'],
  },
  {
    word: '集める',
    reading: 'あつめる',
    meaning: 'to collect / to gather',
    explanation: '集める (atsumeru) is a transitive る-verb meaning to bring things or people together into one place.',
    distractors: ['to scatter', 'to distribute', 'to sort', 'to separate', 'to throw away', 'to hide', 'to arrange', 'to find'],
  },
  {
    word: '集まる',
    reading: 'あつまる',
    meaning: 'to gather / to assemble',
    explanation: '集まる (atsumaru) is the intransitive counterpart of 集める, meaning people or things come together by themselves.',
    distractors: ['to disperse', 'to leave', 'to arrive', 'to depart', 'to scatter', 'to appear', 'to disappear', 'to line up'],
  },
  {
    word: '伝える',
    reading: 'つたえる',
    meaning: 'to convey / to tell',
    explanation: '伝える (tsutaeru) means to pass on information, a message, or a tradition to someone else.',
    distractors: ['to hide', 'to forget', 'to misunderstand', 'to receive', 'to deny', 'to confirm', 'to interrupt', 'to exaggerate'],
  },
  {
    word: '決める',
    reading: 'きめる',
    meaning: 'to decide',
    explanation: '決める (kimeru) is a transitive る-verb meaning to make a decision or set something definitively.',
    distractors: ['to change', 'to cancel', 'to postpone', 'to suggest', 'to doubt', 'to approve', 'to refuse', 'to reconsider'],
  },
  {
    word: '決まる',
    reading: 'きまる',
    meaning: 'to be decided',
    explanation: '決まる (kimaru) is the intransitive form, meaning something has been decided or settled without an explicit actor.',
    distractors: ['to be cancelled', 'to be changed', 'to be delayed', 'to be considered', 'to be announced', 'to be forgotten', 'to be approved', 'to be refused'],
  },
  {
    word: '変える',
    reading: 'かえる',
    meaning: 'to change (something)',
    explanation: '変える (kaeru) is transitive, meaning to change or alter something intentionally.',
    distractors: ['to keep', 'to maintain', 'to restore', 'to break', 'to improve', 'to create', 'to destroy', 'to preserve'],
  },
  {
    word: '変わる',
    reading: 'かわる',
    meaning: 'to change / to transform',
    explanation: '変わる (kawaru) is intransitive, meaning something changes on its own or over time.',
    distractors: ['to remain', 'to grow', 'to disappear', 'to stop', 'to start', 'to continue', 'to return', 'to develop'],
  },
  {
    word: '比べる',
    reading: 'くらべる',
    meaning: 'to compare',
    explanation: '比べる (kuraberu) means to place two or more things side by side to examine similarities and differences.',
    distractors: ['to choose', 'to rank', 'to evaluate', 'to classify', 'to match', 'to separate', 'to combine', 'to judge'],
  },
  {
    word: '育てる',
    reading: 'そだてる',
    meaning: 'to raise / to nurture',
    explanation: '育てる (sodateru) means to raise a child, animal, or plant, fostering its growth over time.',
    distractors: ['to abandon', 'to ignore', 'to protect', 'to teach', 'to feed', 'to discipline', 'to observe', 'to release'],
  },
  {
    word: '助ける',
    reading: 'たすける',
    meaning: 'to help / to rescue',
    explanation: '助ける (tasukeru) means to help someone in need or save them from danger.',
    distractors: ['to abandon', 'to harm', 'to ignore', 'to follow', 'to guide', 'to protect', 'to warn', 'to support'],
  },
  {
    word: '進む',
    reading: 'すすむ',
    meaning: 'to advance / to proceed',
    explanation: '進む (susumu) means to move forward, make progress, or advance toward a goal.',
    distractors: ['to retreat', 'to stop', 'to return', 'to wander', 'to hesitate', 'to turn back', 'to slow down', 'to fall behind'],
  },
  {
    word: '通す',
    reading: 'とおす',
    meaning: 'to let through / to pass through',
    explanation: '通す (toosu) is transitive, meaning to let something or someone pass through a place or to run something through an opening.',
    distractors: ['to block', 'to stop', 'to turn away', 'to redirect', 'to fill', 'to close', 'to open', 'to connect'],
  },
  {
    word: '通る',
    reading: 'とおる',
    meaning: 'to pass / to go through',
    explanation: '通る (tooru) is intransitive, meaning to pass through or along a place.',
    distractors: ['to arrive', 'to stop', 'to turn', 'to enter', 'to exit', 'to approach', 'to cross', 'to avoid'],
  },
  {
    word: '続ける',
    reading: 'つづける',
    meaning: 'to continue (something)',
    explanation: '続ける (tsuzukeru) is transitive, meaning to keep doing something without stopping.',
    distractors: ['to stop', 'to begin', 'to finish', 'to repeat', 'to interrupt', 'to pause', 'to restart', 'to quit'],
  },
  {
    word: '続く',
    reading: 'つづく',
    meaning: 'to continue / to last',
    explanation: '続く (tsuzuku) is intransitive, meaning something goes on without stopping, such as rain continuing for days.',
    distractors: ['to end', 'to start', 'to fade', 'to stop', 'to break', 'to slow', 'to spread', 'to shrink'],
  },
  {
    word: '残す',
    reading: 'のこす',
    meaning: 'to leave behind / to save',
    explanation: '残す (nokosu) means to intentionally leave something remaining or to save something for later.',
    distractors: ['to take', 'to remove', 'to use up', 'to destroy', 'to carry', 'to lose', 'to waste', 'to hide'],
  },
  {
    word: '残る',
    reading: 'のこる',
    meaning: 'to remain / to be left',
    explanation: '残る (nokoru) is intransitive, meaning something stays behind or is still present after others have gone.',
    distractors: ['to disappear', 'to vanish', 'to leave', 'to return', 'to join', 'to follow', 'to arrive', 'to escape'],
  },
  {
    word: '選ぶ',
    reading: 'えらぶ',
    meaning: 'to choose / to select',
    explanation: '選ぶ (erabu) means to pick something from several options based on preference or criteria.',
    distractors: ['to reject', 'to avoid', 'to buy', 'to find', 'to use', 'to accept', 'to discard', 'to ignore'],
  },
  {
    word: '探す',
    reading: 'さがす',
    meaning: 'to search / to look for',
    explanation: '探す (sagasu) means to actively look for something or someone that is missing or needed.',
    distractors: ['to find', 'to hide', 'to lose', 'to keep', 'to show', 'to discover', 'to check', 'to track'],
  },
  {
    word: '受ける',
    reading: 'うける',
    meaning: 'to receive / to take (a test)',
    explanation: '受ける (ukeru) means to receive something given or to take an examination or interview.',
    distractors: ['to give', 'to send', 'to pass', 'to fail', 'to avoid', 'to reject', 'to prepare', 'to complete'],
  },
  {
    word: '感じる',
    reading: 'かんじる',
    meaning: 'to feel / to sense',
    explanation: '感じる (kanjiru) means to perceive a sensation or emotion, either physically or emotionally.',
    distractors: ['to think', 'to know', 'to see', 'to hear', 'to imagine', 'to believe', 'to understand', 'to notice'],
  },
  {
    word: '考える',
    reading: 'かんがえる',
    meaning: 'to think / to consider',
    explanation: '考える (kangaeru) means to use the mind to reflect, deliberate, or form opinions about something.',
    distractors: ['to know', 'to decide', 'to forget', 'to remember', 'to say', 'to imagine', 'to ask', 'to understand'],
  },
  {
    word: '調べる',
    reading: 'しらべる',
    meaning: 'to investigate / to look up',
    explanation: '調べる (shiraberu) means to research, investigate, or look something up to find out the facts.',
    distractors: ['to find', 'to guess', 'to ignore', 'to report', 'to notice', 'to explain', 'to confirm', 'to test'],
  },
  {
    word: '起こす',
    reading: 'おこす',
    meaning: 'to wake up / to cause',
    explanation: '起こす (okosu) means to wake someone up or to cause an event or accident to happen.',
    distractors: ['to sleep', 'to rest', 'to prevent', 'to stop', 'to allow', 'to ignore', 'to end', 'to fix'],
  },
  {
    word: '起こる',
    reading: 'おこる',
    meaning: 'to occur / to happen',
    explanation: '起こる (okoru) is intransitive, meaning an event or accident takes place.',
    distractors: ['to end', 'to continue', 'to begin', 'to avoid', 'to repeat', 'to stop', 'to spread', 'to fade'],
  },
  {
    word: '直す',
    reading: 'なおす',
    meaning: 'to fix / to correct',
    explanation: '直す (naosu) means to repair something broken or to correct a mistake.',
    distractors: ['to break', 'to damage', 'to replace', 'to improve', 'to change', 'to remove', 'to adjust', 'to clean'],
  },
  {
    word: '払う',
    reading: 'はらう',
    meaning: 'to pay',
    explanation: '払う (harau) means to hand over money in exchange for goods or services.',
    distractors: ['to receive', 'to borrow', 'to lend', 'to owe', 'to save', 'to spend', 'to earn', 'to refund'],
  },
  {
    word: '連れる',
    reading: 'つれる',
    meaning: 'to take (someone) along',
    explanation: '連れる (tsureru) means to bring or take a person or animal along with you somewhere.',
    distractors: ['to send', 'to leave behind', 'to follow', 'to guide', 'to meet', 'to invite', 'to carry', 'to drop off'],
  },
  {
    word: '乗せる',
    reading: 'のせる',
    meaning: 'to put on / to give a ride',
    explanation: '乗せる (noseru) means to place something on top of a surface or to give someone a ride in a vehicle.',
    distractors: ['to take off', 'to remove', 'to drop', 'to throw', 'to hold', 'to push', 'to pull', 'to carry'],
  },
  {
    word: '下ろす',
    reading: 'おろす',
    meaning: 'to take down / to withdraw',
    explanation: '下ろす (orosu) means to bring something down from a higher position or to withdraw money from a bank.',
    distractors: ['to raise', 'to lift', 'to deposit', 'to carry', 'to place', 'to hang', 'to attach', 'to move'],
  },
  {
    word: '借りる',
    reading: 'かりる',
    meaning: 'to borrow / to rent',
    explanation: '借りる (kariru) means to temporarily use something that belongs to someone else.',
    distractors: ['to lend', 'to buy', 'to return', 'to keep', 'to steal', 'to give', 'to sell', 'to own'],
  },
  {
    word: '貸す',
    reading: 'かす',
    meaning: 'to lend / to rent out',
    explanation: '貸す (kasu) means to let someone temporarily use something you own.',
    distractors: ['to borrow', 'to buy', 'to sell', 'to take', 'to return', 'to share', 'to give away', 'to keep'],
  },
  {
    word: '返す',
    reading: 'かえす',
    meaning: 'to return (something)',
    explanation: '返す (kaesu) means to give back something that was borrowed or taken.',
    distractors: ['to borrow', 'to keep', 'to lend', 'to lose', 'to take', 'to break', 'to buy', 'to find'],
  },
  {
    word: '間に合う',
    reading: 'まにあう',
    meaning: 'to be in time / to make it',
    explanation: '間に合う (maniau) means to arrive or finish in time before a deadline.',
    distractors: ['to be late', 'to miss', 'to rush', 'to hurry', 'to wait', 'to give up', 'to fail', 'to cancel'],
  },
  {
    word: '向かう',
    reading: 'むかう',
    meaning: 'to head toward',
    explanation: '向かう (mukau) means to move in the direction of a destination or to face toward something.',
    distractors: ['to arrive', 'to leave', 'to pass', 'to stop', 'to avoid', 'to return', 'to approach', 'to depart'],
  },
  {
    word: '向く',
    reading: 'むく',
    meaning: 'to face / to turn toward',
    explanation: '向く (muku) means to turn the body or face in a particular direction.',
    distractors: ['to look away', 'to turn around', 'to bow', 'to nod', 'to stare', 'to approach', 'to back away', 'to lean'],
  },
  {
    word: '割る',
    reading: 'わる',
    meaning: 'to break / to divide',
    explanation: '割る (waru) means to break something into pieces or to perform division in mathematics.',
    distractors: ['to connect', 'to combine', 'to multiply', 'to fix', 'to create', 'to press', 'to hold', 'to stretch'],
  },
  {
    word: '割れる',
    reading: 'われる',
    meaning: 'to break / to crack',
    explanation: '割れる (wareru) is the intransitive form, meaning something breaks or cracks by itself.',
    distractors: ['to bend', 'to melt', 'to shatter', 'to fold', 'to split', 'to harden', 'to soften', 'to combine'],
  },
  {
    word: '倒れる',
    reading: 'たおれる',
    meaning: 'to fall down / to collapse',
    explanation: '倒れる (taoreru) means to fall over or collapse, said of people, trees, buildings, etc.',
    distractors: ['to stand up', 'to lean', 'to bend', 'to jump', 'to slip', 'to stumble', 'to climb', 'to balance'],
  },
  {
    word: '片付ける',
    reading: 'かたづける',
    meaning: 'to tidy up / to put away',
    explanation: '片付ける (katazukeru) means to clean up a messy area or put things back in their proper place.',
    distractors: ['to scatter', 'to arrange', 'to throw away', 'to decorate', 'to move', 'to sort', 'to display', 'to prepare'],
  },
  {
    word: '過ぎる',
    reading: 'すぎる',
    meaning: 'to pass / to exceed',
    explanation: '過ぎる (sugiru) means to pass a point in time or space, or to go too far / overdo something.',
    distractors: ['to arrive', 'to stay', 'to wait', 'to begin', 'to finish', 'to approach', 'to miss', 'to skip'],
  },
  {
    word: '慣れる',
    reading: 'なれる',
    meaning: 'to get used to',
    explanation: '慣れる (nareru) means to become accustomed to something through experience over time.',
    distractors: ['to forget', 'to tire of', 'to improve', 'to struggle with', 'to enjoy', 'to start', 'to practice', 'to master'],
  },
  {
    word: '間違える',
    reading: 'まちがえる',
    meaning: 'to make a mistake',
    explanation: '間違える (machigaeru) means to do something incorrectly or to confuse one thing for another.',
    distractors: ['to correct', 'to notice', 'to repeat', 'to confirm', 'to understand', 'to forget', 'to miss', 'to guess'],
  },
  {
    word: '困る',
    reading: 'こまる',
    meaning: 'to be troubled / to be in difficulty',
    explanation: '困る (komaru) describes the state of being in trouble, at a loss, or facing a problem.',
    distractors: ['to be happy', 'to be bored', 'to be confused', 'to be angry', 'to be relieved', 'to be surprised', 'to be embarrassed', 'to be satisfied'],
  },
  {
    word: '似る',
    reading: 'にる',
    meaning: 'to resemble / to be similar',
    explanation: '似る (niru) means to look like or share characteristics with something else.',
    distractors: ['to differ', 'to match', 'to replace', 'to compare', 'to imitate', 'to copy', 'to contrast', 'to equal'],
  },
  {
    word: '足りる',
    reading: 'たりる',
    meaning: 'to be enough / to suffice',
    explanation: '足りる (tariru) means there is a sufficient amount of something.',
    distractors: ['to run out', 'to overflow', 'to waste', 'to save', 'to need', 'to use up', 'to lack', 'to exceed'],
  },
  {
    word: '違う',
    reading: 'ちがう',
    meaning: 'to differ / to be wrong',
    explanation: '違う (chigau) means to be different from something or to be incorrect.',
    distractors: ['to match', 'to agree', 'to resemble', 'to confirm', 'to equal', 'to overlap', 'to fit', 'to compare'],
  },
  {
    word: '別れる',
    reading: 'わかれる',
    meaning: 'to separate / to part',
    explanation: '別れる (wakareru) means to say goodbye and go in different directions, or to end a relationship.',
    distractors: ['to meet', 'to join', 'to reunite', 'to marry', 'to fight', 'to follow', 'to stay together', 'to visit'],
  },
  {
    word: '迷う',
    reading: 'まよう',
    meaning: 'to get lost / to be uncertain',
    explanation: '迷う (mayou) means to lose one\'s way or to be unable to decide between options.',
    distractors: ['to find the way', 'to decide', 'to confirm', 'to arrive', 'to plan', 'to guide', 'to follow', 'to escape'],
  },
  {
    word: '諦める',
    reading: 'あきらめる',
    meaning: 'to give up',
    explanation: '諦める (akirameru) means to stop trying and accept that something will not happen.',
    distractors: ['to try harder', 'to succeed', 'to restart', 'to continue', 'to hope', 'to plan', 'to work toward', 'to decide'],
  },
  {
    word: '祝う',
    reading: 'いわう',
    meaning: 'to celebrate / to congratulate',
    explanation: '祝う (iwau) means to mark a happy occasion with celebration or to offer congratulations.',
    distractors: ['to mourn', 'to regret', 'to apologize', 'to prepare', 'to forget', 'to ignore', 'to invite', 'to gather'],
  },
  {
    word: '怒る',
    reading: 'おこる',
    meaning: 'to get angry',
    explanation: '怒る (okoru) means to become angry or to scold someone out of anger.',
    distractors: ['to calm down', 'to laugh', 'to cry', 'to smile', 'to forgive', 'to worry', 'to complain', 'to shout'],
  },
  {
    word: '驚く',
    reading: 'おどろく',
    meaning: 'to be surprised',
    explanation: '驚く (odoroku) means to experience sudden surprise or shock at something unexpected.',
    distractors: ['to be bored', 'to be relieved', 'to be angry', 'to be confused', 'to be worried', 'to be happy', 'to be scared', 'to be disappointed'],
  },
  {
    word: '泣く',
    reading: 'なく',
    meaning: 'to cry',
    explanation: '泣く (naku) means to shed tears due to sadness, pain, or intense emotion.',
    distractors: ['to laugh', 'to shout', 'to smile', 'to sing', 'to sigh', 'to whisper', 'to scream', 'to groan'],
  },
  {
    word: '笑う',
    reading: 'わらう',
    meaning: 'to laugh / to smile',
    explanation: '笑う (warau) means to laugh out loud or to smile in amusement.',
    distractors: ['to cry', 'to frown', 'to shout', 'to sigh', 'to sulk', 'to stare', 'to whisper', 'to groan'],
  },
  {
    word: '叫ぶ',
    reading: 'さけぶ',
    meaning: 'to shout / to scream',
    explanation: '叫ぶ (sakebu) means to cry out loudly, whether from excitement, fear, or anger.',
    distractors: ['to whisper', 'to mumble', 'to laugh', 'to sing', 'to speak', 'to cry', 'to sigh', 'to be silent'],
  },
  {
    word: '眠る',
    reading: 'ねむる',
    meaning: 'to sleep',
    explanation: '眠る (nemuru) means to be in a state of sleep. More literary than 寝る.',
    distractors: ['to wake up', 'to rest', 'to doze', 'to yawn', 'to dream', 'to lie down', 'to rise', 'to relax'],
  },
  {
    word: '覚める',
    reading: 'さめる',
    meaning: 'to wake up / to come to one\'s senses',
    explanation: '覚める (sameru) means to wake from sleep or to become sober/clear-headed.',
    distractors: ['to fall asleep', 'to doze off', 'to dream', 'to rest', 'to tire', 'to yawn', 'to stretch', 'to relax'],
  },
  {
    word: '覚える',
    reading: 'おぼえる',
    meaning: 'to memorize / to remember',
    explanation: '覚える (oboeru) means to commit something to memory or to learn and retain information.',
    distractors: ['to forget', 'to misunderstand', 'to review', 'to study', 'to ignore', 'to confuse', 'to lose', 'to notice'],
  },
  {
    word: '忘れる',
    reading: 'わすれる',
    meaning: 'to forget',
    explanation: '忘れる (wasureru) means to fail to remember something that was once known.',
    distractors: ['to remember', 'to recall', 'to memorize', 'to learn', 'to notice', 'to repeat', 'to remind', 'to overlook'],
  },
  {
    word: '思い出す',
    reading: 'おもいだす',
    meaning: 'to recall / to remember',
    explanation: '思い出す (omoidasu) means to bring a memory back to mind.',
    distractors: ['to forget', 'to imagine', 'to dream', 'to predict', 'to notice', 'to confuse', 'to believe', 'to wonder'],
  },
  {
    word: '信じる',
    reading: 'しんじる',
    meaning: 'to believe / to trust',
    explanation: '信じる (shinjiru) means to accept something as true or to place trust in a person.',
    distractors: ['to doubt', 'to deny', 'to suspect', 'to confirm', 'to question', 'to test', 'to accept', 'to ignore'],
  },
  {
    word: '許す',
    reading: 'ゆるす',
    meaning: 'to forgive / to allow',
    explanation: '許す (yurusu) means to pardon someone for wrongdoing or to grant permission for something.',
    distractors: ['to blame', 'to punish', 'to refuse', 'to criticize', 'to judge', 'to warn', 'to scold', 'to ignore'],
  },
  {
    word: '断る',
    reading: 'ことわる',
    meaning: 'to refuse / to decline',
    explanation: '断る (kotowaru) means to say no to a request or invitation.',
    distractors: ['to accept', 'to agree', 'to promise', 'to suggest', 'to confirm', 'to offer', 'to approve', 'to request'],
  },
  {
    word: '誘う',
    reading: 'さそう',
    meaning: 'to invite / to tempt',
    explanation: '誘う (sasou) means to ask someone to join you in an activity or to lure someone.',
    distractors: ['to refuse', 'to ignore', 'to cancel', 'to leave', 'to warn', 'to push away', 'to forbid', 'to forget'],
  },
  {
    word: '謝る',
    reading: 'あやまる',
    meaning: 'to apologize',
    explanation: '謝る (ayamaru) means to say sorry and acknowledge a mistake or wrongdoing.',
    distractors: ['to praise', 'to blame', 'to forgive', 'to argue', 'to explain', 'to lie', 'to thank', 'to complain'],
  },
  {
    word: '褒める',
    reading: 'ほめる',
    meaning: 'to praise',
    explanation: '褒める (homeru) means to express admiration or approval for someone\'s actions or qualities.',
    distractors: ['to criticize', 'to scold', 'to blame', 'to ignore', 'to compare', 'to warn', 'to tease', 'to correct'],
  },
  {
    word: '叱る',
    reading: 'しかる',
    meaning: 'to scold',
    explanation: '叱る (shikaru) means to express strong disapproval of someone\'s behavior, especially from a position of authority.',
    distractors: ['to praise', 'to forgive', 'to teach', 'to reward', 'to encourage', 'to guide', 'to warn', 'to help'],
  },
  {
    word: '盗む',
    reading: 'ぬすむ',
    meaning: 'to steal',
    explanation: '盗む (nusumu) means to take something that belongs to another person without permission.',
    distractors: ['to borrow', 'to give', 'to find', 'to buy', 'to return', 'to lose', 'to sell', 'to hide'],
  },
  {
    word: '捨てる',
    reading: 'すてる',
    meaning: 'to throw away / to abandon',
    explanation: '捨てる (suteru) means to discard something or to abandon a person or place.',
    distractors: ['to keep', 'to collect', 'to find', 'to save', 'to use', 'to store', 'to donate', 'to repair'],
  },
  {
    word: '拾う',
    reading: 'ひろう',
    meaning: 'to pick up / to find',
    explanation: '拾う (hirou) means to pick something up from the ground or to find something that was lost.',
    distractors: ['to drop', 'to throw', 'to ignore', 'to hide', 'to leave', 'to break', 'to carry', 'to sort'],
  },
  {
    word: '並ぶ',
    reading: 'ならぶ',
    meaning: 'to line up / to stand in a row',
    explanation: '並ぶ (narabu) is intransitive, meaning people or things form a line or row.',
    distractors: ['to scatter', 'to crowd', 'to separate', 'to gather', 'to move', 'to leave', 'to approach', 'to arrange'],
  },
  {
    word: '並べる',
    reading: 'ならべる',
    meaning: 'to line up / to arrange',
    explanation: '並べる (naraberu) is transitive, meaning to place things in a row or in order.',
    distractors: ['to scatter', 'to hide', 'to remove', 'to sort', 'to count', 'to stack', 'to display', 'to organize'],
  },
  {
    word: '沸く',
    reading: 'わく',
    meaning: 'to boil / to heat up',
    explanation: '沸く (waku) is intransitive, meaning a liquid reaches boiling point.',
    distractors: ['to cool down', 'to freeze', 'to melt', 'to overflow', 'to evaporate', 'to drip', 'to splash', 'to thicken'],
  },
  {
    word: '沸かす',
    reading: 'わかす',
    meaning: 'to boil (water)',
    explanation: '沸かす (wakasu) is transitive, meaning to bring a liquid to boiling by applying heat.',
    distractors: ['to cool', 'to freeze', 'to pour', 'to drink', 'to fill', 'to heat slightly', 'to filter', 'to clean'],
  },
  {
    word: '乾く',
    reading: 'かわく',
    meaning: 'to dry',
    explanation: '乾く (kawaku) is intransitive, meaning something loses its moisture and becomes dry.',
    distractors: ['to wet', 'to soak', 'to rinse', 'to wash', 'to melt', 'to freeze', 'to soften', 'to harden'],
  },
  {
    word: '濡れる',
    reading: 'ぬれる',
    meaning: 'to get wet',
    explanation: '濡れる (nureru) is intransitive, meaning something becomes wet from contact with liquid.',
    distractors: ['to dry', 'to freeze', 'to absorb', 'to drip', 'to evaporate', 'to cool', 'to soften', 'to stain'],
  },
  {
    word: '焼く',
    reading: 'やく',
    meaning: 'to grill / to bake / to burn',
    explanation: '焼く (yaku) means to cook by applying direct heat, such as grilling, baking, or toasting.',
    distractors: ['to boil', 'to fry', 'to steam', 'to freeze', 'to chop', 'to peel', 'to mix', 'to season'],
  },
]

/** @type {Array<{word: string, reading: string, meaning: string, explanation: string, distractors: string[]}>} */
const nouns = [
  {
    word: '経験',
    reading: 'けいけん',
    meaning: 'experience',
    explanation: '経験 (keiken) refers to knowledge or skill gained through actually doing or living through something.',
    distractors: ['knowledge', 'memory', 'skill', 'ability', 'practice', 'training', 'education', 'background'],
  },
  {
    word: '関係',
    reading: 'かんけい',
    meaning: 'relationship / connection',
    explanation: '関係 (kankei) means a relationship or connection between people, things, or events.',
    distractors: ['contact', 'meeting', 'conflict', 'agreement', 'distance', 'bond', 'interaction', 'partnership'],
  },
  {
    word: '習慣',
    reading: 'しゅうかん',
    meaning: 'habit / custom',
    explanation: '習慣 (shuukan) refers to a regular practice or custom, either personal or cultural.',
    distractors: ['rule', 'tradition', 'routine', 'hobby', 'culture', 'behavior', 'policy', 'manner'],
  },
  {
    word: '機会',
    reading: 'きかい',
    meaning: 'opportunity / chance',
    explanation: '機会 (kikai) means a favorable time or set of circumstances that makes something possible.',
    distractors: ['event', 'meeting', 'possibility', 'luck', 'timing', 'trial', 'experience', 'moment'],
  },
  {
    word: '準備',
    reading: 'じゅんび',
    meaning: 'preparation',
    explanation: '準備 (junbi) refers to getting ready for an event or task by arranging what is needed.',
    distractors: ['practice', 'planning', 'training', 'rehearsal', 'setup', 'arrangement', 'gathering', 'procedure'],
  },
  {
    word: '予定',
    reading: 'よてい',
    meaning: 'schedule / plan',
    explanation: '予定 (yotei) means a plan, schedule, or something that is expected to happen.',
    distractors: ['result', 'goal', 'event', 'appointment', 'deadline', 'calendar', 'routine', 'reservation'],
  },
  {
    word: '計画',
    reading: 'けいかく',
    meaning: 'plan / project',
    explanation: '計画 (keikaku) refers to a detailed scheme or strategy for achieving a goal.',
    distractors: ['schedule', 'design', 'method', 'policy', 'system', 'idea', 'proposal', 'program'],
  },
  {
    word: '技術',
    reading: 'ぎじゅつ',
    meaning: 'technology / technique',
    explanation: '技術 (gijutsu) means technical skill, craftsmanship, or applied technology.',
    distractors: ['science', 'art', 'method', 'ability', 'knowledge', 'tool', 'invention', 'system'],
  },
  {
    word: '産業',
    reading: 'さんぎょう',
    meaning: 'industry',
    explanation: '産業 (sangyou) refers to a branch of economic or commercial activity, such as agriculture or manufacturing.',
    distractors: ['business', 'trade', 'economy', 'company', 'work', 'sector', 'market', 'production'],
  },
  {
    word: '政治',
    reading: 'せいじ',
    meaning: 'politics',
    explanation: '政治 (seiji) refers to the activities associated with governance and political affairs.',
    distractors: ['economy', 'law', 'society', 'government', 'culture', 'history', 'military', 'diplomacy'],
  },
  {
    word: '経済',
    reading: 'けいざい',
    meaning: 'economy',
    explanation: '経済 (keizai) refers to the system of trade, industry, and money of a country or region.',
    distractors: ['politics', 'finance', 'budget', 'trade', 'market', 'income', 'industry', 'development'],
  },
  {
    word: '社会',
    reading: 'しゃかい',
    meaning: 'society',
    explanation: '社会 (shakai) refers to people living together in communities and the structures they form.',
    distractors: ['culture', 'community', 'organization', 'group', 'nation', 'public', 'world', 'class'],
  },
  {
    word: '文化',
    reading: 'ぶんか',
    meaning: 'culture',
    explanation: '文化 (bunka) encompasses the customs, arts, and social institutions of a particular nation or people.',
    distractors: ['tradition', 'society', 'history', 'education', 'art', 'language', 'religion', 'lifestyle'],
  },
  {
    word: '環境',
    reading: 'かんきょう',
    meaning: 'environment',
    explanation: '環境 (kankyou) refers to the natural world or the surroundings in which a person lives or works.',
    distractors: ['nature', 'climate', 'atmosphere', 'surroundings', 'condition', 'setting', 'habitat', 'ecosystem'],
  },
  {
    word: '条件',
    reading: 'じょうけん',
    meaning: 'condition / requirement',
    explanation: '条件 (jouken) means a requirement or stipulation that must be met for something to happen.',
    distractors: ['rule', 'limit', 'standard', 'request', 'agreement', 'obligation', 'situation', 'assumption'],
  },
  {
    word: '原因',
    reading: 'げんいん',
    meaning: 'cause / reason',
    explanation: '原因 (gen\'in) refers to the thing that makes something else happen; the root cause.',
    distractors: ['result', 'effect', 'problem', 'purpose', 'motive', 'background', 'factor', 'situation'],
  },
  {
    word: '結果',
    reading: 'けっか',
    meaning: 'result / outcome',
    explanation: '結果 (kekka) refers to the outcome or consequence that follows from an action or event.',
    distractors: ['cause', 'process', 'effort', 'goal', 'prediction', 'beginning', 'progress', 'plan'],
  },
  {
    word: '影響',
    reading: 'えいきょう',
    meaning: 'influence / effect',
    explanation: '影響 (eikyou) refers to the effect that one thing has on another.',
    distractors: ['result', 'damage', 'change', 'benefit', 'impact', 'cause', 'pressure', 'contribution'],
  },
  {
    word: '方法',
    reading: 'ほうほう',
    meaning: 'method / way',
    explanation: '方法 (houhou) refers to the way or means by which something is done.',
    distractors: ['system', 'tool', 'step', 'plan', 'technique', 'style', 'process', 'approach'],
  },
  {
    word: '目的',
    reading: 'もくてき',
    meaning: 'purpose / goal',
    explanation: '目的 (mokuteki) refers to the aim or intention behind an action.',
    distractors: ['result', 'plan', 'reason', 'method', 'task', 'wish', 'achievement', 'priority'],
  },
  {
    word: '意味',
    reading: 'いみ',
    meaning: 'meaning',
    explanation: '意味 (imi) refers to the meaning or significance of a word, action, or event.',
    distractors: ['value', 'purpose', 'explanation', 'word', 'definition', 'idea', 'impression', 'content'],
  },
  {
    word: '理由',
    reading: 'りゆう',
    meaning: 'reason',
    explanation: '理由 (riyuu) refers to the reason or cause that explains why something happened.',
    distractors: ['excuse', 'purpose', 'cause', 'origin', 'motive', 'basis', 'background', 'factor'],
  },
  {
    word: '事実',
    reading: 'じじつ',
    meaning: 'fact / truth',
    explanation: '事実 (jijitsu) refers to something that is actually true or that has actually happened.',
    distractors: ['rumor', 'opinion', 'idea', 'story', 'theory', 'assumption', 'possibility', 'claim'],
  },
  {
    word: '番組',
    reading: 'ばんぐみ',
    meaning: 'program (TV/radio)',
    explanation: '番組 (bangumi) refers to a show or program broadcast on television or radio.',
    distractors: ['channel', 'broadcast', 'episode', 'schedule', 'news', 'advertisement', 'movie', 'performance'],
  },
  {
    word: '景色',
    reading: 'けしき',
    meaning: 'scenery / view',
    explanation: '景色 (keshiki) refers to the natural scenery or view seen from a particular point.',
    distractors: ['weather', 'nature', 'mountain', 'sight', 'horizon', 'background', 'photograph', 'location'],
  },
  {
    word: '自然',
    reading: 'しぜん',
    meaning: 'nature',
    explanation: '自然 (shizen) refers to the physical world and everything in it not made by humans.',
    distractors: ['environment', 'wilderness', 'earth', 'ecology', 'weather', 'landscape', 'animals', 'plants'],
  },
  {
    word: '気温',
    reading: 'きおん',
    meaning: 'air temperature',
    explanation: '気温 (kion) refers to the temperature of the air, often as measured by a thermometer.',
    distractors: ['humidity', 'weather', 'heat', 'climate', 'season', 'wind', 'pressure', 'forecast'],
  },
  {
    word: '季節',
    reading: 'きせつ',
    meaning: 'season',
    explanation: '季節 (kisetsu) refers to one of the four seasons: spring, summer, autumn, or winter.',
    distractors: ['month', 'weather', 'period', 'year', 'climate', 'time', 'phase', 'festival'],
  },
  {
    word: '交通',
    reading: 'こうつう',
    meaning: 'traffic / transportation',
    explanation: '交通 (koutsuu) refers to the movement of vehicles or people, or transportation systems.',
    distractors: ['road', 'vehicle', 'travel', 'route', 'transport', 'commute', 'signal', 'access'],
  },
  {
    word: '事故',
    reading: 'じこ',
    meaning: 'accident',
    explanation: '事故 (jiko) refers to an unplanned, unexpected event that causes damage or injury.',
    distractors: ['incident', 'crime', 'disaster', 'mistake', 'problem', 'injury', 'danger', 'collision'],
  },
  {
    word: '被害',
    reading: 'ひがい',
    meaning: 'damage / harm',
    explanation: '被害 (higai) refers to damage or injury suffered as a result of an accident, crime, or disaster.',
    distractors: ['loss', 'disaster', 'cost', 'risk', 'suffering', 'injury', 'destruction', 'consequence'],
  },
  {
    word: '地震',
    reading: 'じしん',
    meaning: 'earthquake',
    explanation: '地震 (jishin) refers to a sudden shaking of the ground caused by movement of the earth\'s crust.',
    distractors: ['typhoon', 'flood', 'tsunami', 'volcano', 'storm', 'landslide', 'drought', 'fire'],
  },
  {
    word: '台風',
    reading: 'たいふう',
    meaning: 'typhoon',
    explanation: '台風 (taifuu) refers to a powerful tropical storm that forms in the Pacific Ocean.',
    distractors: ['earthquake', 'flood', 'tsunami', 'thunderstorm', 'blizzard', 'drought', 'hurricane', 'volcano'],
  },
  {
    word: '人口',
    reading: 'じんこう',
    meaning: 'population',
    explanation: '人口 (jinkou) refers to the number of people living in a particular area.',
    distractors: ['density', 'growth', 'citizen', 'average age', 'immigration', 'household', 'community', 'census'],
  },
  {
    word: '割合',
    reading: 'わりあい',
    meaning: 'proportion / ratio',
    explanation: '割合 (wariai) refers to the relative amount of something expressed as a fraction or percentage.',
    distractors: ['number', 'amount', 'total', 'difference', 'average', 'percentage', 'rate', 'quantity'],
  },
  {
    word: '平均',
    reading: 'へいきん',
    meaning: 'average',
    explanation: '平均 (heikin) refers to the arithmetic mean or a typical or ordinary level.',
    distractors: ['total', 'median', 'maximum', 'minimum', 'range', 'ratio', 'standard', 'estimate'],
  },
  {
    word: '収入',
    reading: 'しゅうにゅう',
    meaning: 'income / earnings',
    explanation: '収入 (shuunyuu) refers to money earned from work or other sources.',
    distractors: ['expense', 'savings', 'profit', 'salary', 'bonus', 'tax', 'debt', 'cost'],
  },
  {
    word: '費用',
    reading: 'ひよう',
    meaning: 'cost / expense',
    explanation: '費用 (hiyou) refers to money paid or charged for something.',
    distractors: ['income', 'price', 'budget', 'tax', 'payment', 'fee', 'savings', 'profit'],
  },
  {
    word: '利益',
    reading: 'りえき',
    meaning: 'profit / benefit',
    explanation: '利益 (rieki) refers to financial gain or advantage obtained from something.',
    distractors: ['loss', 'expense', 'cost', 'income', 'investment', 'risk', 'purpose', 'value'],
  },
  {
    word: '効果',
    reading: 'こうか',
    meaning: 'effect / result',
    explanation: '効果 (kouka) refers to the positive outcome or result produced by an action.',
    distractors: ['cause', 'influence', 'impact', 'purpose', 'damage', 'benefit', 'reaction', 'consequence'],
  },
  {
    word: '制度',
    reading: 'せいど',
    meaning: 'system / institution',
    explanation: '制度 (seido) refers to an established social, legal, or organizational system.',
    distractors: ['law', 'rule', 'policy', 'organization', 'method', 'structure', 'regulation', 'program'],
  },
  {
    word: '規則',
    reading: 'きそく',
    meaning: 'rule / regulation',
    explanation: '規則 (kisoku) refers to a rule or regulation that must be followed.',
    distractors: ['law', 'order', 'policy', 'standard', 'custom', 'guideline', 'contract', 'norm'],
  },
  {
    word: '権利',
    reading: 'けんり',
    meaning: 'right / privilege',
    explanation: '権利 (kenri) refers to a legal or moral entitlement to do or have something.',
    distractors: ['duty', 'obligation', 'rule', 'freedom', 'permission', 'benefit', 'authority', 'law'],
  },
  {
    word: '義務',
    reading: 'ぎむ',
    meaning: 'duty / obligation',
    explanation: '義務 (gimu) refers to a moral or legal responsibility to do something.',
    distractors: ['right', 'freedom', 'choice', 'benefit', 'task', 'law', 'permission', 'contract'],
  },
  {
    word: '責任',
    reading: 'せきにん',
    meaning: 'responsibility',
    explanation: '責任 (sekinin) refers to the state of being accountable for something.',
    distractors: ['duty', 'burden', 'obligation', 'role', 'ability', 'authority', 'mistake', 'care'],
  },
  {
    word: '印象',
    reading: 'いんしょう',
    meaning: 'impression',
    explanation: '印象 (inshou) refers to the feeling or opinion formed about someone or something.',
    distractors: ['image', 'opinion', 'reputation', 'appearance', 'feeling', 'memory', 'thought', 'view'],
  },
  {
    word: '態度',
    reading: 'たいど',
    meaning: 'attitude / manner',
    explanation: '態度 (taido) refers to the way a person behaves or presents themselves toward others.',
    distractors: ['opinion', 'character', 'feeling', 'action', 'expression', 'habit', 'behavior', 'reaction'],
  },
  {
    word: '性格',
    reading: 'せいかく',
    meaning: 'personality / character',
    explanation: '性格 (seikaku) refers to the combination of characteristics or qualities that form a person\'s nature.',
    distractors: ['habit', 'attitude', 'talent', 'appearance', 'mood', 'emotion', 'behavior', 'ability'],
  },
  {
    word: '能力',
    reading: 'のうりょく',
    meaning: 'ability / capacity',
    explanation: '能力 (nouryoku) refers to the mental or physical capacity to do something.',
    distractors: ['skill', 'talent', 'experience', 'knowledge', 'strength', 'effort', 'intelligence', 'power'],
  },
  {
    word: '才能',
    reading: 'さいのう',
    meaning: 'talent / gift',
    explanation: '才能 (sainou) refers to a natural aptitude or skill for something.',
    distractors: ['ability', 'skill', 'effort', 'experience', 'intelligence', 'knowledge', 'potential', 'passion'],
  },
  {
    word: '努力',
    reading: 'どりょく',
    meaning: 'effort / hard work',
    explanation: '努力 (doryoku) refers to a sustained attempt or hard work toward achieving something.',
    distractors: ['talent', 'ability', 'success', 'failure', 'practice', 'skill', 'time', 'progress'],
  },
  {
    word: '成功',
    reading: 'せいこう',
    meaning: 'success',
    explanation: '成功 (seikou) refers to the accomplishment of an aim or purpose.',
    distractors: ['failure', 'effort', 'progress', 'achievement', 'result', 'goal', 'experience', 'attempt'],
  },
  {
    word: '失敗',
    reading: 'しっぱい',
    meaning: 'failure / mistake',
    explanation: '失敗 (shippai) refers to the lack of success or a mistake made in an attempt.',
    distractors: ['success', 'error', 'problem', 'loss', 'effort', 'result', 'accident', 'setback'],
  },
  {
    word: '希望',
    reading: 'きぼう',
    meaning: 'hope / wish',
    explanation: '希望 (kibou) refers to a feeling of expectation and desire for something good to happen.',
    distractors: ['dream', 'goal', 'plan', 'expectation', 'desire', 'wish', 'belief', 'possibility'],
  },
  {
    word: '目標',
    reading: 'もくひょう',
    meaning: 'goal / target',
    explanation: '目標 (mokuhyou) refers to an objective or aim that one works toward.',
    distractors: ['dream', 'hope', 'plan', 'result', 'purpose', 'standard', 'reward', 'ideal'],
  },
  {
    word: '夢',
    reading: 'ゆめ',
    meaning: 'dream',
    explanation: '夢 (yume) refers to images experienced during sleep or an aspiration one wishes to achieve.',
    distractors: ['hope', 'goal', 'memory', 'imagination', 'thought', 'wish', 'fantasy', 'story'],
  },
  {
    word: '記憶',
    reading: 'きおく',
    meaning: 'memory',
    explanation: '記憶 (kioku) refers to the ability to remember or a particular thing remembered.',
    distractors: ['thought', 'imagination', 'dream', 'experience', 'knowledge', 'feeling', 'past', 'mind'],
  },
  {
    word: '感情',
    reading: 'かんじょう',
    meaning: 'emotion / feeling',
    explanation: '感情 (kanjou) refers to any strong feeling such as joy, anger, or sadness.',
    distractors: ['thought', 'opinion', 'attitude', 'expression', 'reaction', 'mood', 'desire', 'instinct'],
  },
  {
    word: '表情',
    reading: 'ひょうじょう',
    meaning: 'facial expression',
    explanation: '表情 (hyoujou) refers to a look on a person\'s face that conveys a particular emotion.',
    distractors: ['gesture', 'attitude', 'feeling', 'appearance', 'voice', 'action', 'emotion', 'reaction'],
  },
  {
    word: '笑顔',
    reading: 'えがお',
    meaning: 'smile / smiling face',
    explanation: '笑顔 (egao) refers to a smiling expression on someone\'s face.',
    distractors: ['laugh', 'cry', 'frown', 'expression', 'joy', 'happiness', 'face', 'look'],
  },
]

/** @type {Array<{word: string, reading: string, meaning: string, explanation: string, distractors: string[]}>} */
const adjectives = [
  {
    word: '厳しい',
    reading: 'きびしい',
    meaning: 'strict / severe',
    explanation: '厳しい (kibishii) describes someone who demands high standards, or conditions that are harsh.',
    distractors: ['gentle', 'kind', 'easy', 'relaxed', 'soft', 'simple', 'fair', 'weak'],
  },
  {
    word: '激しい',
    reading: 'はげしい',
    meaning: 'intense / violent',
    explanation: '激しい (hageshii) describes something that is very intense, fierce, or extreme.',
    distractors: ['mild', 'calm', 'gentle', 'quiet', 'soft', 'moderate', 'weak', 'slow'],
  },
  {
    word: '恥ずかしい',
    reading: 'はずかしい',
    meaning: 'embarrassing / ashamed',
    explanation: '恥ずかしい (hazukashii) describes the feeling of embarrassment or shame.',
    distractors: ['proud', 'confident', 'comfortable', 'relaxed', 'pleased', 'brave', 'excited', 'satisfied'],
  },
  {
    word: '懐かしい',
    reading: 'なつかしい',
    meaning: 'nostalgic / dear',
    explanation: '懐かしい (natsukashii) describes a warm feeling when recalling something from the past.',
    distractors: ['new', 'unfamiliar', 'forgotten', 'strange', 'boring', 'modern', 'distant', 'cold'],
  },
  {
    word: '珍しい',
    reading: 'めずらしい',
    meaning: 'rare / unusual',
    explanation: '珍しい (mezurashii) describes something not commonly seen or encountered.',
    distractors: ['common', 'familiar', 'typical', 'normal', 'plain', 'ordinary', 'popular', 'frequent'],
  },
  {
    word: '素晴らしい',
    reading: 'すばらしい',
    meaning: 'wonderful / splendid',
    explanation: '素晴らしい (subarashii) expresses that something is remarkably good or admirable.',
    distractors: ['awful', 'boring', 'ordinary', 'mediocre', 'terrible', 'dull', 'simple', 'weak'],
  },
  {
    word: '正しい',
    reading: 'ただしい',
    meaning: 'correct / right',
    explanation: '正しい (tadashii) means conforming to fact or truth, or morally right.',
    distractors: ['wrong', 'incorrect', 'false', 'mistaken', 'unfair', 'biased', 'odd', 'strange'],
  },
  {
    word: '詳しい',
    reading: 'くわしい',
    meaning: 'detailed / knowledgeable',
    explanation: '詳しい (kuwashii) means knowing a lot about a topic or describing something in detail.',
    distractors: ['vague', 'general', 'ignorant', 'unaware', 'simple', 'brief', 'rough', 'unclear'],
  },
  {
    word: '親しい',
    reading: 'したしい',
    meaning: 'close / intimate',
    explanation: '親しい (shitashii) describes a relationship that is close and friendly.',
    distractors: ['distant', 'cold', 'unfamiliar', 'formal', 'hostile', 'neutral', 'polite', 'indifferent'],
  },
  {
    word: '貧しい',
    reading: 'まずしい',
    meaning: 'poor / impoverished',
    explanation: '貧しい (mazushii) describes someone lacking money or material possessions.',
    distractors: ['rich', 'wealthy', 'successful', 'comfortable', 'generous', 'fortunate', 'content', 'secure'],
  },
  {
    word: '苦しい',
    reading: 'くるしい',
    meaning: 'painful / difficult',
    explanation: '苦しい (kurushii) describes a state of physical or mental suffering.',
    distractors: ['comfortable', 'easy', 'pleasant', 'relaxed', 'satisfied', 'happy', 'free', 'light'],
  },
  {
    word: '悲しい',
    reading: 'かなしい',
    meaning: 'sad',
    explanation: '悲しい (kanashii) describes a feeling of deep sorrow or unhappiness.',
    distractors: ['happy', 'joyful', 'excited', 'content', 'cheerful', 'relieved', 'proud', 'grateful'],
  },
  {
    word: '嬉しい',
    reading: 'うれしい',
    meaning: 'happy / glad',
    explanation: '嬉しい (ureshii) describes a feeling of happiness or delight.',
    distractors: ['sad', 'upset', 'lonely', 'disappointed', 'worried', 'tired', 'bored', 'angry'],
  },
  {
    word: '優しい',
    reading: 'やさしい',
    meaning: 'kind / gentle',
    explanation: '優しい (yasashii) describes someone who is caring, kind-hearted, or gentle in manner.',
    distractors: ['strict', 'harsh', 'cold', 'selfish', 'rough', 'indifferent', 'cruel', 'arrogant'],
  },
  {
    word: '美しい',
    reading: 'うつくしい',
    meaning: 'beautiful',
    explanation: '美しい (utsukushii) describes something that is pleasing to the eye or aesthetically perfect.',
    distractors: ['ugly', 'plain', 'ordinary', 'dull', 'dirty', 'messy', 'rough', 'colorless'],
  },
  {
    word: '面白い',
    reading: 'おもしろい',
    meaning: 'interesting / funny',
    explanation: '面白い (omoshiroi) describes something that is interesting, amusing, or enjoyable.',
    distractors: ['boring', 'dull', 'unpleasant', 'serious', 'strange', 'sad', 'difficult', 'tiring'],
  },
  {
    word: '暗い',
    reading: 'くらい',
    meaning: 'dark / gloomy',
    explanation: '暗い (kurai) describes a place with little light, or a person with a gloomy disposition.',
    distractors: ['bright', 'light', 'cheerful', 'colorful', 'clear', 'shining', 'warm', 'open'],
  },
  {
    word: '明るい',
    reading: 'あかるい',
    meaning: 'bright / cheerful',
    explanation: '明るい (akarui) describes something well-lit or a person with an upbeat personality.',
    distractors: ['dark', 'dim', 'gloomy', 'quiet', 'serious', 'shy', 'cold', 'pale'],
  },
  {
    word: '深い',
    reading: 'ふかい',
    meaning: 'deep',
    explanation: '深い (fukai) describes great depth physically or profundity of thought or emotion.',
    distractors: ['shallow', 'light', 'simple', 'thin', 'surface', 'brief', 'basic', 'narrow'],
  },
  {
    word: '浅い',
    reading: 'あさい',
    meaning: 'shallow',
    explanation: '浅い (asai) describes something that is not deep, or a thought that lacks depth.',
    distractors: ['deep', 'profound', 'complex', 'wide', 'long', 'serious', 'heavy', 'strong'],
  },
  {
    word: '太い',
    reading: 'ふとい',
    meaning: 'thick / fat',
    explanation: '太い (futoi) describes something wide in diameter or a person who is large.',
    distractors: ['thin', 'narrow', 'slim', 'small', 'weak', 'short', 'light', 'flat'],
  },
  {
    word: '細い',
    reading: 'ほそい',
    meaning: 'thin / slender',
    explanation: '細い (hosoi) describes something narrow in width or a person with a slim build.',
    distractors: ['thick', 'wide', 'fat', 'large', 'strong', 'heavy', 'tall', 'broad'],
  },
  {
    word: '丁寧な',
    reading: 'ていねいな',
    meaning: 'polite / careful',
    explanation: '丁寧な (teinei na) describes someone polite in manner or work done with great care.',
    distractors: ['rude', 'careless', 'rough', 'casual', 'lazy', 'hasty', 'blunt', 'sloppy'],
  },
  {
    word: '大切な',
    reading: 'たいせつな',
    meaning: 'important / precious',
    explanation: '大切な (taisetsu na) describes something highly valued or treated with care.',
    distractors: ['unimportant', 'worthless', 'cheap', 'forgotten', 'unnecessary', 'replaceable', 'minor', 'trivial'],
  },
  {
    word: '必要な',
    reading: 'ひつような',
    meaning: 'necessary',
    explanation: '必要な (hitsuyou na) describes something that is needed or required.',
    distractors: ['unnecessary', 'optional', 'useless', 'extra', 'convenient', 'sufficient', 'available', 'limited'],
  },
  {
    word: '重要な',
    reading: 'じゅうような',
    meaning: 'important / significant',
    explanation: '重要な (juuyou na) describes something of great importance or consequence.',
    distractors: ['trivial', 'minor', 'unrelated', 'optional', 'basic', 'secondary', 'routine', 'simple'],
  },
  {
    word: '複雑な',
    reading: 'ふくざつな',
    meaning: 'complicated / complex',
    explanation: '複雑な (fukuzatsu na) describes something with many parts or difficult to understand.',
    distractors: ['simple', 'clear', 'easy', 'straightforward', 'basic', 'plain', 'direct', 'obvious'],
  },
  {
    word: '簡単な',
    reading: 'かんたんな',
    meaning: 'easy / simple',
    explanation: '簡単な (kantan na) describes something that is not difficult or done without effort.',
    distractors: ['difficult', 'complex', 'hard', 'detailed', 'advanced', 'tricky', 'heavy', 'long'],
  },
  {
    word: '自由な',
    reading: 'じゆうな',
    meaning: 'free / unrestricted',
    explanation: '自由な (jiyuu na) describes the state of being free from constraints or restrictions.',
    distractors: ['restricted', 'controlled', 'bound', 'limited', 'strict', 'regulated', 'forced', 'obligated'],
  },
  {
    word: '安全な',
    reading: 'あんぜんな',
    meaning: 'safe',
    explanation: '安全な (anzen na) describes a situation or place free from danger or risk.',
    distractors: ['dangerous', 'risky', 'harmful', 'unstable', 'scary', 'uncertain', 'fragile', 'forbidden'],
  },
  {
    word: '危険な',
    reading: 'きけんな',
    meaning: 'dangerous',
    explanation: '危険な (kiken na) describes something that is likely to cause harm or injury.',
    distractors: ['safe', 'secure', 'harmless', 'stable', 'gentle', 'calm', 'careful', 'protected'],
  },
  {
    word: '静かな',
    reading: 'しずかな',
    meaning: 'quiet / calm',
    explanation: '静かな (shizuka na) describes an environment with little noise or a person who is calm.',
    distractors: ['noisy', 'loud', 'busy', 'active', 'lively', 'crowded', 'exciting', 'rough'],
  },
  {
    word: '盛んな',
    reading: 'さかんな',
    meaning: 'thriving / popular',
    explanation: '盛んな (sakan na) describes something that is active, popular, or in full operation.',
    distractors: ['declining', 'weak', 'inactive', 'ignored', 'rare', 'minor', 'forgotten', 'quiet'],
  },
  {
    word: '豊かな',
    reading: 'ゆたかな',
    meaning: 'rich / abundant',
    explanation: '豊かな (yutaka na) describes something with a plentiful supply or great wealth.',
    distractors: ['poor', 'scarce', 'empty', 'limited', 'simple', 'lacking', 'thin', 'dry'],
  },
  {
    word: '確かな',
    reading: 'たしかな',
    meaning: 'certain / reliable',
    explanation: '確かな (tashika na) describes something definite, reliable, or beyond doubt.',
    distractors: ['uncertain', 'doubtful', 'vague', 'unreliable', 'unclear', 'unstable', 'approximate', 'risky'],
  },
]

/** @type {Array<{word: string, reading: string, meaning: string, explanation: string, distractors: string[]}>} */
const adverbs = [
  {
    word: '必ず',
    reading: 'かならず',
    meaning: 'certainly / without fail',
    explanation: '必ず (kanarazu) means something will definitely happen, without exception.',
    distractors: ['maybe', 'sometimes', 'rarely', 'probably', 'almost', 'possibly', 'occasionally', 'hardly'],
  },
  {
    word: 'やはり',
    reading: 'やはり',
    meaning: 'as expected / after all',
    explanation: 'やはり (yahari) indicates that something turned out as one expected or suspected.',
    distractors: ['surprisingly', 'suddenly', 'however', 'actually', 'therefore', 'for the first time', 'gradually', 'barely'],
  },
  {
    word: '決して',
    reading: 'けっして',
    meaning: 'never (with negative)',
    explanation: '決して (kesshite) is used with a negative verb to express absolute negation.',
    distractors: ['always', 'sometimes', 'usually', 'often', 'again', 'certainly', 'already', 'still'],
  },
  {
    word: '直接',
    reading: 'ちょくせつ',
    meaning: 'directly',
    explanation: '直接 (chokusetsu) means without intermediary, going straight to the point or place.',
    distractors: ['indirectly', 'gradually', 'suddenly', 'briefly', 'repeatedly', 'separately', 'roughly', 'clearly'],
  },
  {
    word: '次第に',
    reading: 'しだいに',
    meaning: 'gradually',
    explanation: '次第に (shidai ni) means something changes little by little over time.',
    distractors: ['suddenly', 'immediately', 'completely', 'barely', 'repeatedly', 'rarely', 'definitely', 'quickly'],
  },
  {
    word: '段々',
    reading: 'だんだん',
    meaning: 'gradually / little by little',
    explanation: '段々 (dandan) means changing step by step, slowly increasing or decreasing.',
    distractors: ['suddenly', 'all at once', 'quickly', 'rarely', 'constantly', 'briefly', 'repeatedly', 'never'],
  },
  {
    word: '急に',
    reading: 'きゅうに',
    meaning: 'suddenly',
    explanation: '急に (kyuu ni) means something happens abruptly and without warning.',
    distractors: ['slowly', 'gradually', 'calmly', 'carefully', 'eventually', 'steadily', 'briefly', 'continuously'],
  },
  {
    word: '突然',
    reading: 'とつぜん',
    meaning: 'suddenly / all of a sudden',
    explanation: '突然 (totsuzen) describes something that happens completely without warning.',
    distractors: ['slowly', 'gradually', 'calmly', 'finally', 'often', 'rarely', 'constantly', 'briefly'],
  },
  {
    word: '特に',
    reading: 'とくに',
    meaning: 'especially / particularly',
    explanation: '特に (toku ni) means more than usual or to a special degree.',
    distractors: ['generally', 'rarely', 'equally', 'mostly', 'briefly', 'just', 'barely', 'commonly'],
  },
  {
    word: '実は',
    reading: 'じつは',
    meaning: 'actually / in fact',
    explanation: '実は (jitsu wa) introduces a truth that may be surprising or previously unknown.',
    distractors: ['apparently', 'supposedly', 'probably', 'finally', 'suddenly', 'as expected', 'fortunately', 'unfortunately'],
  },
  {
    word: '確かに',
    reading: 'たしかに',
    meaning: 'certainly / indeed',
    explanation: '確かに (tashika ni) means admitting something is definitely true.',
    distractors: ['perhaps', 'maybe', 'probably', 'supposedly', 'vaguely', 'barely', 'doubtfully', 'seemingly'],
  },
  {
    word: '全く',
    reading: 'まったく',
    meaning: 'entirely / not at all (with negative)',
    explanation: '全く (mattaku) means completely when used positively, or not at all when used with a negative.',
    distractors: ['partially', 'almost', 'rarely', 'slightly', 'mainly', 'barely', 'sometimes', 'mostly'],
  },
  {
    word: 'ほとんど',
    reading: 'ほとんど',
    meaning: 'mostly / almost',
    explanation: 'ほとんど (hotondo) means nearly all of something, or very little remaining.',
    distractors: ['entirely', 'partly', 'barely', 'sometimes', 'rarely', 'occasionally', 'always', 'never'],
  },
  {
    word: 'かなり',
    reading: 'かなり',
    meaning: 'quite / considerably',
    explanation: 'かなり (kanari) means to a significant or noticeable degree.',
    distractors: ['slightly', 'barely', 'hardly', 'just a little', 'somewhat', 'often', 'rarely', 'typically'],
  },
  {
    word: '十分',
    reading: 'じゅうぶん',
    meaning: 'sufficiently / enough',
    explanation: '十分 (juubun) means to an adequate degree; enough.',
    distractors: ['insufficiently', 'barely', 'excessively', 'partly', 'hardly', 'roughly', 'slightly', 'mostly'],
  },
  {
    word: '多少',
    reading: 'たしょう',
    meaning: 'somewhat / a little',
    explanation: '多少 (tashou) means to some degree; more or less.',
    distractors: ['a lot', 'entirely', 'not at all', 'very', 'always', 'mostly', 'rapidly', 'clearly'],
  },
  {
    word: 'たまに',
    reading: 'たまに',
    meaning: 'occasionally / once in a while',
    explanation: 'たまに (tama ni) means infrequently, on rare occasions.',
    distractors: ['always', 'often', 'frequently', 'constantly', 'never', 'regularly', 'daily', 'usually'],
  },
  {
    word: '常に',
    reading: 'つねに',
    meaning: 'always / constantly',
    explanation: '常に (tsune ni) means at all times, without exception.',
    distractors: ['sometimes', 'rarely', 'never', 'occasionally', 'often', 'briefly', 'suddenly', 'recently'],
  },
  {
    word: '再び',
    reading: 'ふたたび',
    meaning: 'again / once more',
    explanation: '再び (futatabi) means doing something for the second time or returning to a previous state.',
    distractors: ['for the first time', 'finally', 'never', 'continuously', 'rarely', 'quickly', 'suddenly', 'gradually'],
  },
  {
    word: '互いに',
    reading: 'たがいに',
    meaning: 'mutually / each other',
    explanation: '互いに (tagai ni) means two or more parties doing something to or for each other.',
    distractors: ['separately', 'individually', 'one-sidedly', 'independently', 'alone', 'together', 'competitively', 'in turn'],
  },
  {
    word: '思わず',
    reading: 'おもわず',
    meaning: 'unintentionally / reflexively',
    explanation: '思わず (omowazu) means doing something without intending to, as a reflex.',
    distractors: ['deliberately', 'carefully', 'consciously', 'willingly', 'forcibly', 'gradually', 'immediately', 'openly'],
  },
  {
    word: 'やがて',
    reading: 'やがて',
    meaning: 'before long / eventually',
    explanation: 'やがて (yagate) means after a passage of time, something will come to pass.',
    distractors: ['immediately', 'suddenly', 'already', 'never', 'constantly', 'recently', 'rarely', 'temporarily'],
  },
  {
    word: 'ようやく',
    reading: 'ようやく',
    meaning: 'finally / at last',
    explanation: 'ようやく (youyaku) means after a long wait or struggle, something has been achieved.',
    distractors: ['immediately', 'suddenly', 'never', 'gradually', 'barely', 'almost', 'quickly', 'by chance'],
  },
  {
    word: '少なくとも',
    reading: 'すくなくとも',
    meaning: 'at least',
    explanation: '少なくとも (sukunakutomo) sets a minimum threshold, meaning not less than a certain amount.',
    distractors: ['at most', 'approximately', 'exactly', 'nearly', 'barely', 'mostly', 'about', 'less than'],
  },
  {
    word: 'むしろ',
    reading: 'むしろ',
    meaning: 'rather / on the contrary',
    explanation: 'むしろ (mushiro) expresses that something is preferable to the alternative or the contrary is true.',
    distractors: ['therefore', 'however', 'indeed', 'additionally', 'suddenly', 'possibly', 'clearly', 'as expected'],
  },
]

// Rarity distribution: 60% common, 25% uncommon, 10% rare, 5% epic
// Over a 20-entry cycle: 12 common, 5 uncommon, 2 rare, 1 epic = 60/25/10/5
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
 * Returns a rarity value based on a rotating pattern that yields
 * approximately 60% common, 25% uncommon, 10% rare, 5% epic.
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

/**
 * Builds the full array of Fact-shaped vocab entries.
 * @returns {Array<Record<string, unknown>>} Generated vocab entries.
 */
function buildEntries() {
  /** @type {Array<{word: string, reading: string, meaning: string, explanation: string, distractors: string[], pos: string}>} */
  const allWords = [
    ...verbs.map(v => ({ ...v, pos: 'Verbs' })),
    ...nouns.map(n => ({ ...n, pos: 'Nouns' })),
    ...adjectives.map(a => ({ ...a, pos: 'Adjectives' })),
    ...adverbs.map(a => ({ ...a, pos: 'Adverbs' })),
  ]

  return allWords.map((item, index) => {
    const num = index + 1
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
}

/**
 * Main entry point — generates vocab and writes to JSON.
 */
function main() {
  const outputPath = join(__dirname, '..', 'src', 'data', 'seed', 'vocab-n3.json')
  const entries = buildEntries()

  writeFileSync(outputPath, JSON.stringify(entries, null, 2) + '\n', 'utf8')

  const verbCount = entries.filter(e => e.category[3] === 'Verbs').length
  const nounCount = entries.filter(e => e.category[3] === 'Nouns').length
  const adjCount = entries.filter(e => e.category[3] === 'Adjectives').length
  const advCount = entries.filter(e => e.category[3] === 'Adverbs').length

  const rarityCounts = {}
  for (const e of entries) {
    rarityCounts[e.rarity] = (rarityCounts[e.rarity] || 0) + 1
  }

  console.log(`Generated ${entries.length} real JLPT N3 entries at ${outputPath}`)
  console.log(`  Verbs: ${verbCount}, Nouns: ${nounCount}, Adjectives: ${adjCount}, Adverbs: ${advCount}`)
  console.log(`  Rarity: ${Object.entries(rarityCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`)
}

main()
