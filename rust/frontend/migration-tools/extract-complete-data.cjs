#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Comprehensive data extraction tool for AI Code Terminal migration
 * Extracts all reactive properties, methods, and computed properties from scripts.ejs
 */

const SCRIPTS_FILE = path.join(__dirname, '../../../app/views/partials/scripts.ejs');
const OUTPUT_FILE = path.join(__dirname, 'complete-extraction-results.json');

function extractCompleteDataStructure() {
    console.log('🔍 Starting comprehensive data extraction from scripts.ejs...');
    
    if (!fs.existsSync(SCRIPTS_FILE)) {
        console.error('❌ Scripts file not found:', SCRIPTS_FILE);
        process.exit(1);
    }

    const content = fs.readFileSync(SCRIPTS_FILE, 'utf8');
    
    // Extract the Vue data() function content
    const dataMatch = content.match(/data\(\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\};[\s\S]*?\}/);
    if (!dataMatch) {
        console.error('❌ Could not find Vue data() function');
        process.exit(1);
    }

    const dataContent = dataMatch[1];
    
    // Extract all properties with their default values and comments
    const properties = [];
    const lines = dataContent.split('\n');
    let currentProperty = null;
    let currentComment = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Capture comments
        if (line.startsWith('//')) {
            currentComment = line.replace('//', '').trim();
            continue;
        }
        
        // Skip empty lines
        if (!line) {
            currentComment = '';
            continue;
        }
        
        // Property definition (handle various patterns)
        const propertyMatch = line.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(.+?),?\s*(?:\/\/.*)?$/);
        if (propertyMatch) {
            const [, name, value] = propertyMatch;
            
            // Determine property type and category
            let type = 'unknown';
            let category = 'misc';
            let defaultValue = value.replace(/,\s*$/, '');
            
            // Type inference
            if (defaultValue === 'null') type = 'object';
            else if (defaultValue === 'false' || defaultValue === 'true') type = 'boolean';
            else if (defaultValue.match(/^\d+$/)) type = 'number';
            else if (defaultValue.startsWith('"') || defaultValue.startsWith("'")) type = 'string';
            else if (defaultValue.startsWith('[')) type = 'array';
            else if (defaultValue.startsWith('{')) type = 'object';
            else if (defaultValue.includes('Map')) type = 'Map';
            else if (defaultValue.includes('Set')) type = 'Set';
            
            // Category inference based on name patterns
            if (name.includes('terminal') || name.includes('Tab') || name.includes('Pane') || name.includes('Layout')) {
                category = 'terminal';
            } else if (name.includes('repository') || name.includes('workspace') || name.includes('Repository') || name.includes('Workspace')) {
                category = 'repository';
            } else if (name.includes('file') || name.includes('File') || name.includes('directory') || name.includes('path') || name.includes('Path')) {
                category = 'file';
            } else if (name.includes('edit') || name.includes('Edit') || name.includes('editor') || name.includes('Editor') || name.includes('preview')) {
                category = 'editor';
            } else if (name.includes('theme') || name.includes('Theme') || name.includes('modal') || name.includes('Modal') || name.includes('show')) {
                category = 'ui';
            } else if (name.includes('mobile') || name.includes('Mobile') || name.includes('touch') || name.includes('Touch') || name.includes('swipe')) {
                category = 'mobile';
            } else if (name.includes('auth') || name.includes('Auth') || name.includes('user') || name.includes('User') || name.includes('token')) {
                category = 'auth';
            }
            
            properties.push({
                name,
                type,
                category,
                defaultValue,
                comment: currentComment,
                line: i + 1
            });
            
            currentComment = '';
        }
    }
    
    // Extract methods
    const methods = [];
    const methodMatches = content.matchAll(/(\w+)\s*\([^)]*\)\s*\{/g);
    
    for (const match of methodMatches) {
        const methodName = match[1];
        
        // Skip Vue lifecycle and computed
        if (['data', 'mounted', 'computed', 'methods', 'watch'].includes(methodName)) continue;
        
        // Determine if async
        const methodStart = match.index;
        const beforeMethod = content.substring(Math.max(0, methodStart - 50), methodStart);
        const isAsync = beforeMethod.includes('async');
        
        methods.push({
            name: methodName,
            isAsync,
            category: categorizeMethod(methodName)
        });
    }
    
    // Extract computed properties
    const computedMatch = content.match(/computed:\s*\{([\s\S]*?)\}/);
    const computedProperties = [];
    
    if (computedMatch) {
        const computedContent = computedMatch[1];
        const computedMatches = computedContent.matchAll(/(\w+)\s*\(\)/g);
        
        for (const match of computedMatches) {
            computedProperties.push({
                name: match[1],
                category: categorizeMethod(match[1])
            });
        }
    }

    // Group properties by category for store organization
    const propertyCategories = {};
    properties.forEach(prop => {
        if (!propertyCategories[prop.category]) {
            propertyCategories[prop.category] = [];
        }
        propertyCategories[prop.category].push(prop);
    });

    const results = {
        extracted_at: new Date().toISOString(),
        summary: {
            total_properties: properties.length,
            total_methods: methods.length,
            total_computed: computedProperties.length,
            async_methods: methods.filter(m => m.isAsync).length,
            categories: Object.keys(propertyCategories)
        },
        properties: {
            all: properties,
            by_category: propertyCategories
        },
        methods: {
            all: methods,
            async: methods.filter(m => m.isAsync),
            sync: methods.filter(m => !m.isAsync)
        },
        computed: computedProperties,
        store_mapping: generateStoreMapping(propertyCategories, methods)
    };

    // Write results
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    
    console.log('✅ Extraction complete!');
    console.log(`📊 Found ${properties.length} reactive properties`);
    console.log(`🔧 Found ${methods.length} methods (${methods.filter(m => m.isAsync).length} async)`);
    console.log(`⚙️  Found ${computedProperties.length} computed properties`);
    console.log(`📂 Organized into ${Object.keys(propertyCategories).length} categories`);
    console.log(`💾 Results saved to: ${OUTPUT_FILE}`);

    return results;
}

function categorizeMethod(name) {
    const methodName = name.toLowerCase();
    
    if (methodName.includes('terminal') || methodName.includes('layout') || methodName.includes('pane') || methodName.includes('tab')) {
        return 'terminal';
    } else if (methodName.includes('repository') || methodName.includes('workspace') || methodName.includes('clone')) {
        return 'repository';
    } else if (methodName.includes('file') || methodName.includes('directory') || methodName.includes('refresh')) {
        return 'file';
    } else if (methodName.includes('edit') || methodName.includes('editor') || methodName.includes('preview') || methodName.includes('save')) {
        return 'editor';
    } else if (methodName.includes('theme') || methodName.includes('modal') || methodName.includes('ui') || methodName.includes('mobile')) {
        return 'ui';
    } else if (methodName.includes('auth') || methodName.includes('login') || methodName.includes('initialize')) {
        return 'auth';
    }
    
    return 'misc';
}

function generateStoreMapping(propertyCategories, methods) {
    const stores = {
        'useTerminalStore': {
            description: 'Terminal management, layouts, panes, tabs',
            properties: propertyCategories.terminal || [],
            methods: methods.filter(m => m.category === 'terminal')
        },
        'useRepositoryStore': {
            description: 'Repository cloning, workspace management',
            properties: propertyCategories.repository || [],
            methods: methods.filter(m => m.category === 'repository')
        },
        'useFileStore': {
            description: 'File system, caching, context menus',
            properties: propertyCategories.file || [],
            methods: methods.filter(m => m.category === 'file')
        },
        'useEditorStore': {
            description: 'File editing, preview, unsaved changes',
            properties: propertyCategories.editor || [],
            methods: methods.filter(m => m.category === 'editor')
        },
        'useUIStore': {
            description: 'Theme management, modals, UI state',
            properties: propertyCategories.ui || [],
            methods: methods.filter(m => m.category === 'ui')
        },
        'useAuthStore': {
            description: 'Authentication, user management',
            properties: propertyCategories.auth || [],
            methods: methods.filter(m => m.category === 'auth')
        }
    };

    // Add misc properties to UI store
    if (propertyCategories.misc) {
        stores.useUIStore.properties.push(...propertyCategories.misc);
    }
    
    // Add mobile properties to UI store
    if (propertyCategories.mobile) {
        stores.useUIStore.properties.push(...propertyCategories.mobile);
    }

    return stores;
}

if (require.main === module) {
    extractCompleteDataStructure();
}

module.exports = { extractCompleteDataStructure };