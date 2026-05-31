/**
 * Persistente Wissensbasis: Geräte-Zuordnungen, Konventionen und Steuerungsregeln.
 * Wird vom MCP-Server gelesen/geschrieben, damit die KI gelernte Zuordnungen nutzen kann.
 */
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
export declare class KnowledgeStore {
    private filePath;
    private data;
    private loaded;
    private ensureLoaded;
    private save;
    getMappings(): Promise<DeviceMapping[]>;
    addOrUpdateMapping(mapping: Omit<DeviceMapping, 'id'> & {
        id?: string;
    }): Promise<DeviceMapping>;
    resolve(userPhrase: string): Promise<DeviceMapping | null>;
    getConventions(): Promise<Convention[]>;
    addOrUpdateConvention(convention: Convention): Promise<Convention>;
    getControlRules(): Promise<ControlRule[]>;
    addOrUpdateControlRule(rule: ControlRule): Promise<ControlRule>;
    getControlRuleByVariableId(variableId: number): Promise<ControlRule | null>;
    /** Tauscht auf/zu-Werte (und Varianten) wenn der User sagt „das war falsch rum". */
    correctDirection(variableId: number, note?: string): Promise<ControlRule | null>;
    private slug;
    private normalize;
}
export declare function getKnowledgeStore(): KnowledgeStore;
