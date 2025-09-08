#!/usr/bin/env node

/**
 * JavaScript function extraction tool for scripts.ejs migration
 * Uses AST parsing to systematically extract Vue.js methods and data structures
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the scripts.ejs file
const scriptsPath = '../../../app/views/partials/scripts.ejs';
const stylesPath = '../../../app/views/partials/styles.ejs';

function extractScriptContent(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Find script tags and extract JavaScript content
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    let match;
    
    while ((match = scriptRegex.exec(content)) !== null) {
        scripts.push(match[1]);
    }
    
    return scripts.join('\n');
}

function extractMethods(jsContent) {
    // Extract async methods
    const asyncMethodRegex = /async\s+(\w+)\s*\([^)]*\)\s*\{/g;
    const asyncMethods = [];
    let match;
    
    while ((match = asyncMethodRegex.exec(jsContent)) !== null) {
        asyncMethods.push(match[1]);
    }
    
    // Extract regular methods (Vue.js object method syntax)
    const methodRegex = /(\w+):\s*function\s*\([^)]*\)\s*\{/g;
    const regularMethods = [];
    
    while ((match = methodRegex.exec(jsContent)) !== null) {
        regularMethods.push(match[1]);
    }
    
    return {
        async: asyncMethods,
        regular: regularMethods
    };
}

function extractDataProperties(jsContent) {
    // Find the data() function and extract its properties
    const dataFunctionRegex = /data\(\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\}/;
    const match = dataFunctionRegex.exec(jsContent);
    
    if (!match) return [];
    
    const dataContent = match[1];
    
    // Extract property names (simple regex - won't handle all cases but gets most)
    const propertyRegex = /^\s*(\w+):/gm;
    const properties = [];
    let propMatch;
    
    while ((propMatch = propertyRegex.exec(dataContent)) !== null) {
        properties.push(propMatch[1]);
    }
    
    return properties;
}

function extractCSSProperties(cssContent) {
    // Extract CSS custom properties from :root
    const rootRegex = /:root\s*\{([^}]*)\}/g;
    const customProps = [];
    let match;
    
    while ((match = rootRegex.exec(cssContent)) !== null) {
        const rootContent = match[1];
        const propRegex = /--([^:]+):/g;
        let propMatch;
        
        while ((propMatch = propRegex.exec(rootContent)) !== null) {
            customProps.push('--' + propMatch[1].trim());
        }
    }
    
    return customProps;
}

function main() {
    console.log('🔍 Extracting JavaScript functions and data from scripts.ejs...\n');
    
    try {
        // Extract JavaScript content
        const jsContent = extractScriptContent(scriptsPath);
        
        // Extract methods
        const methods = extractMethods(jsContent);
        console.log(`📋 Found ${methods.async.length} async methods:`);
        methods.async.forEach(method => console.log(`  - ${method}()`));
        
        console.log(`\n📋 Found ${methods.regular.length} regular methods:`);
        methods.regular.forEach(method => console.log(`  - ${method}()`));
        
        // Extract data properties
        const dataProps = extractDataProperties(jsContent);
        console.log(`\n💾 Found ${dataProps.length} data properties:`);
        dataProps.forEach(prop => console.log(`  - ${prop}`));
        
        // Extract CSS content
        console.log('\n🎨 Extracting CSS custom properties from styles.ejs...\n');
        const cssContent = fs.readFileSync(stylesPath, 'utf8');
        const cssProps = extractCSSProperties(cssContent);
        console.log(`🎨 Found ${cssProps.length} CSS custom properties:`);
        cssProps.slice(0, 20).forEach(prop => console.log(`  - ${prop}`));
        if (cssProps.length > 20) {
            console.log(`  ... and ${cssProps.length - 20} more`);
        }
        
        // Save extraction results
        const results = {
            extracted_at: new Date().toISOString(),
            scripts: {
                async_methods: methods.async,
                regular_methods: methods.regular,
                data_properties: dataProps
            },
            styles: {
                css_custom_properties: cssProps
            }
        };
        
        fs.writeFileSync('./extraction-results.json', JSON.stringify(results, null, 2));
        console.log('\n💾 Results saved to extraction-results.json');
        
    } catch (error) {
        console.error('❌ Error during extraction:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export {
    extractScriptContent,
    extractMethods,
    extractDataProperties,
    extractCSSProperties
};