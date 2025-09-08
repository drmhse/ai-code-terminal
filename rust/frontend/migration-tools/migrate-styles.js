#!/usr/bin/env node

/**
 * CSS migration tool for styles.ejs
 * Extracts and migrates CSS custom properties and component styles to Vue frontend
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stylesPath = '../../../app/views/partials/styles.ejs';
const outputPath = '../src/assets/migrated-styles.css';

function extractAndCleanCSS(content) {
    // Remove EJS template tags and script content
    let cleanContent = content.replace(/<script[\s\S]*?<\/script>/gi, '');
    cleanContent = cleanContent.replace(/<%[\s\S]*?%>/g, '');
    
    // Extract style tags content
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    const styles = [];
    let match;
    
    while ((match = styleRegex.exec(cleanContent)) !== null) {
        styles.push(match[1]);
    }
    
    return styles.join('\n');
}

function organizeCSS(cssContent) {
    const sections = {
        customProperties: [],
        globalStyles: [],
        componentStyles: [],
        responsiveStyles: [],
        animations: []
    };
    
    // Split by logical sections
    const lines = cssContent.split('\n');
    let currentSection = 'globalStyles';
    let insideRoot = false;
    let insideMediaQuery = false;
    let insideKeyframes = false;
    let braceCount = 0;
    
    for (let line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments for classification
        if (!trimmedLine || trimmedLine.startsWith('/*')) {
            sections[currentSection].push(line);
            continue;
        }
        
        // Detect :root section
        if (trimmedLine.includes(':root')) {
            currentSection = 'customProperties';
            insideRoot = true;
        }
        
        // Detect media queries
        if (trimmedLine.startsWith('@media')) {
            currentSection = 'responsiveStyles';
            insideMediaQuery = true;
        }
        
        // Detect keyframes
        if (trimmedLine.includes('@keyframes')) {
            currentSection = 'animations';
            insideKeyframes = true;
        }
        
        // Track braces to know when sections end
        const openBraces = (line.match(/\\{/g) || []).length;
        const closeBraces = (line.match(/\\}/g) || []).length;
        braceCount += openBraces - closeBraces;
        
        // Add line to current section
        sections[currentSection].push(line);
        
        // Reset section when we exit root, media query, or keyframes
        if (braceCount === 0) {
            if (insideRoot || insideMediaQuery || insideKeyframes) {
                currentSection = 'globalStyles';
                insideRoot = false;
                insideMediaQuery = false;
                insideKeyframes = false;
            }
        }
        
        // Detect component-specific styles (class or ID selectors)
        if (trimmedLine.match(/^[.#][a-zA-Z]/)) {
            currentSection = 'componentStyles';
        }
    }
    
    return sections;
}

function generateVueStyles(sections) {
    const output = [];
    
    output.push('/* Migrated styles from original EJS templates */');
    output.push('/* Generated on: ' + new Date().toISOString() + ' */');
    output.push('');
    
    // CSS Custom Properties
    if (sections.customProperties.length > 0) {
        output.push('/* ========================================');
        output.push('   CSS Custom Properties (CSS Variables)');
        output.push('   ======================================== */');
        output.push('');
        output.push(...sections.customProperties);
        output.push('');
    }
    
    // Global Styles
    if (sections.globalStyles.length > 0) {
        output.push('/* ========================================');
        output.push('   Global Base Styles');
        output.push('   ======================================== */');
        output.push('');
        output.push(...sections.globalStyles);
        output.push('');
    }
    
    // Component Styles
    if (sections.componentStyles.length > 0) {
        output.push('/* ========================================');
        output.push('   Component-Specific Styles');
        output.push('   ======================================== */');
        output.push('');
        output.push(...sections.componentStyles);
        output.push('');
    }
    
    // Animations
    if (sections.animations.length > 0) {
        output.push('/* ========================================');
        output.push('   Animations and Keyframes');
        output.push('   ======================================== */');
        output.push('');
        output.push(...sections.animations);
        output.push('');
    }
    
    // Responsive Styles
    if (sections.responsiveStyles.length > 0) {
        output.push('/* ========================================');
        output.push('   Responsive Styles and Media Queries');
        output.push('   ======================================== */');
        output.push('');
        output.push(...sections.responsiveStyles);
        output.push('');
    }
    
    return output.join('\\n');
}

function main() {
    console.log('🎨 Migrating CSS styles from styles.ejs...');
    
    try {
        // Read and process the styles file
        const rawContent = fs.readFileSync(stylesPath, 'utf8');
        console.log(`📏 Original styles.ejs: ${rawContent.split('\\n').length} lines`);
        
        // Extract clean CSS content
        const cssContent = extractAndCleanCSS(rawContent);
        console.log(`✨ Extracted CSS content: ${cssContent.split('\\n').length} lines`);
        
        // Organize CSS into sections
        const sections = organizeCSS(cssContent);
        
        console.log('📋 CSS Organization:');
        console.log(`  - Custom Properties: ${sections.customProperties.length} lines`);
        console.log(`  - Global Styles: ${sections.globalStyles.length} lines`);
        console.log(`  - Component Styles: ${sections.componentStyles.length} lines`);
        console.log(`  - Responsive Styles: ${sections.responsiveStyles.length} lines`);
        console.log(`  - Animations: ${sections.animations.length} lines`);
        
        // Generate organized Vue-compatible CSS
        const outputCSS = generateVueStyles(sections);
        
        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        fs.mkdirSync(outputDir, { recursive: true });
        
        // Write the organized CSS
        fs.writeFileSync(outputPath, outputCSS);
        
        console.log(`\\n💾 Migrated styles written to: ${outputPath}`);
        console.log(`✅ CSS migration completed successfully!`);
        
        // Generate import statement for main.ts
        console.log('\\n📝 Add this import to your main.ts:');
        console.log("import './assets/migrated-styles.css'");
        
    } catch (error) {
        console.error('❌ Error during CSS migration:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { extractAndCleanCSS, organizeCSS, generateVueStyles };