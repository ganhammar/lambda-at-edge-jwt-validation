import { createCertificate, CertificateCreationResult } from 'pem';
import { it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import jwt from 'jsonwebtoken';
import { JWE, JWK } from 'node-jose';
import { handler } from '../src/authorizer';

const ssmClient = mockClient(SSMClient);

beforeEach(async () => {
  ssmClient.reset();
});

async function createCertificates() {
  const signing = await createCertificateAsync();
  const encryption = await createCertificateAsync();

  return {
    signing: `${signing.certificate}\n${signing.serviceKey}`,
    encryption: `${encryption.certificate}\n${encryption.serviceKey}`,
  };
}

async function createCertificateAsync(): Promise<CertificateCreationResult> {
  return new Promise((resolve, reject) => {
    createCertificate({ selfSigned: true }, (error, keys) => {
      if (error) {
        reject(error);
      } else {
        resolve(keys);
      }
    });
  });
}

async function generateToken(signingKey: string, encryptionKey: string) {
  // Generate a signed JWT
  const token = jwt.sign(
    {
      sub: '1234567890',
      name: 'John Doe',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      iss: 'https://evc2aaatab.execute-api.eu-north-1.amazonaws.com/',
    },
    signingKey,
    { algorithm: 'RS256' }
  );

  // Encrypt the signed JWT
  const encryptionKeyJwk = await JWK.asKey(encryptionKey, 'pem');
  const encryptedToken = await JWE.createEncrypt({ format: 'compact' }, encryptionKeyJwk)
    .update(token)
    .final();

  return encryptedToken;
}

it('should validate the token', async () => {
  const { signing, encryption } = await createCertificates();
  ssmClient
    .on(GetParameterCommand)
    .resolvesOnce({
      Parameter: { Value: encryption },
    })
    .resolvesOnce({
      Parameter: { Value: signing },
    });
  const token = await generateToken(signing, encryption);

  const request = {
    clientIp: '203.0.113.178',
    method: 'GET',
    uri: '/example-path',
    querystring: '',
    headers: {
      host: [
        {
          key: 'Host',
          value: 'example.com',
        },
      ],
      'user-agent': [
        {
          key: 'User-Agent',
          value:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        },
      ],
      authorization: [
        {
          key: 'Authorization',
          value: `Bearer ${token}`,
        },
      ],
    },
  };
  const result = await handler({
    Records: [
      {
        cf: {
          config: {
            distributionId: 'EXAMPLE',
            requestId: 'EXAMPLE_REQUEST_ID',
            distributionDomainName: 'EXAMPLE.cloudfront.net',
            eventType: 'origin-request',
          },
          request,
        },
      },
    ],
  });

  expect(result).toEqual(request);
});
