/**
 * Persistente Wissensbasis: Geräte-Zuordnungen, Konventionen und Steuerungsregeln.
 * Wird vom MCP-Server gelesen/geschrieben, damit die KI gelernte Zuordnungen nutzen kann.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
export interface DeviceMapping {
  id: string;
  userLabel: string;
  variableId: number;
  variableName: string;
  path?: string;
  objectId?: number;
}

export interface Convention {
  key: string;
  meaning: string;
  description?: string;
}

export interface ControlRule {
  variableId: number;
  variableName?: string;
  deviceType?: string;
  actions: Record<string, number | boolean>;
  source?: string;
  note?: string;
}

export interface KnowledgeData {
  deviceMappings: DeviceMapping[];
  conventions: Convention[];
  controlRules: ControlRule[];
}

const DEFAULT_FILENAME = 'symcon-knowledge.json';

function getFilePath(): string {
  const envPath = process.env.SYMCON_KNOWLEDGE_PATH;
  if (envPath) return envPath;
  return join(process.cwd(), 'data', DEFAULT_FILENAME);
}

export class KnowledgeStore {
  private filePath: string = getFilePath();
  private data: KnowledgeData = { deviceMappings: [], conventions: [], controlRules: [] };
  private loaded = false;

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<KnowledgeData>;
      this.data = {
        deviceMappings: Array.isArray(parsed.deviceMappings) ? parsed.deviceMappings : [],
        conventions: Array.isArray(parsed.conventions) ? parsed.conventions : [],
        controlRules: Array.isArray(parsed.controlRules) ? parsed.controlRules : [],
      };
    } catch {
      this.data = { deviceMappings: [], conventions: [], controlRules: [] };
    }
    this.loaded = true;
  }

  private async save(): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  // ── DeviceMappings ──────────────────────────────────────────────────────────

  async getMappings(): Promise<DeviceMapping[]> {
    await this.ensureLoaded();
    return [...this.data.deviceMappings];
  }

  async addOrUpdateMapping(mapping: Omit<DeviceMapping, 'id'> & { id?: string }): Promise<DeviceMapping> {
    await this.ensureLoaded();
    const id = mapping.id ?? this.slug(mapping.userLabel);
    const entry: DeviceMapping = {
      id,
      userLabel: mapping.userLabel.trim(),
      variableId: mapping.variableId,
      variableName: mapping.variableName.trim(),
      path: mapping.path?.trim(),
      objectId: mapping.objectId,
    };
    const idx = this.data.deviceMappings.findIndex((m) => m.id === id);
    if (idx >= 0) this.data.deviceMappings[idx] = entry;
    else this.data.deviceMappings.push(entry);
    await this.save();
    return entry;
  }

  async resolve(userPhrase: string): Promise<DeviceMapping | null> {
    await this.ensureLoaded();
    const norm = this.normalize(userPhrase);
    if (!norm) return null;
    for (const m of this.data.deviceMappings) {
      const mNorm = this.normalize(m.userLabel);
      if (mNorm.includes(norm) || norm.includes(mNorm)) return m;
    }
    return null;
  }

  // ── Conventions ─────────────────────────────────────────────────────────────

  async getConventions(): Promise<Convention[]> {
    await this.ensureLoaded();
    return [...this.data.conventions];
  }

  async addOrUpdateConvention(convention: Convention): Promise<Convention> {
    await this.ensureLoaded();
    const entry: Convention = {
      key: convention.key.trim(),
      meaning: convention.meaning.trim(),
      description: convention.description?.trim(),
    };
    const idx = this.data.conventions.findIndex((c) => c.key === entry.key);
    if (idx >= 0) this.data.conventions[idx] = entry;
    else this.data.conventions.push(entry);
    await this.save();
    return entry;
  }

  // ── ControlRules ────────────────────────────────────────────────────────────

  async getControlRules(): Promise<ControlRule[]> {
    await this.ensureLoaded();
    return [...this.data.controlRules];
  }

  async addOrUpdateControlRule(rule: ControlRule): Promise<ControlRule> {
    await this.ensureLoaded();
    const entry: ControlRule = { ...rule };
    const idx = this.data.controlRules.findIndex((r) => r.variableId === rule.variableId);
    if (idx >= 0) this.data.controlRules[idx] = entry;
    else this.data.controlRules.push(entry);
    await this.save();
    return entry;
  }

  async getControlRuleByVariableId(variableId: number): Promise<ControlRule | null> {
    await this.ensureLoaded();
    return this.data.controlRules.find((r) => r.variableId === variableId) ?? null;
  }

  /** Tauscht auf/zu-Werte (und Varianten) wenn der User sagt „das war falsch rum". */
  async correctDirection(variableId: number, note?: string): Promise<ControlRule | null> {
    await this.ensureLoaded();
    const idx = this.data.controlRules.findIndex((r) => r.variableId === variableId);
    if (idx < 0) return null;
    const rule = { ...this.data.controlRules[idx], actions: { ...this.data.controlRules[idx].actions } };
    if (note) rule.note = note;

    const pairs = [
      ['auf', 'zu'],
      ['aufmachen', 'zumachen'],
      ['open', 'close'],
      ['ein', 'aus'],
      ['on', 'off'],
      ['hoch', 'runter'],
    ];
    for (const [a, b] of pairs) {
      if (a in rule.actions && b in rule.actions) {
        [rule.actions[a], rule.actions[b]] = [rule.actions[b], rule.actions[a]];
      }
    }

    this.data.controlRules[idx] = rule;
    await this.save();
    return rule;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private slug(label: string): string {
    return label.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  private normalize(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
  }
}

let defaultStore: KnowledgeStore | null = null;

export function getKnowledgeStore(): KnowledgeStore {
  if (!defaultStore) defaultStore = new KnowledgeStore();
  return defaultStore;
}
