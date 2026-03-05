/**
 * Knowledge Tree growth stage definitions.
 * The tree object on the Starter Hub displays different sprites
 * based on how many facts the player has mastered (SM-2 reps >= 6).
 * (DD-V2-124, DD-V2-266)
 */
export interface TreeStage {
  /** Stage index 0-5. */
  index: number
  /** Display name for this stage. */
  label: string
  /** Minimum mastered facts to reach this stage. */
  minMastered: number
  /** Sprite key for the Knowledge Tree object at this stage. */
  spriteKey: string
  /** GAIA comment shown when the tree reaches this stage. */
  gaiaComment: string
}

export const TREE_STAGES: TreeStage[] = [
  { index: 0, label: 'Tiny Sapling',  minMastered: 0,    spriteKey: 'obj_knowledge_tree_stage0', gaiaComment: "A single sapling. Every forest started here." },
  { index: 1, label: 'Small Bush',    minMastered: 11,   spriteKey: 'obj_knowledge_tree_stage1', gaiaComment: "It's filling out. Knowledge takes root." },
  { index: 2, label: 'Young Tree',    minMastered: 51,   spriteKey: 'obj_knowledge_tree_stage2', gaiaComment: "A real tree now. Look at those branches." },
  { index: 3, label: 'Mature Tree',   minMastered: 151,  spriteKey: 'obj_knowledge_tree_stage3', gaiaComment: "Mature. Strong. Not bad for a crash survivor." },
  { index: 4, label: 'Grand Tree',    minMastered: 501,  spriteKey: 'obj_knowledge_tree_stage4', gaiaComment: "Grand. The golden leaves are a nice touch." },
  { index: 5, label: 'Ancient Tree',  minMastered: 1001, spriteKey: 'obj_knowledge_tree_stage5', gaiaComment: "Ancient. This tree has outlasted civilizations. So have you." },
  { index: 6, label: 'Omniscient Tree', minMastered: 3000, spriteKey: 'obj_knowledge_tree_stage6', gaiaComment: "You have learned everything I have to teach. The tree glows gold. So do I." },
]

/**
 * Returns the current tree stage definition for a given mastered fact count.
 */
export function getTreeStage(masteredCount: number): TreeStage {
  let best = TREE_STAGES[0]
  for (let i = TREE_STAGES.length - 1; i >= 0; i--) {
    if (masteredCount >= TREE_STAGES[i].minMastered) {
      best = TREE_STAGES[i]
      break
    }
  }
  return best
}
