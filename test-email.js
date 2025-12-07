/**
 * Teste de Email - Paraty GO!
 * Envia um email de teste para verificar se o Resend está funcionando
 */

require('dotenv').config();
const { Resend } = require('resend');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

async function sendTestEmail() {
    console.log(`\n${colors.cyan}${'═'.repeat(50)}${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}  🌴 PARATY GO! - Teste de Email${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(50)}${colors.reset}\n`);

    const resend = new Resend(process.env.RESEND_API_KEY);

    const testEmailHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #0c1929 0%, #1a6b9a 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; text-align: center; }
            .success-icon { font-size: 60px; margin-bottom: 20px; }
            .message { color: #333; font-size: 16px; line-height: 1.6; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .badge { display: inline-block; background: #22d3ee; color: #0c1929; padding: 8px 20px; border-radius: 20px; font-weight: 600; margin-top: 15px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🌴 Paraty GO!</h1>
            </div>
            <div class="content">
                <div class="success-icon">✅</div>
                <div class="message">
                    <strong>Teste de Email Bem-Sucedido!</strong>
                    <br><br>
                    Se você está lendo este email, significa que o sistema de notificações do Paraty GO! está funcionando perfeitamente.
                </div>
                <div class="badge">Sistema Operacional</div>
            </div>
            <div class="footer">
                <p>Email de teste enviado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                <p>Paraty GO! - Plataforma de Turismo Inteligente</p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        console.log(`${colors.cyan}📧 Enviando email de teste...${colors.reset}`);
        console.log(`   De: ${process.env.EMAIL_FROM}`);
        console.log(`   Para: ${process.env.EMAIL_TO}\n`);

        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to: process.env.EMAIL_TO,
            subject: '✅ Paraty GO! - Teste de Sistema',
            html: testEmailHTML,
        });

        if (error) {
            console.log(`${colors.red}❌ Erro ao enviar email:${colors.reset}`);
            console.log(`   ${error.message}`);
            
            if (error.message.includes('not verified')) {
                console.log(`\n${colors.yellow}⚠️  Dica: O email de destino precisa estar verificado no Resend.${colors.reset}`);
                console.log(`   Para ambiente de teste, use o email cadastrado na conta Resend.`);
            }
            
            process.exit(1);
        }

        console.log(`${colors.green}✅ Email enviado com sucesso!${colors.reset}`);
        console.log(`   ID: ${data.id}`);
        console.log(`\n${colors.yellow}📬 Verifique sua caixa de entrada em: ${process.env.EMAIL_TO}${colors.reset}`);
        
    } catch (error) {
        console.log(`${colors.red}❌ Erro crítico:${colors.reset}`);
        console.log(`   ${error.message}`);
        process.exit(1);
    }

    console.log(`\n${colors.cyan}${'═'.repeat(50)}${colors.reset}\n`);
}

sendTestEmail();
