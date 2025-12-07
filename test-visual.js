/**
 * 📸 Paraty GO! - Teste Visual de Responsividade
 * 
 * Este script usa Puppeteer para capturar screenshots da página
 * em diferentes tamanhos de tela para verificação visual.
 * 
 * Uso: npm run test:visual
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Configurações de viewport para teste
const viewports = [
    { name: 'iPhone-SE', width: 375, height: 667, deviceScaleFactor: 2 },
    { name: 'iPhone-12', width: 390, height: 844, deviceScaleFactor: 3 },
    { name: 'iPhone-14-Pro-Max', width: 430, height: 932, deviceScaleFactor: 3 },
    { name: 'Pixel-7', width: 412, height: 915, deviceScaleFactor: 2.625 },
    { name: 'iPad-Mini', width: 768, height: 1024, deviceScaleFactor: 2 },
    { name: 'iPad-Pro', width: 1024, height: 1366, deviceScaleFactor: 2 },
    { name: 'Desktop-HD', width: 1280, height: 800, deviceScaleFactor: 1 },
    { name: 'Desktop-FHD', width: 1920, height: 1080, deviceScaleFactor: 1 },
    { name: 'Desktop-2K', width: 2560, height: 1440, deviceScaleFactor: 1 },
];

// Páginas para testar
const pages = [
    { name: 'index', url: 'index.html' },
    { name: 'confirmacao', url: 'confirmacao.html' }
];

// Cores para output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
    dim: '\x1b[2m'
};

function log(icon, message, color = 'white') {
    console.log(`${colors[color]}${icon} ${message}${colors.reset}`);
}

function header(title) {
    console.log(`\n${colors.bgBlue}${colors.white}  ${title}  ${colors.reset}\n`);
}

async function waitForAnimations(page) {
    // Espera animações de entrada completarem
    await page.waitForTimeout(1500);
}

async function captureScreenshots() {
    const screenshotsDir = path.join(__dirname, 'screenshots');
    
    // Criar pasta de screenshots se não existir
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
        log('📁', 'Pasta screenshots criada', 'green');
    } else {
        // Limpar screenshots antigas
        const files = fs.readdirSync(screenshotsDir);
        for (const file of files) {
            fs.unlinkSync(path.join(screenshotsDir, file));
        }
        log('🗑️', 'Screenshots anteriores removidas', 'dim');
    }

    header('📸 TESTE VISUAL DE RESPONSIVIDADE');
    log('🚀', 'Iniciando Puppeteer...', 'cyan');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const results = {
        total: 0,
        captured: 0,
        issues: []
    };

    try {
        for (const pageConfig of pages) {
            header(`📄 Testando: ${pageConfig.name}.html`);

            for (const viewport of viewports) {
                results.total++;
                const page = await browser.newPage();
                
                await page.setViewport({
                    width: viewport.width,
                    height: viewport.height,
                    deviceScaleFactor: viewport.deviceScaleFactor
                });

                const filePath = `file://${path.join(__dirname, pageConfig.url)}`;
                
                try {
                    await page.goto(filePath, { 
                        waitUntil: 'networkidle0',
                        timeout: 30000 
                    });

                    // Esperar loading screen desaparecer (para confirmacao.html)
                    if (pageConfig.name === 'confirmacao') {
                        await page.waitForTimeout(2500);
                    }

                    await waitForAnimations(page);

                    // Checar overflow horizontal
                    const hasHorizontalScroll = await page.evaluate(() => {
                        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
                    });

                    if (hasHorizontalScroll) {
                        results.issues.push(`${pageConfig.name} @ ${viewport.name}: Scroll horizontal detectado`);
                    }

                    // Checar elementos cortados
                    const elementsCutOff = await page.evaluate(() => {
                        const issues = [];
                        const elements = document.querySelectorAll('.form-section, .benefit-card, .text-block, .partnership-container, .submit-btn');
                        
                        elements.forEach(el => {
                            const rect = el.getBoundingClientRect();
                            if (rect.right > window.innerWidth) {
                                issues.push(el.className);
                            }
                        });
                        
                        return issues;
                    });

                    if (elementsCutOff.length > 0) {
                        results.issues.push(`${pageConfig.name} @ ${viewport.name}: Elementos cortados: ${elementsCutOff.join(', ')}`);
                    }

                    // Checar touch targets
                    const smallTouchTargets = await page.evaluate(() => {
                        const issues = [];
                        const clickables = document.querySelectorAll('button, a, input, select, [onclick]');
                        
                        clickables.forEach(el => {
                            const rect = el.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
                                const id = el.id || el.className || el.tagName;
                                if (!id.includes('checkbox')) { // Checkboxes têm label clicável
                                    issues.push(`${el.tagName}(${rect.width.toFixed(0)}x${rect.height.toFixed(0)})`);
                                }
                            }
                        });
                        
                        return issues;
                    });

                    // Screenshot do topo
                    const screenshotPath = path.join(screenshotsDir, `${pageConfig.name}-${viewport.name}.png`);
                    await page.screenshot({ 
                        path: screenshotPath,
                        fullPage: false // Apenas viewport visível
                    });

                    // Screenshot full page
                    const fullScreenshotPath = path.join(screenshotsDir, `${pageConfig.name}-${viewport.name}-full.png`);
                    await page.screenshot({ 
                        path: fullScreenshotPath,
                        fullPage: true
                    });

                    results.captured++;
                    
                    const status = hasHorizontalScroll || elementsCutOff.length > 0 ? '⚠️' : '✅';
                    log(status, `${viewport.name} (${viewport.width}x${viewport.height}) - Capturado`, 
                        hasHorizontalScroll ? 'yellow' : 'green');

                } catch (error) {
                    log('❌', `${viewport.name}: Erro - ${error.message}`, 'red');
                    results.issues.push(`${pageConfig.name} @ ${viewport.name}: ${error.message}`);
                }

                await page.close();
            }
        }
    } finally {
        await browser.close();
    }

    // Relatório final
    header('📊 RELATÓRIO FINAL');
    
    console.log(`\n${colors.green}✅ Screenshots capturadas: ${results.captured}/${results.total}${colors.reset}`);
    console.log(`${colors.cyan}📁 Salvas em: ${screenshotsDir}${colors.reset}\n`);

    if (results.issues.length > 0) {
        console.log(`${colors.yellow}⚠️ Problemas encontrados:${colors.reset}`);
        results.issues.forEach(issue => {
            console.log(`   • ${issue}`);
        });
    } else {
        console.log(`${colors.green}✨ Nenhum problema de responsividade detectado!${colors.reset}`);
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`${colors.dim}Abra a pasta 'screenshots' para verificar visualmente.${colors.reset}`);
    console.log('─'.repeat(60) + '\n');

    // Retorna código de saída baseado nos problemas
    process.exit(results.issues.length > 0 ? 1 : 0);
}

// Verificar se Puppeteer está instalado
try {
    require.resolve('puppeteer');
} catch (e) {
    console.log('\n⚠️ Puppeteer não está instalado.');
    console.log('Execute: npm install puppeteer --save-dev\n');
    process.exit(1);
}

// Executar
captureScreenshots().catch(error => {
    console.error('Erro:', error);
    process.exit(1);
});
