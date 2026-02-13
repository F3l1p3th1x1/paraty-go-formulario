const admin = require('firebase-admin');
const { Resend } = require('resend');
const Busboy = require('busboy');

// Inicializar Firebase Admin (singleton)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
    });
}

const db = admin.firestore();
const resend = new Resend(process.env.RESEND_API_KEY);

// Função para formatar os dados do formulário para email
function formatEmailHTML(data) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #0c1929 0%, #1a6b9a 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 10px 0 0; opacity: 0.9; font-size: 14px; }
            .content { padding: 30px; }
            .field { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
            .field:last-child { border-bottom: none; }
            .label { font-weight: 600; color: #0c1929; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
            .value { color: #333; font-size: 16px; line-height: 1.5; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .badge { display: inline-block; background: #22d3ee; color: #0c1929; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🌴 Paraty GO!</h1>
                <p>Nova Solicitação de Cadastro de Parceiro</p>
            </div>
            <div class="content">
                <div class="field">
                    <div class="label">Nome da Empresa/Serviço</div>
                    <div class="value">${data.nomeEmpresa || 'Não informado'}</div>
                </div>
                <div class="field">
                    <div class="label">Categoria</div>
                    <div class="value"><span class="badge">${data.categoria || 'Não informado'}</span></div>
                </div>
                <div class="field">
                    <div class="label">Descrição do Serviço</div>
                    <div class="value">${data.descricao || 'Não informado'}</div>
                </div>
                <div class="field">
                    <div class="label">Responsável</div>
                    <div class="value">${data.nomeResponsavel || 'Não informado'}</div>
                </div>
                <div class="field">
                    <div class="label">Email</div>
                    <div class="value"><a href="mailto:${data.email}">${data.email || 'Não informado'}</a></div>
                </div>
                <div class="field">
                    <div class="label">WhatsApp</div>
                    <div class="value">${data.whatsapp || 'Não informado'}</div>
                </div>
                <div class="field">
                    <div class="label">Instagram / Site</div>
                    <div class="value">${data.redesSociais || 'Não informado'}</div>
                </div>
                <div class="field">
                    <div class="label">Endereço / Local</div>
                    <div class="value">${data.endereco || 'Não informado'}</div>
                </div>
                <div class="field">
                    <div class="label">Capacidade / Tipo de Serviço</div>
                    <div class="value">${data.capacidade || 'Não informado'}</div>
                </div>
                <div class="field">
                    <div class="label">Diferencial</div>
                    <div class="value">${data.diferencial || 'Não informado'}</div>
                </div>
                <div class="field">
                    <div class="label">Foto do Empreendimento</div>
                    <div class="value">${data.arquivosNomes || 'Nenhuma foto enviada'}</div>
                </div>
            </div>
            <div class="footer">
                <p>Enviado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                <p>Paraty GO! - Plataforma de Turismo Inteligente</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// Tipos de arquivo permitidos
const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Parser de multipart/form-data
function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({
            headers: req.headers,
            limits: {
                fileSize: MAX_FILE_SIZE,
                files: 1
            }
        });

        const fields = {};
        const files = [];

        busboy.on('field', (name, value) => {
            fields[name] = value;
        });

        busboy.on('file', (name, file, info) => {
            const { filename, mimeType } = info;

            if (!allowedTypes.includes(mimeType)) {
                file.resume(); // Descartar arquivo não permitido
                return;
            }

            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => {
                const buffer = Buffer.concat(chunks);
                if (buffer.length <= MAX_FILE_SIZE) {
                    files.push({
                        originalname: filename,
                        mimetype: mimeType,
                        buffer: buffer
                    });
                }
            });
        });

        busboy.on('finish', () => resolve({ fields, files }));
        busboy.on('error', reject);

        req.pipe(busboy);
    });
}

// Função para adicionar headers CORS
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
    setCorsHeaders(res);

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Health check
    if (req.method === 'GET' && req.url.includes('/health')) {
        return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // Rota de cadastro
    if (req.method === 'POST' && (req.url.includes('/cadastro') || req.url === '/api' || req.url === '/')) {
        try {
            const { fields, files } = await parseMultipart(req);

            const arquivosNomes = files.length > 0
                ? files.map(f => f.originalname).join(', ')
                : null;

            const formData = {
                nomeEmpresa: fields.nomeEmpresa || '',
                categoria: fields.categoria || '',
                descricao: fields.descricao || '',
                nomeResponsavel: fields.nomeResponsavel || '',
                email: fields.email || '',
                whatsapp: fields.whatsapp || '',
                endereco: fields.endereco || '',
                capacidade: fields.capacidade || '',
                redesSociais: fields.redesSociais || '',
                diferencial: fields.diferencial || '',
                arquivosNomes: arquivosNomes,
                termos: fields.termos === 'on',
                dataEnvio: admin.firestore.FieldValue.serverTimestamp(),
                status: 'pendente'
            };

            // Salvar no Firebase Firestore
            const docRef = await db.collection('cadastros').add(formData);
            console.log('✅ Cadastro salvo no Firebase:', docRef.id);

            // Preparar anexos para email (Resend precisa de content como Buffer ou base64 string)
            const attachments = files.map(file => ({
                filename: file.originalname,
                content: file.buffer.toString('base64'),
                type: file.mimetype
            }));

            console.log('📎 Anexos preparados:', files.length, 'arquivo(s)');

            // Enviar email via Resend
            if (process.env.EMAIL_FROM && process.env.EMAIL_TO) {
                const emailResult = await resend.emails.send({
                    from: process.env.EMAIL_FROM,
                    to: process.env.EMAIL_TO,
                    subject: `🌴 Novo Cadastro Paraty GO! - ${formData.nomeEmpresa}`,
                    html: formatEmailHTML(formData),
                    attachments: attachments.length > 0 ? attachments : undefined,
                });
                console.log('✅ Email enviado via Resend:', emailResult);
            }

            return res.status(200).json({
                success: true,
                message: 'Cadastro realizado com sucesso!',
                id: docRef.id
            });

        } catch (error) {
            console.error('❌ Erro ao processar cadastro:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao processar cadastro. Tente novamente.',
                error: error.message
            });
        }
    }

    // Rota não encontrada
    return res.status(404).json({ error: 'Rota não encontrada' });
};
