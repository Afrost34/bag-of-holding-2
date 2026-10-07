export { makeKey, parseKey, isEntityKey, type EntityKey, type ParsedKey } from './keys';
export { identify, type RawEntity, type Identity } from './identity';
export { EDITION_2024_START, type Edition } from './editions';
export { isDataFile, contentFile } from './files';
export {
  extractFile,
  type EntityRecord,
  type AuxRecord,
  type ExtractIssue,
  type ExtractResult,
  type ExtractContext,
} from './extract';
export { CopyResolver, CopyError } from './copy';
export { parseSourceRegistry, type RegistryEntry } from './sourceRegistry';
export { buildSourceCatalog, isPlaytestSource, type SourceInfo, type SourceKind } from './sources';
export {
  DEFAULT_REPO,
  GitHubDataSource,
  LocalDataSource,
  latestReleaseTag,
  normaliseLocalPath,
  versionFromPackageJson,
  type DataSource,
  type RemoteFile,
  type Fetch,
} from './dataSource';
export { gitBlobSha } from './gitsha';
export {
  installData,
  planInstall,
  META,
  type InstallOptions,
  type InstallPhase,
  type InstallPlan,
  type InstallProgress,
  type InstallResult,
} from './installer';
export {
  homebrewSources,
  indexHomebrew,
  syncHomebrew,
  HomebrewError,
  type HomebrewPack,
  type HomebrewResult,
} from './homebrew';
export { checkReferences, type BrokenReference, type ReferenceReport } from './references';
export {
  EntityIndex,
  toFtsQuery,
  type EntityDetail,
  type EntitySummary,
  type Layer,
  type SearchOptions,
  type SourceSummary,
} from './db/entityIndex';
export type { SqlDatabase, SqlValue, SqlParams } from './db/types';
export {
  BROWSE_CATEGORIES,
  CATEGORIES,
  SUPPORT_TYPES,
  categoryById,
  categoryForType,
  type Category,
  type FieldDef,
  type FieldKind,
} from './lists/categories';
export { buildRow, type ListRow, type FieldValue } from './lists/rows';
export { stripTagsPlain } from './lists/strip';
export { blurbOf, buildCard, type CardInfo } from './lists/cards';
export {
  areaIndex,
  bookSummary,
  headerKey,
  headerKeys,
  namedEntries,
  tocFromContents,
  type BookContent,
  type BookKind,
  type BookSummary,
  type TocChapter,
  type TocHeader,
} from './books';
export {
  buildClassPage,
  buildSpeciesPage,
  buildSubclassPage,
  classFeatureRef,
  subclassFeatureRef,
  type ClassPage,
  type FeatureEntry,
  type PageLookup,
  type SpeciesPage,
  type SubclassPage,
  type SubclassSummary,
} from './classes';
export {
  BREW_TYPES,
  fluffImage,
  putFluffImage,
  newPack,
  packEntries,
  packMeta,
  putEntry,
  removeEntry,
  sourceIdFor,
  type BrewType,
  type PackMeta,
} from './brew/pack';
export {
  DAMAGE_TYPES,
  emptyItem,
  formToItem,
  isArmor,
  isWeapon,
  ITEM_KINDS,
  itemToForm,
  RARITIES,
  WEAPON_PROPERTIES,
  type ItemForm,
  type ItemKind,
} from './brew/items';
export { entriesToText, tagDice, textToEntries, untag } from './brew/text';
export {
  ALIGNMENT_CODES,
  attackText,
  averageOf,
  CHALLENGE_RATINGS,
  CONDITION_NAMES,
  creatureToForm,
  CREATURE_TYPES,
  DAMAGE_NAMES,
  emptyCreature,
  formToCreature,
  passivePerception,
  proficiency,
  SENSES,
  SIZES,
  SKILLS,
  SPEEDS,
  type AttackSpec,
  type CreatureForm,
  type Feature,
} from './brew/creatures';
export { tagStatText, untagStatText } from './brew/statText';
export {
  AREA_SHAPES,
  CASTING_UNITS,
  DURATION_KINDS,
  emptySpell,
  formToSpell,
  RANGE_KINDS,
  SPELL_CLASSES,
  SPELL_SCHOOLS,
  spellTags,
  spellToForm,
  type SpellForm,
} from './brew/spells';
