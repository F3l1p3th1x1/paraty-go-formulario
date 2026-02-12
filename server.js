require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const admin = require('firebase-admin');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3001;

// Inicializar Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
});

const db = admin.firestore();

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// Configuração do Multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido'), false);
        }
    }
});

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

// Rota para receber o formulário (1 arquivo apenas, máx 10MB)
app.post('/api/cadastro', (req, res, next) => {
    upload.single('documentos')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: 'Arquivo muito grande. O limite é de 10MB.'
                });
            }
            if (err.message === 'Tipo de arquivo não permitido') {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de arquivo não permitido. Use apenas JPG, PNG, WEBP, GIF ou PDF.'
                });
            }
            return res.status(400).json({
                success: false,
                message: 'Erro no upload do arquivo: ' + err.message
            });
        }
        next();
    });
}, async (req, res) => {
    try {
        const arquivoNome = req.file ? req.file.originalname : null;

        const formData = {
            nomeEmpresa: req.body.nomeEmpresa,
            categoria: req.body.categoria,
            descricao: req.body.descricao,
            nomeResponsavel: req.body.nomeResponsavel,
            email: req.body.email,
            whatsapp: req.body.whatsapp,
            endereco: req.body.endereco,
            capacidade: req.body.capacidade,
            redesSociais: req.body.redesSociais,
            diferencial: req.body.diferencial,
            arquivosNomes: arquivoNome,
            termos: req.body.termos === 'on',
            dataEnvio: admin.firestore.FieldValue.serverTimestamp(),
            status: 'pendente'
        };

        // Salvar no Firebase Firestore
        const docRef = await db.collection('cadastros').add(formData);
        console.log('✅ Cadastro salvo no Firebase:', docRef.id);

        // Preparar anexo para email (se houver)
        const attachments = [];
        if (req.file) {
            attachments.push({
                filename: req.file.originalname,
                content: req.file.buffer,
            });
            console.log(`📎 Anexo: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);
        }

        // Enviar email via Resend
        const emailResult = await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to: process.env.EMAIL_TO,
            subject: `🌴 Novo Cadastro Paraty GO! - ${formData.nomeEmpresa}`,
            html: formatEmailHTML(formData),
            attachments: attachments.length > 0 ? attachments : undefined,
        });

        console.log('✅ Email enviado via Resend:', emailResult);

        res.status(200).json({
            success: true,
            message: 'Cadastro realizado com sucesso!',
            id: docRef.id
        });

    } catch (error) {
        console.error('❌ Erro ao processar cadastro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao processar cadastro. Tente novamente.',
            error: error.message
        });
    }
});

// Rota de health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
    🚀 Servidor Paraty GO! rodando na porta ${PORT}
    📧 Emails serão enviados para: ${process.env.EMAIL_TO}
    🔥 Firebase Project: ${process.env.FIREBASE_PROJECT_ID}
    `);
});
