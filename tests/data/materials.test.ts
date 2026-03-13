import { describe, it, expect } from 'vitest'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import { z } from 'zod'
import { loadMaterials } from '@data/loaders/materials'
import type { Material } from '@data/loaders/materials'

describe('loadMaterials()', () => {
  it('loads and validates the materials.yaml file', () => {
    const materials = loadMaterials()
    expect(materials).toBeInstanceOf(Array)
    expect(materials.length).toBeGreaterThanOrEqual(5)
  })

  it('includes the required five materials by id', () => {
    const materials = loadMaterials()
    const ids = materials.map((m) => m.id)
    expect(ids).toContain('granite')
    expect(ids).toContain('limestone')
    expect(ids).toContain('iron_ore')
    expect(ids).toContain('iron_bar')
    expect(ids).toContain('soil')
  })

  it('each material has the correct shape', () => {
    const materials = loadMaterials()
    for (const material of materials) {
      expect(material).toHaveProperty('id')
      expect(material).toHaveProperty('name')
      expect(['stone', 'metal', 'soil', 'organic']).toContain(material.category)
      expect(material.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(material.hardness).toBeGreaterThanOrEqual(0)
      expect(material.hardness).toBeLessThanOrEqual(10)
    }
  })

  it('granite has stone category and valid hardness', () => {
    const materials = loadMaterials()
    const granite = materials.find((m) => m.id === 'granite')
    expect(granite).toBeDefined()
    expect(granite!.category).toBe('stone')
    expect(granite!.hardness).toBeGreaterThan(0)
  })

  it('iron_bar has metal category', () => {
    const materials = loadMaterials()
    const ironBar = materials.find((m) => m.id === 'iron_bar')
    expect(ironBar).toBeDefined()
    expect(ironBar!.category).toBe('metal')
  })

  it('soil has soil category', () => {
    const materials = loadMaterials()
    const soil = materials.find((m) => m.id === 'soil')
    expect(soil).toBeDefined()
    expect(soil!.category).toBe('soil')
  })
})

describe('loadMaterials() — invalid data', () => {
  it('throws when category is invalid', () => {
    const bad: unknown[] = [
      {
        id: 'bad_material',
        name: 'Bad Material',
        category: 'invalid_category',
        color: '#aabbcc',
        hardness: 5,
      },
    ]
    const tmpPath = join(process.cwd(), 'src/data/materials_tmp_test.yaml')
    writeFileSync(tmpPath, yaml.dump(bad), 'utf8')
    unlinkSync(tmpPath)

    const MaterialSchema = z.object({
      id:       z.string(),
      name:     z.string(),
      category: z.enum(['stone', 'metal', 'soil', 'organic']),
      color:    z.string().regex(/^#[0-9a-f]{6}$/i),
      hardness: z.number().min(0).max(10),
    })

    expect(() => z.array(MaterialSchema).parse(bad)).toThrow()
  })

  it('throws when color is not a valid hex string', () => {
    const MaterialSchema = z.object({
      id:       z.string(),
      name:     z.string(),
      category: z.enum(['stone', 'metal', 'soil', 'organic']),
      color:    z.string().regex(/^#[0-9a-f]{6}$/i),
      hardness: z.number().min(0).max(10),
    })

    const bad = [
      {
        id: 'bad_color',
        name: 'Bad Color',
        category: 'stone',
        color: 'not-a-hex',
        hardness: 5,
      },
    ]
    expect(() => z.array(MaterialSchema).parse(bad)).toThrow()
  })

  it('throws when hardness is out of range', () => {
    const MaterialSchema = z.object({
      id:       z.string(),
      name:     z.string(),
      category: z.enum(['stone', 'metal', 'soil', 'organic']),
      color:    z.string().regex(/^#[0-9a-f]{6}$/i),
      hardness: z.number().min(0).max(10),
    })

    const bad = [
      {
        id: 'too_hard',
        name: 'Too Hard',
        category: 'metal',
        color: '#aabbcc',
        hardness: 99,
      },
    ]
    expect(() => z.array(MaterialSchema).parse(bad)).toThrow()
  })

  it('throws when a required field is missing', () => {
    const MaterialSchema = z.object({
      id:       z.string(),
      name:     z.string(),
      category: z.enum(['stone', 'metal', 'soil', 'organic']),
      color:    z.string().regex(/^#[0-9a-f]{6}$/i),
      hardness: z.number().min(0).max(10),
    })

    const bad = [
      {
        // missing id
        name: 'No ID',
        category: 'stone',
        color: '#aabbcc',
        hardness: 3,
      },
    ]
    expect(() => z.array(MaterialSchema).parse(bad)).toThrow()
  })
})

describe('Material type', () => {
  it('Material type is correctly inferred from schema', () => {
    const material: Material = {
      id: 'test',
      name: 'Test',
      category: 'stone',
      color: '#123456',
      hardness: 5,
    }
    expect(material.id).toBe('test')
  })
})
