import { WiddxFileEntry, WiddxProtocolType } from '../../types';

export interface WiddxProtocol {
    id: WiddxProtocolType;
    name: string;
    description: string;
    icon: string; // Icon name for UI
    aiDirectives: string; // The system prompt injection
    validationRules?: {
        forbiddenImports?: string[]; 
        forbiddenPatterns?: { pattern: RegExp | string; message: string }[];
        requiredFiles?: string[];
        namingConventions?: { pattern: RegExp; description: string }[];
    }
}