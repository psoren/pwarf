// Re-export all world-gen helpers from the shared package
export {
  createAleaRng,
  fbm,
  deriveTerrain,
  deriveBiomeTags,
  deriveSpecialOverlay,
  elevationToMeters,
  SPECIAL_TERRAINS,
  type SpecialTerrain,
} from "@pwarf/shared";
