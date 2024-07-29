import { CloudFrontRequestEvent } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { JWK, JWE } from 'node-jose';

const ALLOWED_ISSUERS = ['https://evc2aaatab.execute-api.eu-north-1.amazonaws.com/'];

const ssmClient = new SSMClient({ region: 'eu-north-1' });

export const handler = async (event: CloudFrontRequestEvent) => {
  const request = event.Records[0].cf.request;
  const authHeader = request.headers['authorization']?.[0]?.value;

  // Fetch SSM parameters
  const encryptionCertCommand = new GetParameterCommand({
    Name: '/OpenIddictServerlessDemo/Certificates/EncryptionCertificate',
    WithDecryption: true,
  });

  const signingCertCommand = new GetParameterCommand({
    Name: '/OpenIddictServerlessDemo/Certificates/SigningCertificate',
    WithDecryption: true,
  });

  try {
    const [encryptionResponse, signingResponse] = await Promise.all([
      ssmClient.send(encryptionCertCommand),
      ssmClient.send(signingCertCommand),
    ]);

    if (!encryptionResponse.Parameter?.Value || !signingResponse.Parameter?.Value) {
      console.error('Could not fetch SSM parameters');
      return respond(
        '500',
        'Internal Server Error',
        'An error occurred while validating the request'
      );
    }

    if (!authHeader) {
      console.log('User is not authenticated, no auth header present');
      return respond('401', 'Unauthorized', 'User is not authenticated, no auth header present');
    }

    try {
      const result = await validateToken(authHeader, signingResponse.Parameter.Value, encryptionResponse.Parameter.Value);
      request.headers['x-user-id'] = [{ key: 'X-User-Id', value: result.sub ?? '' }];
      request.headers['x-user-email'] = [{ key: 'X-User-Email', value: result.email ?? '' }];
    } catch (error) {
      console.error('Could not validate token', error);
      return respond('401', 'Unauthorized', 'User is not authenticated');
    }

    // Allow the request to proceed to the origin
    return request;
  } catch (error) {
    console.error('An error occurred while fetching SSM parameters.', error);
    return respond(
      '500',
      'Internal Server Error',
      'An error occurred while validating the request'
    );
  }
};

export async function validateToken(
  bearer: string,
  signingCertificateRaw: string,
  encryptionCertificateRaw: string
) : Promise<JwtPayload> {
  return new Promise(async (resolve, reject) => {
    try {
      const token = bearer.replace('Bearer ', '');

      // Convert the certificates to PEM format
      const encryptionCertificate = getCertificateParts(encryptionCertificateRaw);
      const signingCertificate = getCertificateParts(signingCertificateRaw);

      // Ensure the certificates are in the correct format
      const encryptionKey = await JWK.asKey(encryptionCertificate.key, 'pem');

      // Decrypt the token
      const decryptedToken = await JWE.createDecrypt(encryptionKey).decrypt(token);
      const decodedToken = decryptedToken.payload.toString();

      // Verify the token
      jwt.verify(
        decodedToken,
        signingCertificate.certificate,
        {
          algorithms: ['RS256'],
          issuer: ALLOWED_ISSUERS,
        },
        (err, decoded) => {
          if (err) {
            console.error('Error validating token', err);
            reject('Invalid token');
          } else if (!decoded || typeof decoded !== 'object') {
            console.error('Token validation failed');
            reject('Token validation failed');
          } else {
            resolve(decoded);
          }
        }
      );
    } catch (error) {
      console.error('Exception was thrown while trying to validate token', error);
      reject('Token validation failed');
    }
  });
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
      'content-type': [
        {
          key: 'Content-Type',
          value: 'text/html',
        },
      ],
    },
    body,
  };
}
