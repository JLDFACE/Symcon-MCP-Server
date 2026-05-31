/**
 * Persistente Wissensbasis: Geräte-Zuordnungen, Konventionen und Steuerungsregeln.
 * Wird vom MCP-Server gelesen/geschrieben, damit die KI gelernte Zuordnungen nutzen kann.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
const DEFAULT_FILENAME = 'symcon-knowledge.json';
function getFilePath() {
    const envPath = process.env.SYMCON_KNOWLEDGE_PATH;
    if (envPath)
        return envPath;
    return join(process.cwd(), 'data', DEFAULT_FILENAME);
}
export class KnowledgeStore {
    filePath = getFilePath();
    data = { deviceMappings: [], conventions: [], controlRules: [] };
    loaded = false;
    async ensureLoaded() {
        if (this.loaded)
            return;
        try {
            const raw = await readFile(this.filePath, 'utf8');
            const parsed = JSON.parse(raw);
            this.data = {
                deviceMappings: Array.isArray(parsed.deviceMappings) ? parsed.deviceMappings : [],
                conventions: Array.isArray(parsed.conventions) ? parsed.conventions : [],
                controlRules: Array.isArray(parsed.controlRules) ? parsed.controlRules : [],
            };
        }
        catch {
            this.data = { deviceMappings: [], conventions: [], controlRules: [] };
        }
        this.loaded = true;
    }
    async save() {
        const dir = dirname(this.filePath);
        await mkdir(dir, { recursive: true });
        await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    }
    // ── DeviceMappings ──────────────────────────────────────────────────────────
    async getMappings() {
        await this.ensureLoaded();
        return [...this.data.deviceMappings];
    }
    async addOrUpdateMapping(mapping) {
        await this.ensureLoaded();
        const id = mapping.id ?? this.slug(mapping.userLabel);
        const entry = {
            id,
            userLabel: mapping.userLabel.trim(),
            variableId: mapping.variableId,
            variableName: mapping.variableName.trim(),
            path: mapping.path?.trim(),
            objectId: mapping.objectId,
        };
        const idx = this.data.deviceMappings.findIndex((m) => m.id === id);
        if (idx >= 0)
            this.data.deviceMappings[idx] = entry;
        else
            this.data.deviceMappings.push(entry);
        await this.save();
        return entry;
    }
    async resolve(userPhrase) {
        await this.ensureLoaded();
        const norm = this.normalize(userPhrase);
        if (!norm)
            return null;
        for (const m of this.data.deviceMappings) {
            const mNorm = this.normalize(m.userLabel);
            if (mNorm.includes(norm) || norm.includes(mNorm))
                return m;
        }
        return null;
    }
    // ── Conventions ─────────────────────────────────────────────────────────────
    async getConventions() {
        await this.ensureLoaded();
        return [...this.data.conventions];
    }
    async addOrUpdateConvention(convention) {
        await this.ensureLoaded();
        const entry = {
            key: convention.key.trim(),
            meaning: convention.meaning.trim(),
            description: convention.description?.trim(),
        };
        const idx = this.data.conventions.findIndex((c) => c.key === entry.key);
        if (idx >= 0)
            this.data.conventions[idx] = entry;
        else
            this.data.conventions.push(entry);
        await this.save();
        return entry;
    }
    // ── ControlRules ────────────────────────────────────────────────────────────
    async getControlRules() {
        await this.ensureLoaded();
        return [...this.data.controlRules];
    }
    async addOrUpdateControlRule(rule) {
        await this.ensureLoaded();
        const entry = { ...rule };
        const idx = this.data.controlRules.findIndex((r) => r.variableId === rule.variableId);
        if (idx >= 0)
            this.data.controlRules[idx] = entry;
        else
            this.data.controlRules.push(entry);
        await this.save();
        return entry;
    }
    async getControlRuleByVariableId(variableId) {
        await this.ensureLoaded();
        return this.data.controlRules.find((r) => r.variableId === variableId) ?? null;
    }
    /** Tauscht auf/zu-Werte (und Varianten) wenn der User sagt „das war falsch rum". */
    async correctDirection(variableId, note) {
        await this.ensureLoaded();
        const idx = this.data.controlRules.findIndex((r) => r.variableId === variableId);
        if (idx < 0)
            return null;
        const rule = { ...this.data.controlRules[idx], actions: { ...this.data.controlRules[idx].actions } };
        if (note)
            rule.note = note;
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
    slug(label) {
        return label.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    normalize(s) {
        return s.trim().toLowerCase().replace(/\s+/g, ' ');
    }
}
let defaultStore = null;
export function getKnowledgeStore() {
    if (!defaultStore)
        defaultStore = new KnowledgeStore();
    return defaultStore;
}
