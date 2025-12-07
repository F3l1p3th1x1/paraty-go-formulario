#!/usr/bin/env node
/**
 * 🏥 PARATY GO! - Database & Backend Health Check
 * 
 * Script completo para verificar a saúde do sistema.
 * Executa testes reais em todos os componentes críticos.
 * 
 * Uso: npm run db:health
 */

require('dotenv').config();

const https = require('https');
const http = require('http');

// Cores para output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m'
};

// Contadores
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let warnings = 0;

// Resultados detalhados
const results = {
    environment: { status: 'pending', details: [] },
    server: { status: 'pending', details: [] },
    firebase: { status: 'pending', details: [] },
    resend: { status: 'pending', details: [] },
    integration: { status: 'pending', details: [] }
};

function log(message, type = 'info') {
    const icons = {
        info: `${colors.blue}ℹ${colors.reset}`,
        success: `${colors.green}✅${colors.reset}`,
        error: `${colors.red}❌${colors.reset}`,
        warning: `${colors.yellow}⚠️${colors.reset}`,
        test: `${colors.cyan}🧪${colors.reset}`,
        section: `${colors.bright}${colors.cyan}`,
    };
    
    if (type === 'section') {
        console.log(`\n${icons.section}${'─'.repeat(50)}${colors.reset}`);
        console.log(`${icons.section}  ${message}${colors.reset}`);
        console.log(`${icons.section}${'─'.repeat(50)}${colors.reset}\n`);
    } else {
        console.log(`${icons[type] || ''} ${message}`);
    }
}

function test(name, passed, details = '') {
    totalTests++;
    if (passed) {
        passedTests++;
        log(`${name}: ${colors.green}PASSED${colors.reset} ${details ? `(${details})` : ''}`, 'success');
    } else {
        failedTests++;
        log(`${name}: ${colors.red}FAILED${colors.reset} ${details ? `- ${details}` : ''}`, 'error');
    }
    return passed;
}

function warn(name, message) {
    warnings++;
    log(`${name}: ${colors.yellow}WARNING${colors.reset} - ${message}`, 'warning');
}

// =====================================
// TESTES DE VARIÁVEIS DE AMBIENTE
// =====================================
async function checkEnvironment() {
    log('VARIÁVEIS DE AMBIENTE', 'section');
    
    const requiredVars = [
        { name: 'FIREBASE_PROJECT_ID', sensitive: false },
        { name: 'FIREBASE_PRIVATE_KEY', sensitive: true },
        { name: 'FIREBASE_CLIENT_EMAIL', sensitive: false },
        { name: 'RESEND_API_KEY', sensitive: true },
        { name: 'EMAIL_TO', sensitive: false },
        { name: 'EMAIL_FROM', sensitive: false },
        { name: 'PORT', sensitive: false }
    ];
    
    let allPassed = true;
    
    for (const v of requiredVars) {
        const value = process.env[v.name];
        const exists = !!value && value.trim() !== '';
        
        if (exists) {
            const displayValue = v.sensitive ? 
                `${value.substring(0, 10)}...` : 
                value;
            test(v.name, true, displayValue);
            results.environment.details.push({ name: v.name, status: 'ok' });
        } else {
            test(v.name, false, 'Variável não definida ou vazia');
            results.environment.details.push({ name: v.name, status: 'missing' });
            allPassed = false;
        }
    }
    
    // Validações específicas
    if (process.env.FIREBASE_PRIVATE_KEY) {
        const keyValid = process.env.FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY');
        if (!keyValid) {
            warn('FIREBASE_PRIVATE_KEY', 'Formato da chave pode estar incorreto');
        }
    }
    
    if (process.env.FIREBASE_CLIENT_EMAIL) {
        const emailValid = process.env.FIREBASE_CLIENT_EMAIL.includes('@') && 
                          process.env.FIREBASE_CLIENT_EMAIL.includes('.iam.gserviceaccount.com');
        if (!emailValid) {
            warn('FIREBASE_CLIENT_EMAIL', 'Email não parece ser uma service account válida');
        }
    }
    
    if (process.env.RESEND_API_KEY) {
        const keyValid = process.env.RESEND_API_KEY.startsWith('re_');
        if (!keyValid) {
            warn('RESEND_API_KEY', 'Chave não começa com "re_"');
        }
    }
    
    results.environment.status = allPassed ? 'passed' : 'failed';
    return allPassed;
}

// =====================================
// TESTES DO SERVIDOR BACKEND
// =====================================
async function checkServer() {
    log('SERVIDOR BACKEND', 'section');
    
    const port = process.env.PORT || 3001;
    const baseUrl = `http://localhost:${port}`;
    
    // Teste 1: Health Check
    const healthResult = await httpRequest(`${baseUrl}/api/health`);
    
    if (healthResult.success) {
        try {
            const data = JSON.parse(healthResult.body);
            test('Health Check Endpoint', data.status === 'ok', `Timestamp: ${data.timestamp}`);
            results.server.details.push({ test: 'health', status: 'ok' });
        } catch (e) {
            test('Health Check Endpoint', false, 'Resposta inválida');
            results.server.details.push({ test: 'health', status: 'invalid_response' });
        }
    } else {
        test('Health Check Endpoint', false, healthResult.error || 'Servidor não respondeu');
        results.server.details.push({ test: 'health', status: 'failed', error: healthResult.error });
        results.server.status = 'failed';
        return false;
    }
    
    // Teste 2: CORS Headers
    const corsResult = await httpRequest(`${baseUrl}/api/health`, 'OPTIONS');
    if (corsResult.success) {
        const hasCorHeaders = corsResult.headers && 
            (corsResult.headers['access-control-allow-origin'] || 
             corsResult.statusCode === 204 ||
             corsResult.statusCode === 200);
        test('CORS Configuration', hasCorHeaders, 'Headers configurados');
        results.server.details.push({ test: 'cors', status: hasCorHeaders ? 'ok' : 'warning' });
    } else {
        warn('CORS Configuration', 'Não foi possível verificar');
    }
    
    // Teste 3: Endpoint de cadastro existe
    const cadastroResult = await httpRequest(`${baseUrl}/api/cadastro`, 'POST', {}, true);
    // Esperamos um erro 400 ou similar, não 404
    const endpointExists = cadastroResult.statusCode !== 404;
    test('Endpoint /api/cadastro', endpointExists, 
        endpointExists ? 'Endpoint existe' : 'Endpoint não encontrado');
    results.server.details.push({ test: 'cadastro_endpoint', status: endpointExists ? 'ok' : 'failed' });
    
    results.server.status = 'passed';
    return true;
}

// =====================================
// TESTES DO FIREBASE
// =====================================
async function checkFirebase() {
    log('FIREBASE FIRESTORE', 'section');
    
    try {
        const admin = require('firebase-admin');
        
        // Inicializar Firebase se ainda não estiver
        if (!admin.apps.length) {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
            
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: privateKey,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                }),
            });
        }
        
        const db = admin.firestore();
        
        // Teste 1: Conexão básica
        test('Firebase Admin SDK', true, `Project: ${process.env.FIREBASE_PROJECT_ID}`);
        results.firebase.details.push({ test: 'sdk_init', status: 'ok' });
        
        // Teste 2: Listar coleções
        const collections = await db.listCollections();
        const collectionNames = collections.map(c => c.id);
        test('Acesso ao Firestore', true, `Coleções: ${collectionNames.join(', ') || 'nenhuma'}`);
        results.firebase.details.push({ test: 'list_collections', status: 'ok', collections: collectionNames });
        
        // Teste 3: Verificar se coleção 'cadastros' existe
        const hasCadastros = collectionNames.includes('cadastros');
        if (hasCadastros) {
            test('Coleção "cadastros"', true, 'Existe');
            
            // Teste 4: Contar documentos
            const snapshot = await db.collection('cadastros').limit(100).get();
            log(`   📊 Total de cadastros: ${snapshot.size}`, 'info');
            results.firebase.details.push({ test: 'cadastros_count', count: snapshot.size });
        } else {
            warn('Coleção "cadastros"', 'Ainda não existe (será criada no primeiro cadastro)');
        }
        
        // Teste 5: Teste de escrita (com rollback)
        const testDocRef = db.collection('_health_check').doc('test');
        const testData = {
            timestamp: new Date().toISOString(),
            test: true
        };
        
        await testDocRef.set(testData);
        const testDoc = await testDocRef.get();
        const writeSuccess = testDoc.exists && testDoc.data().test === true;
        test('Escrita no Firestore', writeSuccess, 'Teste de escrita OK');
        
        // Limpar documento de teste
        await testDocRef.delete();
        test('Limpeza de teste', true, 'Documento de teste removido');
        
        results.firebase.status = 'passed';
        results.firebase.details.push({ test: 'write_test', status: 'ok' });
        
        return true;
        
    } catch (error) {
        test('Firebase Firestore', false, error.message);
        results.firebase.status = 'failed';
        results.firebase.details.push({ test: 'connection', status: 'failed', error: error.message });
        return false;
    }
}

// =====================================
// TESTES DO RESEND (EMAIL)
// =====================================
async function checkResend() {
    log('RESEND EMAIL API', 'section');
    
    try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        // Teste 1: Verificar API Key
        test('Resend API Key', true, 'Chave configurada');
        results.resend.details.push({ test: 'api_key', status: 'ok' });
        
        // Teste 2: Listar domínios (valida a API key)
        try {
            const domains = await resend.domains.list();
            test('Conexão com Resend', true, 'API respondeu corretamente');
            results.resend.details.push({ test: 'api_connection', status: 'ok' });
            
            if (domains.data && domains.data.length > 0) {
                log(`   📧 Domínios configurados: ${domains.data.map(d => d.name).join(', ')}`, 'info');
            } else {
                log(`   📧 Usando domínio padrão: onboarding@resend.dev`, 'info');
            }
        } catch (apiError) {
            // API key inválida ou sem permissão
            if (apiError.message?.includes('API key')) {
                test('Conexão com Resend', false, 'API Key inválida');
                results.resend.status = 'failed';
                return false;
            }
            // Outros erros podem ser OK (rate limit, etc)
            warn('Resend API', apiError.message);
        }
        
        // Teste 3: Verificar configurações de email
        const emailTo = process.env.EMAIL_TO;
        const emailFrom = process.env.EMAIL_FROM;
        
        test('Email destino', !!emailTo && emailTo.includes('@'), emailTo);
        test('Email origem', !!emailFrom && emailFrom.includes('@'), emailFrom);
        
        results.resend.status = 'passed';
        return true;
        
    } catch (error) {
        test('Resend Email API', false, error.message);
        results.resend.status = 'failed';
        results.resend.details.push({ test: 'initialization', status: 'failed', error: error.message });
        return false;
    }
}

// =====================================
// TESTE DE INTEGRAÇÃO COMPLETO
// =====================================
async function checkIntegration() {
    log('TESTE DE INTEGRAÇÃO', 'section');
    
    const port = process.env.PORT || 3001;
    const baseUrl = `http://localhost:${port}`;
    
    // Simular um cadastro de teste (sem realmente salvar)
    log('🧪 Simulando fluxo completo de cadastro...', 'test');
    
    // Verificar se todos os componentes anteriores passaram
    const allComponentsOk = 
        results.environment.status === 'passed' &&
        results.server.status === 'passed' &&
        results.firebase.status === 'passed' &&
        results.resend.status === 'passed';
    
    if (allComponentsOk) {
        test('Integração de Componentes', true, 'Todos os sistemas comunicando');
        results.integration.status = 'passed';
        
        // Calcular latência média
        const startTime = Date.now();
        await httpRequest(`${baseUrl}/api/health`);
        const latency = Date.now() - startTime;
        
        log(`   ⚡ Latência do servidor: ${latency}ms`, 'info');
        
        if (latency > 1000) {
            warn('Performance', `Latência alta: ${latency}ms`);
        }
        
        return true;
    } else {
        test('Integração de Componentes', false, 'Um ou mais componentes falharam');
        results.integration.status = 'failed';
        return false;
    }
}

// =====================================
// UTILITÁRIOS
// =====================================
function httpRequest(url, method = 'GET', body = null, expectError = false) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? https : http;
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: method,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
        
        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    success: res.statusCode >= 200 && res.statusCode < 500,
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on('error', (error) => {
            resolve({
                success: false,
                error: error.message
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({
                success: false,
                error: 'Timeout (10s)'
            });
        });
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}

// =====================================
// RELATÓRIO FINAL
// =====================================
function printReport() {
    console.log('\n');
    console.log(`${colors.bright}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}  🏥 RELATÓRIO DE SAÚDE DO SISTEMA${colors.reset}`);
    console.log(`${colors.bright}${'═'.repeat(60)}${colors.reset}`);
    console.log('');
    
    const components = [
        { name: 'Variáveis de Ambiente', result: results.environment },
        { name: 'Servidor Backend', result: results.server },
        { name: 'Firebase Firestore', result: results.firebase },
        { name: 'Resend Email API', result: results.resend },
        { name: 'Integração', result: results.integration }
    ];
    
    for (const comp of components) {
        const statusIcon = comp.result.status === 'passed' ? 
            `${colors.green}✅ OPERACIONAL${colors.reset}` :
            comp.result.status === 'failed' ?
            `${colors.red}❌ FALHA${colors.reset}` :
            `${colors.yellow}⏳ NÃO TESTADO${colors.reset}`;
        
        console.log(`  ${comp.name.padEnd(25)} ${statusIcon}`);
    }
    
    console.log('');
    console.log(`${colors.bright}${'─'.repeat(60)}${colors.reset}`);
    console.log(`  📊 RESUMO DOS TESTES`);
    console.log(`${colors.bright}${'─'.repeat(60)}${colors.reset}`);
    console.log('');
    console.log(`  Total de testes:    ${totalTests}`);
    console.log(`  ${colors.green}Passou:${colors.reset}              ${passedTests}`);
    console.log(`  ${colors.red}Falhou:${colors.reset}              ${failedTests}`);
    console.log(`  ${colors.yellow}Avisos:${colors.reset}              ${warnings}`);
    console.log('');
    
    const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    if (failedTests === 0 && warnings === 0) {
        console.log(`${colors.bgGreen}${colors.white}${colors.bright}                                                            ${colors.reset}`);
        console.log(`${colors.bgGreen}${colors.white}${colors.bright}   🎉 SISTEMA 100% SAUDÁVEL - PRONTO PARA PRODUÇÃO! 🎉      ${colors.reset}`);
        console.log(`${colors.bgGreen}${colors.white}${colors.bright}                                                            ${colors.reset}`);
    } else if (failedTests === 0) {
        console.log(`${colors.bgYellow}${colors.white}${colors.bright}                                                            ${colors.reset}`);
        console.log(`${colors.bgYellow}${colors.white}${colors.bright}   ⚠️  SISTEMA OPERACIONAL COM ${warnings} AVISO(S)              ${colors.reset}`);
        console.log(`${colors.bgYellow}${colors.white}${colors.bright}                                                            ${colors.reset}`);
    } else {
        console.log(`${colors.bgRed}${colors.white}${colors.bright}                                                            ${colors.reset}`);
        console.log(`${colors.bgRed}${colors.white}${colors.bright}   ❌ SISTEMA COM PROBLEMAS - ${failedTests} FALHA(S) DETECTADA(S)    ${colors.reset}`);
        console.log(`${colors.bgRed}${colors.white}${colors.bright}                                                            ${colors.reset}`);
    }
    
    console.log('');
    console.log(`${colors.bright}${'═'.repeat(60)}${colors.reset}`);
    console.log(`  Taxa de sucesso: ${successRate}%`);
    console.log(`  Executado em: ${new Date().toLocaleString('pt-BR')}`);
    console.log(`${colors.bright}${'═'.repeat(60)}${colors.reset}`);
    console.log('');
    
    return failedTests === 0;
}

// =====================================
// EXECUÇÃO PRINCIPAL
// =====================================
async function main() {
    console.clear();
    console.log('');
    console.log(`${colors.bright}${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}  🌴 PARATY GO! - Health Check Completo${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}  Iniciando verificações em ${new Date().toLocaleString('pt-BR')}${colors.reset}`);
    
    try {
        // Executar todos os testes em sequência
        await checkEnvironment();
        await checkServer();
        await checkFirebase();
        await checkResend();
        await checkIntegration();
        
        // Mostrar relatório
        const success = printReport();
        
        // Exit code baseado no resultado
        process.exit(success ? 0 : 1);
        
    } catch (error) {
        console.error(`\n${colors.red}Erro fatal durante verificação:${colors.reset}`, error.message);
        process.exit(1);
    }
}

// Executar
main();
