/**
 * Script de Monitoramento - Paraty GO!
 * Verifica se o backend está funcionando corretamente
 */

require('dotenv').config();
const http = require('http');

const API_URL = `http://localhost:${process.env.PORT || 3001}`;

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(type, message) {
    const icons = {
        success: `${colors.green}✅`,
        error: `${colors.red}❌`,
        warning: `${colors.yellow}⚠️`,
        info: `${colors.blue}ℹ️`,
        check: `${colors.cyan}🔍`
    };
    console.log(`${icons[type]} ${message}${colors.reset}`);
}

function header(text) {
    console.log(`\n${colors.bold}${colors.cyan}${'═'.repeat(50)}${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}  ${text}${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(50)}${colors.reset}\n`);
}

// Teste 1: Health Check do servidor
async function testHealthCheck() {
    return new Promise((resolve) => {
        log('check', 'Verificando health check do servidor...');
        
        const req = http.get(`${API_URL}/api/health`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.status === 'ok') {
                        log('success', `Servidor respondendo corretamente`);
                        log('info', `  Timestamp: ${json.timestamp}`);
                        resolve(true);
                    } else {
                        log('error', 'Resposta inesperada do servidor');
                        resolve(false);
                    }
                } catch (e) {
                    log('error', 'Resposta inválida do servidor');
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            log('error', `Servidor não está respondendo: ${e.message}`);
            resolve(false);
        });

        req.setTimeout(5000, () => {
            log('error', 'Timeout na conexão com o servidor');
            req.destroy();
            resolve(false);
        });
    });
}

// Teste 2: Verificar configurações de ambiente
function testEnvConfig() {
    log('check', 'Verificando variáveis de ambiente...');
    
    const required = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL',
        'RESEND_API_KEY',
        'EMAIL_TO',
        'EMAIL_FROM'
    ];

    let allPresent = true;
    
    required.forEach(key => {
        if (process.env[key]) {
            const value = key.includes('KEY') || key.includes('PRIVATE') 
                ? '***' + process.env[key].slice(-10) 
                : process.env[key];
            log('success', `  ${key}: ${value}`);
        } else {
            log('error', `  ${key}: NÃO CONFIGURADO`);
            allPresent = false;
        }
    });

    return allPresent;
}

// Teste 3: Verificar conexão com Firebase
async function testFirebaseConnection() {
    log('check', 'Verificando conexão com Firebase...');
    
    try {
        const admin = require('firebase-admin');
        
        // Verificar se já foi inicializado
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                }),
            });
        }

        const db = admin.firestore();
        
        // Tentar listar coleções (operação leve)
        const collections = await db.listCollections();
        log('success', `Firebase conectado - Project: ${process.env.FIREBASE_PROJECT_ID}`);
        log('info', `  Coleções encontradas: ${collections.length > 0 ? collections.map(c => c.id).join(', ') : 'nenhuma ainda'}`);
        
        return true;
    } catch (error) {
        log('error', `Erro ao conectar com Firebase: ${error.message}`);
        return false;
    }
}

// Teste 4: Verificar conexão com Resend
async function testResendConnection() {
    log('check', 'Verificando conexão com Resend API...');
    
    try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        // Verificar a API key listando domínios
        const { data, error } = await resend.domains.list();
        
        if (error) {
            // API key pode ser válida mesmo sem domínios configurados
            if (error.message && error.message.includes('API')) {
                log('error', `API Key inválida: ${error.message}`);
                return false;
            }
        }
        
        log('success', 'Resend API conectada');
        log('info', `  Email de destino: ${process.env.EMAIL_TO}`);
        log('info', `  Email de origem: ${process.env.EMAIL_FROM}`);
        
        return true;
    } catch (error) {
        log('error', `Erro ao verificar Resend: ${error.message}`);
        return false;
    }
}

// Executar todos os testes
async function runAllTests() {
    header('🌴 PARATY GO! - Monitor de Sistema');
    
    console.log(`${colors.cyan}Iniciando verificações em ${new Date().toLocaleString('pt-BR')}${colors.reset}\n`);

    const results = {
        env: false,
        server: false,
        firebase: false,
        resend: false
    };

    // Teste de configurações
    results.env = testEnvConfig();
    console.log();

    // Teste do servidor
    results.server = await testHealthCheck();
    console.log();

    // Teste do Firebase
    results.firebase = await testFirebaseConnection();
    console.log();

    // Teste do Resend
    results.resend = await testResendConnection();

    // Resumo
    header('📊 RESUMO DO MONITORAMENTO');

    const tests = [
        { name: 'Variáveis de Ambiente', status: results.env },
        { name: 'Servidor Backend', status: results.server },
        { name: 'Firebase Firestore', status: results.firebase },
        { name: 'Resend Email API', status: results.resend }
    ];

    tests.forEach(test => {
        const status = test.status 
            ? `${colors.green}✅ OPERACIONAL${colors.reset}`
            : `${colors.red}❌ FALHA${colors.reset}`;
        console.log(`  ${test.name.padEnd(25)} ${status}`);
    });

    const allPassed = Object.values(results).every(r => r);
    
    console.log();
    if (allPassed) {
        log('success', `${colors.bold}SISTEMA 100% OPERACIONAL${colors.reset}`);
    } else {
        log('error', `${colors.bold}SISTEMA COM PROBLEMAS - Verifique os erros acima${colors.reset}`);
    }

    console.log(`\n${colors.cyan}${'═'.repeat(50)}${colors.reset}\n`);

    process.exit(allPassed ? 0 : 1);
}

runAllTests();
