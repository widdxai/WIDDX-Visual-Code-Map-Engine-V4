import { WiddxFileEntry, WiddxProtocolType } from '../types';
import { WiddxProtocol } from './protocols/types';
import { ChromeProtocol } from './protocols/chrome';
import { LaravelProtocol } from './protocols/laravel';
import { ReactProtocol } from './protocols/react';
import { UniversalProtocol } from './protocols/universal';

// Export types for other consumers
export type { WiddxProtocol, WiddxProtocolType };

export interface ProtocolMeta {
    id: WiddxProtocolType;
    name: string;
    description: string;
    icon: string;
}

export class ProtocolEngine {
    
    // Static registry of loaded protocols
    private static registry: Record<WiddxProtocolType, WiddxProtocol> = {
        'CHROME_EXT_V3': ChromeProtocol,
        'LARAVEL_MVC': LaravelProtocol,
        'REACT_MODERN': ReactProtocol,
        'UNIVERSAL': UniversalProtocol
    };

    public static readonly AVAILABLE_PROTOCOLS: ProtocolMeta[] = Object.values(ProtocolEngine.registry).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        icon: p.icon
    }));

    /**
     * Detects all applicable protocols based on file signatures and content scoring.
     */
    public static detectProtocols(files: WiddxFileEntry[]): WiddxProtocolType[] {
        const scores: Record<WiddxProtocolType, number> = {
            'CHROME_EXT_V3': 0,
            'LARAVEL_MVC': 0,
            'REACT_MODERN': 0,
            'UNIVERSAL': 1 // Base score
        };

        // 1. Chrome Extension Scoring
        if (files.some(f => f.path.endsWith('manifest.json'))) {
             const manifest = files.find(f => f.path.endsWith('manifest.json'));
             if (manifest && manifest.content.includes('"manifest_version": 3')) {
                 scores['CHROME_EXT_V3'] += 10;
             }
        }

        // 2. Laravel Scoring
        if (files.some(f => f.path.endsWith('artisan'))) scores['LARAVEL_MVC'] += 10;
        if (files.some(f => f.path.endsWith('composer.json'))) {
            const composer = files.find(f => f.path.endsWith('composer.json'));
            if (composer?.content.includes('laravel/framework')) scores['LARAVEL_MVC'] += 5;
        }

        // 3. React Scoring
        if (files.some(f => f.path.endsWith('package.json'))) {
            const pkg = files.find(f => f.path.endsWith('package.json'));
            if (pkg?.content.includes('"react"')) scores['REACT_MODERN'] += 10;
            if (pkg?.content.includes('"next"')) scores['REACT_MODERN'] += 5;
        }
        if (files.some(f => f.path.endsWith('.tsx') || f.path.endsWith('.jsx'))) {
            scores['REACT_MODERN'] += 2;
        }

        // Filter and Sort
        const detected = Object.entries(scores)
            .filter(([_, score]) => score > 0)
            .sort((a, b) => b[1] - a[1]) // Higher score first
            .map(([id, _]) => id as WiddxProtocolType);

        return detected.length > 0 ? detected : ['UNIVERSAL'];
    }

    public static getProtocol(id: WiddxProtocolType): WiddxProtocol {
        return this.registry[id] || this.registry['UNIVERSAL'];
    }

    /**
     * Loads multiple protocols and merges them into a single directives block.
     */
    public static async loadCompositeProtocol(ids: string[]): Promise<{
        id: string;
        name: string;
        aiDirectives: string;
        icon: string;
    }> {
        // Dedup and validate
        const validIds = Array.from(new Set(ids)) as WiddxProtocolType[];
        if (validIds.length === 0) validIds.push('UNIVERSAL');

        const loadedProtocols: WiddxProtocol[] = validIds.map(id => this.getProtocol(id));

        // Merge Directives
        const combinedDirectives = loadedProtocols.map(p => p.aiDirectives).join('\n\n========================================\n\n');
        
        return {
            id: validIds.join('+'),
            name: loadedProtocols.map(p => p.name).join(' + '),
            icon: loadedProtocols[0].icon, // Use icon of primary protocol
            aiDirectives: `
            === COMPOSITE PROTOCOL SYSTEM ACTIVE ===
            The following architectural protocols are active simultaneously. 
            You must synthesize constraints from all active protocols.
            
            ${combinedDirectives}
            `
        };
    }
}