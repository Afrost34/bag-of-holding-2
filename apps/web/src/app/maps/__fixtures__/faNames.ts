import { classify } from '../packCategories';

/**
 * Real Forgotten Adventures paths (Core 1.04 and Expansion 1.14, the zip's top folder cut), for
 * tests that check recipes, styles and kits find pictures on the actual packs. Add names here when
 * a new rule asks for a kind of picture; never invent names.
 */
export const FA_NAMES: readonly string[] = [
  // Nature
  'Woodlands/!Wilderness/Flora/Trees/Tree_Green_A1_6x6.webp',
  'Woodlands/!Wilderness/Flora/Trees/Tree_Multicolor1_C2_5x5.webp',
  'Woodlands/!Wilderness/Flora/Trees/Tree_Red_D5_5x5.webp',
  'Woodlands/!Wilderness/Flora/Trees/Tree_Shadows/Tree_Shadow_D6_3x3.webp',
  'Woodlands/!Wilderness/Flora/Bushes/Bush_Green_A1_1x1.webp',
  'Woodlands/!Wilderness/Flora/Bushes/Bush_Green_F6_2x2.webp',
  'Woodlands/!Wilderness/Flora/Bushes/Bush_Multicolor1_F5_2x2.webp',
  'Woodlands/!Wilderness/Flora/Plants/Ferns/Fern_Green_A1_2x2.webp',
  'Woodlands/!Wilderness/Flora/Plants/Long_Grass/Long_Grass_Green_A10_1x1.webp',
  'Woodlands/!Wilderness/Flora/Plants/Long_Grass/Long_Grass_Multicolor1_A7_1x1.webp',
  'Woodlands/!Wilderness/Flora/Plants/Long_Grass/Long_Grass_Yellow_A4_1x1.webp',
  'Woodlands/!Wilderness/Flora/Flowers/Flowers_Daffodil_Orange_A1_1x1.webp',
  'Woodlands/!Wilderness/Flora/Flowers/Flowers_Lily_White_A2_1x1.webp',
  'Woodlands/!Wilderness/Flora/Flowers/Flowers_Rose_Black_A6_1x1.webp',
  'Woodlands/!Wilderness/Flora/Mushrooms/Mushroom_Brown2_J1_1x1.webp',
  'Woodlands/!Wilderness/Flora/Mushrooms/Mushroom_Brown_B4_1x1.webp',
  'Woodlands/!Wilderness/Flora/Mushrooms/Mushroom_Brown_I2_1x1.webp',
  'Woodlands/!Wilderness/Flora/Leaves/Leaf_Piles/Fallen_Leaves_Piles_Brown1_A1_1x1.webp',
  'Woodlands/!Wilderness/Flora/Leaves/Leaf_Piles/Fallen_Leaves_Piles_Mixed1_B2_2x2.webp',
  'Woodlands/!Wilderness/Flora/Leaves/Leaf_Piles/Fallen_Leaves_Piles_Yellow_A3_3x3.webp',
  'Woodlands/!Wilderness/Decor/Rocks/Boulders/Boulder_Stone_Mossy_C10_2x3.webp',
  'Woodlands/!Wilderness/Decor/Rocks/Boulders/Boulder_Stone_Mossy_D15_3x3.webp',
  'Woodlands/!Wilderness/Decor/Rocks/Stones/Stone_Mossy_B1_1x1.webp',
  // Interiors
  '!Core_Settlements/Furniture/Seating/Stools/Stool_Fabric_Blue_Wood_Dark_B1_1x1.webp',
  '!Core_Settlements/Furniture/Seating/Stools/Stool_Fabric_Red_Wood_Ashen_A1_1x1.webp',
  '!Core_Settlements/Furniture/Seating/Chairs/Scissor_Chair_Wood_Ashen_A1_1x1.webp',
  '!Core_Settlements/Decor/Storage/Barrels/Barrel_Metal_Gray_A2_1x1.webp',
  '!Core_Settlements/Decor/Storage/Barrels/Barrel_Side_Wood_Dark_G_1x1.webp',
  '!Core_Settlements/Decor/Storage/Boxes_and_Crates/Crates/Crate_Lid_Wood_Ashen_A_2x1.webp',
  '!Core_Settlements/Decor/Storage/Boxes_and_Crates/Crates/Crate_Wood_Light_C_2x1.webp',
  '!Core_Settlements/Furniture/Bedding/Beds/Single_Beds/Single_Bed_Ashen_A_1x2.webp',
  '!Core_Settlements/Furniture/Cupboards_and_Wardrobes/Wardrobes/Wardrobe_Wood_Ashen_A1_2x1.webp',
  '!Core_Settlements/Furniture/Shelves/Bookshelves/Bookcase_Wood_Ashen_A1_4x1.webp',
  '!Core_Settlements/Furniture/Shelves/Bookshelves/Bookcase_Wood_Light_D_2x1.webp',
  '!Core_Settlements/Furniture/Shelves/Bookshelves/Bookcase_Wood_Walnut_I_3x1.webp',
  // Clutter and ruin
  '!Core_Settlements/Clutter/Paper_Goods/Scrolls/Fancy_Scroll_A_01_1x1.webp',
  '!Core_Settlements/Clutter/Paper_Goods/Scrolls/Scroll_Paper_A1_1x1.webp',
  '!Core_Settlements/Clutter/Paper_Goods/Scrolls/Scroll_Cases/Scroll_Case_Leather_Gray_Metal_Gray_A1_1x1.webp',
  '!Core_Settlements/Structures/Rubble/Rubble_Piles/Stone/Rubble_Pile_Stone_Earthy_A10_2x2.webp',
  '!Core_Settlements/Structures/Rubble/Rubble_Piles/Stone/Rubble_Pile_Stone_Earthy_A44_2x2.webp',
  '!Core_Settlements/Structures/Rubble/Rubble_Piles/Stone/Rubble_Pile_Stone_Earthy_B5_1x1.webp',
];

/** The names as pack entries of one pack (`fa`), sorted as the importer sorts them. */
export const FA_ENTRIES = FA_NAMES.map((path) => ({ pack: 'fa', path, cat: classify(path) }));
