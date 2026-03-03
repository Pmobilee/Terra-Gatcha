/**
 * Knowledge Tree growth stage definitions.
 * The tree object on the Starter Hub displays different sprites
 * based on how many facts the player has mastered (SM-2 reps >= 6).
 * (DD-V2-124, DD-V2-266)
 */
export interface TreeStage {
  /** Stage index 0-7. */
  stage: number
  /** Display name for this stage. */
  label: string
  /** Minimum mastered facts to reach this stage. */
  minMastered: number
  /** Sprite key for the Knowledge Tree object at this stage. */
  spriteKey: string
  /** ComfyUI prompt for sprite generation reference. */
  generationPrompt: string
}

export const TREE_STAGES: TreeStage[] = [
  {
    stage: 0, label: 'Sapling', minMastered: 0,
    spriteKey: 'obj_knowledge_tree_stage0',
    generationPrompt: 'pixel art tiny sapling seedling in small clay pot, two small leaves, bright green, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 1, label: 'Seedling', minMastered: 11,
    spriteKey: 'obj_knowledge_tree_stage1',
    generationPrompt: 'pixel art small seedling tree 20cm tall, 4-6 leaves, glowing faintly, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 2, label: 'Young Tree', minMastered: 51,
    spriteKey: 'obj_knowledge_tree_stage2',
    generationPrompt: 'pixel art young tree 1 meter tall with many small bright leaves, magical glow, trunk visible, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 3, label: 'Growing Tree', minMastered: 151,
    spriteKey: 'obj_knowledge_tree_stage3',
    generationPrompt: 'pixel art medium tree 2 meters tall with dense canopy, golden leaves mixed with green, magical bioluminescent glow, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 4, label: 'Mature Tree', minMastered: 401,
    spriteKey: 'obj_knowledge_tree_stage4',
    generationPrompt: 'pixel art mature tall tree 4 meters, thick trunk, dense magical canopy with glowing runes on bark, golden and emerald leaves, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 5, label: 'Great Tree', minMastered: 1000,
    spriteKey: 'obj_knowledge_tree_stage5',
    generationPrompt: 'pixel art great ancient tree filling frame, massive trunk with glowing carvings, floating leaves of all colors, mystical aura, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 6, label: 'Ancient Tree', minMastered: 2500,
    spriteKey: 'obj_knowledge_tree_stage6',
    generationPrompt: 'pixel art enormous ancient sacred tree, roots spread wide, galaxy of glowing knowledge orbs in canopy, cosmic energy, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 7, label: 'World Tree', minMastered: 5000,
    spriteKey: 'obj_knowledge_tree_stage7',
    generationPrompt: 'pixel art world tree Yggdrasil, infinite canopy reaching top of frame, branches hold entire worlds as glowing spheres, cosmic deep background, isometric game asset, single object centered, white background, 256x256',
  },
]

/**
 * Returns the current tree stage definition for a given mastered fact count.
 */
export function getTreeStage(masteredCount: number): TreeStage {
  let best = TREE_STAGES[0]
  for (const stage of TREE_STAGES) {
    if (masteredCount >= stage.minMastered) best = stage
  }
  return best
}
