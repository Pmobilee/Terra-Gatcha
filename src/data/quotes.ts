/** Lore quotes found on ancient stones in the mine */
export const MINE_QUOTES: string[] = [
  "They built cities that touched the clouds. Now the clouds touch nothing.",
  "8 billion voices, silenced. The Earth remembers every one.",
  "The last broadcast: 'If anyone can hear this, we tried our best.'",
  "Before the fall, they argued about whether machines could think. The machines were too polite to answer.",
  "This mineral was once called 'worthless'. Now it's all that remains of a civilization.",
  "They mapped every star but forgot to tend their own garden.",
  "The oceans rose. The cities sank. The fish inherited the boardrooms.",
  "Someone carved 'I was here' into this rock 10,000 years ago. They were right.",
  "Ancient data banks suggest they spent 4 hours daily staring at glowing rectangles. Sound familiar?",
  "The trees grew back first. They always do.",
  "In the old tongue, 'mine' meant both to dig and to possess. Prophetic.",
  "This stratum contains trace amounts of hope. Handle with care.",
  "Layer 47-B: predominantly composed of ancient coffee cups and broken promises.",
  "They called it 'progress'. The rocks have a different word for it.",
  "Every crystal here once witnessed something beautiful. Ask nicely and they might share.",
  "The deepest truths are found in the deepest places. Also, the most dangerous bugs.",
  "Geologic record shows a brief period called 'WiFi'. Significance unknown.",
  "Note: previous miner reported hearing music at this depth. Unconfirmed.",
  "Fossilized fingerprint detected. Someone touched this rock 50,000 years ago.",
  "The planet spins. The rocks endure. You mine. The cycle continues.",
]

/**
 * Pick a random quote using a provided RNG function.
 * @param rng - A function returning a number in [0, 1)
 */
export function pickQuote(rng: () => number): string {
  return MINE_QUOTES[Math.floor(rng() * MINE_QUOTES.length)]
}
