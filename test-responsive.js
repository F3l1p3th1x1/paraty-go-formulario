#!/usr/bin/env node
/**
 * 📱 PARATY GO! - Teste de Responsividade
 * 
 * Script para verificar e validar estilos responsivos
 * Analisa o CSS e identifica problemas potenciais
 * 
 * Uso: npm run test:responsive
 */

const fs = require('fs');
const path = require('path');

// Cores para output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgRed: '\x1b[41m'
};

// Breakpoints padrão
const breakpoints = {
    mobile: 480,
    tablet: 768,
    laptop: 1024,
    desktop: 1280
};

// Contadores
let issues = [];
let warnings = [];
let passed = [];

function log(message, type = 'info') {
    const icons = {
        info: `${colors.blue}ℹ${colors.reset}`,
        success: `${colors.green}✅${colors.reset}`,
        error: `${colors.red}❌${colors.reset}`,
        warning: `${colors.yellow}⚠️${colors.reset}`,
        section: `${colors.bright}${colors.cyan}`,
        device: `${colors.magenta}📱${colors.reset}`
    };
    
    if (type === 'section') {
        console.log(`\n${icons.section}${'─'.repeat(60)}${colors.reset}`);
        console.log(`${icons.section}  ${message}${colors.reset}`);
        console.log(`${icons.section}${'─'.repeat(60)}${colors.reset}\n`);
    } else {
        console.log(`${icons[type] || ''} ${message}`);
    }
}

// =====================================
// ANÁLISE DE CSS
// =====================================
function analyzeCSS(content, filename) {
    log(`Analisando: ${filename}`, 'section');
    
    // 1. Verificar media queries
    const mediaQueries = content.match(/@media[^{]+\{/g) || [];
    log(`Media queries encontradas: ${mediaQueries.length}`, 'info');
    
    const mqBreakpoints = [];
    mediaQueries.forEach(mq => {
        const match = mq.match(/max-width:\s*(\d+)px/);
        if (match) {
            mqBreakpoints.push(parseInt(match[1]));
        }
        const minMatch = mq.match(/min-width:\s*(\d+)px/);
        if (minMatch) {
            mqBreakpoints.push(parseInt(minMatch[1]));
        }
    });
    
    // Verificar breakpoints essenciais
    const hasTablet = mqBreakpoints.some(bp => bp >= 600 && bp <= 900);
    const hasMobile = mqBreakpoints.some(bp => bp <= 500);
    const hasLaptop = mqBreakpoints.some(bp => bp >= 1000 && bp <= 1100);
    
    if (hasTablet) {
        passed.push('Breakpoint para tablet (768px) definido');
        log('Breakpoint tablet: OK', 'success');
    } else {
        warnings.push('Falta breakpoint específico para tablet (~768px)');
        log('Breakpoint tablet: FALTANDO', 'warning');
    }
    
    if (hasMobile) {
        passed.push('Breakpoint para mobile definido');
        log('Breakpoint mobile: OK', 'success');
    } else {
        issues.push('Falta breakpoint para mobile pequeno (~480px)');
        log('Breakpoint mobile pequeno: FALTANDO', 'error');
    }
    
    // 2. Verificar unidades fixas problemáticas
    const fixedWidths = content.match(/width:\s*\d{3,}px/g) || [];
    const largeFixedWidths = fixedWidths.filter(w => {
        const val = parseInt(w.match(/\d+/)[0]);
        return val > 400;
    });
    
    if (largeFixedWidths.length > 0) {
        warnings.push(`${largeFixedWidths.length} larguras fixas > 400px encontradas`);
        log(`Larguras fixas grandes: ${largeFixedWidths.length} encontradas`, 'warning');
    } else {
        passed.push('Sem larguras fixas problemáticas');
        log('Larguras fixas: OK', 'success');
    }
    
    // 3. Verificar uso de vw/vh/rem/em
    const hasResponsiveUnits = /\d+(\.\d+)?(vw|vh|rem|em|%|clamp)/g.test(content);
    if (hasResponsiveUnits) {
        passed.push('Usa unidades responsivas (vw, vh, rem, em, %, clamp)');
        log('Unidades responsivas: OK', 'success');
    }
    
    // 4. Verificar flexbox/grid
    const hasFlexbox = /display:\s*flex/g.test(content);
    const hasGrid = /display:\s*grid/g.test(content);
    
    if (hasFlexbox || hasGrid) {
        passed.push('Usa Flexbox/Grid para layout');
        log('Layout moderno (Flex/Grid): OK', 'success');
    }
    
    // 5. Verificar overflow-x
    const hasOverflowControl = /overflow-x:\s*hidden/g.test(content);
    if (hasOverflowControl) {
        passed.push('Controle de overflow horizontal');
        log('Overflow-x control: OK', 'success');
    } else {
        warnings.push('Considere adicionar overflow-x: hidden no body');
        log('Overflow-x control: RECOMENDADO', 'warning');
    }
    
    // 6. Verificar font-sizes responsivos
    const hasClampFonts = /font-size:\s*clamp/g.test(content);
    if (hasClampFonts) {
        passed.push('Usa clamp() para fontes responsivas');
        log('Fontes responsivas (clamp): OK', 'success');
    }
    
    // 7. Verificar padding/margin excessivos
    const largePaddings = content.match(/padding:\s*\d{3,}px/g) || [];
    if (largePaddings.length > 0) {
        warnings.push(`${largePaddings.length} paddings > 100px encontrados`);
        log(`Paddings grandes: ${largePaddings.length}`, 'warning');
    }
    
    // 8. Verificar imagens responsivas
    const hasMaxWidth100 = /max-width:\s*100%/g.test(content);
    if (hasMaxWidth100) {
        passed.push('Imagens com max-width: 100%');
        log('Imagens responsivas: OK', 'success');
    }
    
    return { mqBreakpoints, hasTablet, hasMobile };
}

// =====================================
// ANÁLISE DE ELEMENTOS ESPECÍFICOS
// =====================================
function analyzeElements(content) {
    log('ELEMENTOS CRÍTICOS PARA MOBILE', 'section');
    
    const criticalElements = [
        { selector: '.container', name: 'Container principal' },
        { selector: '.hero', name: 'Seção Hero' },
        { selector: '.logo', name: 'Logo' },
        { selector: '.form-section', name: 'Formulário' },
        { selector: '.submit-btn', name: 'Botão de envio' },
        { selector: '.form-grid', name: 'Grid do formulário' },
        { selector: '.text-block', name: 'Blocos de texto' },
        { selector: '.benefits-grid', name: 'Grid de benefícios' },
        { selector: '.benefit-card', name: 'Cards de benefício' },
        { selector: '.partnership-container', name: 'Seção parceria' }
    ];
    
    criticalElements.forEach(el => {
        const regex = new RegExp(`\\${el.selector}\\s*\\{[^}]*\\}`, 'g');
        const matches = content.match(regex) || [];
        
        if (matches.length > 0) {
            // Verificar se tem regras em media query - busca melhorada
            // Procura o seletor após @media até o fechamento do bloco
            const selectorEscaped = el.selector.replace('.', '\\.');
            
            // Método mais simples: verificar se o seletor aparece depois de @media
            const mediaBlocks = content.split('@media');
            let hasResponsive = false;
            
            for (let i = 1; i < mediaBlocks.length; i++) {
                if (mediaBlocks[i].includes(el.selector.substring(1))) { // remove o ponto
                    hasResponsive = true;
                    break;
                }
            }
            
            if (hasResponsive) {
                passed.push(`${el.name}: tem estilos responsivos`);
                log(`${el.name}: ✅ Responsivo`, 'success');
            } else {
                warnings.push(`${el.name}: pode precisar de ajustes mobile`);
                log(`${el.name}: ⚠️ Verificar responsividade`, 'warning');
            }
        } else {
            log(`${el.name}: Não encontrado`, 'info');
        }
    });
}

// =====================================
// SUGESTÕES DE MELHORIAS
// =====================================
function generateSuggestions(analysis) {
    log('SUGESTÕES DE MELHORIAS', 'section');
    
    const suggestions = [];
    
    // Mobile first
    if (!analysis.hasMobile) {
        suggestions.push({
            priority: 'ALTA',
            message: 'Adicionar breakpoint para mobile pequeno (max-width: 480px)',
            code: `@media (max-width: 480px) {
    .container { padding: 20px 16px; }
    .logo { font-size: 2.5rem; }
    .form-section { padding: 24px 16px; }
    .submit-btn { width: 100%; padding: 18px 24px; }
}`
        });
    }
    
    // Touch targets
    suggestions.push({
        priority: 'MÉDIA',
        message: 'Garantir touch targets de pelo menos 44x44px em mobile',
        code: `@media (max-width: 768px) {
    .submit-btn, .social-link, button, a { min-height: 44px; }
}`
    });
    
    // Form inputs
    suggestions.push({
        priority: 'ALTA',
        message: 'Inputs de formulário devem ter 100% de largura em mobile',
        code: `@media (max-width: 768px) {
    .form-group input, .form-group select, .form-group textarea {
        width: 100%;
        font-size: 16px; /* Previne zoom no iOS */
    }
}`
    });
    
    suggestions.forEach((s, i) => {
        const color = s.priority === 'ALTA' ? colors.red : 
                     s.priority === 'MÉDIA' ? colors.yellow : colors.blue;
        console.log(`\n${color}[${s.priority}]${colors.reset} ${s.message}`);
        if (s.code) {
            console.log(`${colors.cyan}Código sugerido:${colors.reset}`);
            console.log(colors.bright + s.code + colors.reset);
        }
    });
    
    return suggestions;
}

// =====================================
// CHECKLIST DE RESPONSIVIDADE
// =====================================
function printChecklist() {
    log('CHECKLIST DE RESPONSIVIDADE', 'section');
    
    const checklist = [
        { item: 'Viewport meta tag', check: 'meta name="viewport"' },
        { item: 'Texto legível sem zoom (16px mínimo)', check: 'font-size' },
        { item: 'Elementos não ultrapassam viewport', check: 'max-width' },
        { item: 'Botões com tamanho adequado para toque', check: 'min-height: 44px' },
        { item: 'Formulários usáveis em mobile', check: 'form' },
        { item: 'Imagens responsivas', check: 'max-width: 100%' },
        { item: 'Scroll horizontal evitado', check: 'overflow-x' },
        { item: 'Breakpoints definidos (480, 768, 1024)', check: '@media' }
    ];
    
    checklist.forEach(c => {
        console.log(`  ☐ ${c.item}`);
    });
}

// =====================================
// RELATÓRIO FINAL
// =====================================
function printReport() {
    console.log('\n');
    console.log(`${colors.bright}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}  📱 RELATÓRIO DE RESPONSIVIDADE${colors.reset}`);
    console.log(`${colors.bright}${'═'.repeat(60)}${colors.reset}`);
    
    console.log(`\n${colors.green}✅ PASSOU (${passed.length}):${colors.reset}`);
    passed.forEach(p => console.log(`   • ${p}`));
    
    if (warnings.length > 0) {
        console.log(`\n${colors.yellow}⚠️ AVISOS (${warnings.length}):${colors.reset}`);
        warnings.forEach(w => console.log(`   • ${w}`));
    }
    
    if (issues.length > 0) {
        console.log(`\n${colors.red}❌ PROBLEMAS (${issues.length}):${colors.reset}`);
        issues.forEach(i => console.log(`   • ${i}`));
    }
    
    console.log('\n' + '─'.repeat(60));
    
    const score = Math.round((passed.length / (passed.length + warnings.length + issues.length)) * 100);
    
    let statusBg, statusMsg;
    if (score >= 90) {
        statusBg = colors.bgGreen;
        statusMsg = '🎉 EXCELENTE! Responsividade OK';
    } else if (score >= 70) {
        statusBg = colors.bgYellow;
        statusMsg = '⚠️ BOM, mas pode melhorar';
    } else {
        statusBg = colors.bgRed;
        statusMsg = '❌ PRECISA DE MELHORIAS';
    }
    
    console.log(`\n${statusBg}${colors.bright}  Score: ${score}% - ${statusMsg}  ${colors.reset}\n`);
    
    return { passed, warnings, issues, score };
}

// =====================================
// EXECUÇÃO PRINCIPAL
// =====================================
async function main() {
    console.clear();
    console.log('');
    console.log(`${colors.bright}${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}  📱 PARATY GO! - Teste de Responsividade${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    
    // Ler arquivos HTML
    const files = ['index.html', 'confirmacao.html'];
    
    for (const file of files) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Extrair CSS inline
            const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
            if (styleMatch) {
                const css = styleMatch.join('\n');
                const analysis = analyzeCSS(css, file);
                analyzeElements(css);
                generateSuggestions(analysis);
            }
        } else {
            log(`Arquivo não encontrado: ${file}`, 'warning');
        }
    }
    
    printChecklist();
    const report = printReport();
    
    // Retornar código de saída baseado no resultado
    process.exit(report.issues.length > 0 ? 1 : 0);
}

main();
