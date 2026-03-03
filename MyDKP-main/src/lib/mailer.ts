import nodemailer, { type Transporter } from 'nodemailer';

type MailProvider = 'office365' | 'smtp';

export type SendMailInput = {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  fromAddress?: string;
  fromName?: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  requireTls: boolean;
  allowSelfSignedCerts: boolean;
};

let tokenCache: { token: string; expiresAtMs: number } | null = null;
let smtpTransporterCache: { cacheKey: string; transporter: Transporter } | null = null;

function toBool(value: string | undefined, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function getMailProvider(): MailProvider {
  const explicit = (process.env.MAIL_PROVIDER || process.env.SENSITIVE_ALERT_MAIL_PROVIDER || '')
    .trim()
    .toLowerCase();
  if (explicit === 'smtp' || explicit === 'office365') {
    return explicit;
  }
  if ((process.env.SMTP_HOST || '').trim()) {
    return 'smtp';
  }
  return 'office365';
}

function formatSmtpFrom(address: string, name?: string | null) {
  const normalizedAddress = address.trim();
  const normalizedName = (name || '').trim();
  if (!normalizedName) return normalizedAddress;
  return `"${normalizedName.replace(/"/g, '\\"')}" <${normalizedAddress}>`;
}

function getDefaultFromAddress() {
  return (
    process.env.MAIL_DEFAULT_FROM_ADDRESS ||
    process.env.O365_FROM_ADDRESS ||
    process.env.O365_SENDER ||
    process.env.SMTP_USER ||
    ''
  )
    .trim();
}

function getDefaultFromName() {
  return (process.env.MAIL_DEFAULT_FROM_NAME || process.env.O365_FROM_NAME || '').trim();
}

async function getOffice365AccessToken() {
  const tenantId = (process.env.O365_TENANT_ID || '').trim();
  const clientId = (process.env.O365_CLIENT_ID || '').trim();
  const clientSecret = (process.env.O365_CLIENT_SECRET || '').trim();

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Office365 credentials (O365_TENANT_ID/O365_CLIENT_ID/O365_CLIENT_SECRET).');
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs > now + 60_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Office365 token request failed: ${tokenRes.status} ${text}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = String(tokenData.access_token || '');
  const expiresIn = Number(tokenData.expires_in || 3600);

  if (!accessToken) {
    throw new Error('Office365 token missing access_token.');
  }

  tokenCache = {
    token: accessToken,
    expiresAtMs: now + Math.max(300, expiresIn - 120) * 1000,
  };
  return accessToken;
}

function getSmtpConfig(): SmtpConfig {
  const host = (process.env.SMTP_HOST || '').trim();
  if (!host) {
    throw new Error('Missing SMTP_HOST.');
  }

  const secure = toBool(process.env.SMTP_SECURE, false);
  const defaultPort = secure ? 465 : 587;
  const portValue = Number(process.env.SMTP_PORT || defaultPort);
  if (!Number.isFinite(portValue) || portValue <= 0) {
    throw new Error('Invalid SMTP_PORT.');
  }

  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  if (!user || !pass) {
    throw new Error('Missing SMTP credentials (SMTP_USER/SMTP_PASS).');
  }

  const from = (process.env.SMTP_FROM || user).trim();
  if (!from) {
    throw new Error('Missing SMTP_FROM.');
  }

  return {
    host,
    port: Math.floor(portValue),
    secure,
    user,
    pass,
    from,
    requireTls: toBool(process.env.SMTP_REQUIRE_TLS, false),
    allowSelfSignedCerts: toBool(process.env.SMTP_ALLOW_SELF_SIGNED_CERTS, false),
  };
}

function getSmtpTransporter(config: SmtpConfig) {
  const cacheKey = [
    config.host,
    String(config.port),
    config.secure ? '1' : '0',
    config.user,
    config.pass,
    config.from,
    config.requireTls ? '1' : '0',
    config.allowSelfSignedCerts ? '1' : '0',
  ].join('|');

  if (smtpTransporterCache && smtpTransporterCache.cacheKey === cacheKey) {
    return smtpTransporterCache.transporter;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    requireTLS: config.requireTls,
    tls: {
      rejectUnauthorized: !config.allowSelfSignedCerts,
    },
  });

  smtpTransporterCache = { cacheKey, transporter };
  return transporter;
}

async function sendViaSmtp(input: SendMailInput) {
  const config = getSmtpConfig();
  const transporter = getSmtpTransporter(config);
  const defaultFromAddress = getDefaultFromAddress();
  const fromAddress = (input.fromAddress || defaultFromAddress || '').trim();
  const fromName = (input.fromName || getDefaultFromName() || '').trim();

  const fallbackFrom = (process.env.SMTP_FROM || config.user).trim();
  const from = fromAddress ? formatSmtpFrom(fromAddress, fromName) : fallbackFrom;

  await transporter.sendMail({
    from,
    to: input.to.join(','),
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
  });
}

async function sendViaOffice365(input: SendMailInput) {
  const sender = (process.env.O365_SENDER || '').trim();
  if (!sender) {
    throw new Error('Missing O365_SENDER.');
  }

  const defaultFromAddress = getDefaultFromAddress();
  const defaultFromName = getDefaultFromName();
  const fromAddress = (input.fromAddress || defaultFromAddress || '').trim();
  const fromName = (input.fromName || defaultFromName || '').trim();

  const token = await getOffice365AccessToken();

  const payload = {
    message: {
      subject: input.subject,
      body: {
        contentType: input.html ? 'HTML' : 'Text',
        content: input.html || input.text,
      },
      ...(fromAddress
        ? {
            from: {
              emailAddress: {
                address: fromAddress,
                ...(fromName ? { name: fromName } : {}),
              },
            },
          }
        : {}),
      toRecipients: input.to.map((address) => ({
        emailAddress: { address },
      })),
    },
    saveToSentItems: 'false',
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Office365 sendMail failed: ${res.status} ${text}`);
  }
}

export async function sendMail(input: SendMailInput) {
  const to = input.to.map((item) => item.trim()).filter(Boolean);
  if (to.length === 0) {
    throw new Error('Missing mail recipients.');
  }

  if (!input.subject?.trim()) {
    throw new Error('Missing mail subject.');
  }

  const provider = getMailProvider();
  if (provider === 'smtp') {
    await sendViaSmtp({ ...input, to });
    return;
  }
  await sendViaOffice365({ ...input, to });
}
