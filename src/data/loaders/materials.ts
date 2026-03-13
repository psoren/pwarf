import { z } from 'zod'
import yaml from 'js-yaml'
import materialsRaw from '../materials.yaml?raw'

const MaterialSchema = z.object({
  id:       z.string(),
  name:     z.string(),
  category: z.enum(['stone', 'metal', 'soil', 'organic']),
  color:    z.string().regex(/^#[0-9a-f]{6}$/i),
  hardness: z.number().min(0).max(10),
})

export type Material = z.infer<typeof MaterialSchema>

export function loadMaterials(): Material[] {
  const raw = yaml.load(materialsRaw)
  return z.array(MaterialSchema).parse(raw)
}
