import { CloudFrontRequestEvent } from 'aws-lambda';
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { JWK, JWE } from 'node-jose';

const ALLOWED_ISSUERS = ['https://evc2aaatab.execute-api.eu-north-1.amazonaws.com/'];
const ssmClient = new SSMClient({ region: 'eu-north-1' });

interface CertificateParts {
  certificate: string;
  key: string;
}

export const handler = async (event: CloudFrontRequestEvent) => {
  const request = event.Records[0].cf.request;
  const authHeader = request.headers['authorization']?.[0]?.value;

  // Check if the user is authenticated
  if (!authHeader) {
    return respond('401', 'Unauthorized', 'User is not authenticated, no auth header present');
  }

  // Validate the token
  try {
    const { encryptionCertificate, signingCertificate } = await getCertificates();
    const result = await validateToken(authHeader, signingCertificate, encryptionCertificate);
    request.headers['x-user-id'] = [{ key: 'X-User-Id', value: result.sub ?? '' }];
    request.headers['x-user-email'] = [{ key: 'X-User-Email', value: result.email ?? '' }];
  } catch (error) {
    console.error('Could not validate token', error);
    return respond('401', 'Unauthorized', 'User is not authenticated');
  }

  // Allow the request to proceed to the origin
  return request;
};

export async function validateToken(
  bearer: string,
  signingCertificate: CertificateParts,
  encryptionCertificate: CertificateParts
): Promise<JwtPayload> {
  const token = bearer.replace('Bearer ', '');

  const encryptionKey = await JWK.asKey(encryptionCertificate.key, 'pem');

  const decryptedToken = await JWE.createDecrypt(encryptionKey).decrypt(token);
  const decodedToken = decryptedToken.payload.toString();

  return new Promise((resolve, reject) => {
    jwt.verify(
      decodedToken,
      signingCertificate.certificate,
      {
        algorithms: ['RS256'],
        issuer: ALLOWED_ISSUERS,
      },
      (err, decoded) => {
        if (err || !decoded || typeof decoded !== 'object') {
          console.error('Token validation failed', err);
          reject('Invalid token');
        } else {
          resolve(decoded);
        }
      }
    );
  });
}

async function getCertificates() {
  const command = new GetParametersByPathCommand({
    Path: '/OpenIddictServerlessDemo/Certificates/',
    WithDecryption: true,
  });

  const response = await ssmClient.send(command);

  if (!response.Parameters) {
    throw new Error('Could not fetch SSM parameters');
  }

  const encryptionParameter = response.Parameters.find(({ Name }) =>
    Name?.endsWith('EncryptionCertificate')
  );
  const signingParameter = response.Parameters.find(({ Name }) =>
    Name?.endsWith('SigningCertificate')
  );

  if (!encryptionParameter?.Value || !signingParameter?.Value) {
    throw new Error('Could not fetch SSM parameters');
  }

  return {
    encryptionCertificate: getCertificateParts(encryptionParameter.Value),
    signingCertificate: getCertificateParts(signingParameter.Value),
  };
}

function getCertificateParts(certificate: string) {
  const parts = certificate.split('-----\n-----');
  const first = `${parts[0]}-----`;
  const second = `-----${parts[1]}`;

  return {
    certificate: first.includes('BEGIN CERTIFICATE') ? first : second,
    key: first.includes('BEGIN CERTIFICATE') ? second : first,
  };
}

function respond(status: string, statusDescription: string, body: string) {
  return {
    status,
    statusDescription,
    headers: {
      'content-type': [{ key: 'Content-Type', value: 'text/html' }],
    },
    body,
  };
}
