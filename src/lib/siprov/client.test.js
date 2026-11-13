import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { SiprovClient } from './client.ts';

let server;
const requests = [];
let rateLimitAttempts = 0;

before(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    requests.push({
      path: url.pathname,
      query: url.searchParams,
      authorization: request.headers.authorization ?? null
    });

    if (url.pathname === '/rate-limit/ext/autenticacao') {
      rateLimitAttempts += 1;
      if (rateLimitAttempts === 1) {
        return json(response, { error: 'rate_limited' }, 429, { 'Retry-After': '0' });
      }
      return json(response, { authorizationToken: 'simulation-token' });
    }
    if (url.pathname === '/rate-limit/ext/administracao/vendedor') {
      return json(response, [{ id: 42, nome: 'Consultor Simulado' }]);
    }

    if (url.pathname === '/ext/autenticacao') {
      return json(response, { authorizationToken: 'simulation-token' });
    }
    if (request.headers.authorization !== 'Bearer simulation-token') {
      return json(response, { error: 'unauthorized' }, 401);
    }
    if (url.pathname === '/ext/administracao/vendedor') {
      return json(response, [{ id: 42, nome: 'Consultor Simulado' }]);
    }
    if (url.pathname === '/ext/associado') {
      const page = Number(url.searchParams.get('pagina'));
      return json(response, {
        itens: [{ sequencial: page, nomePessoa: `Associado ${page}` }],
        paginaAtual: page,
        proximaPagina: page === 1,
        quantidade: 2
      });
    }
    if (url.pathname === '/ext/financeiro/titulo') {
      const offset = Number(url.searchParams.get('inicio'));
      return json(response, {
        itens: offset === 0 ? [{ codTitulo: 1 }, { codTitulo: 2 }] : [{ codTitulo: 3 }],
        quantidade: 3
      });
    }
    return json(response, { error: 'not_found' }, 404);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

describe('SiprovClient', () => {
  test('autentica uma vez e lista vendedores', async () => {
    const client = makeClient();
    const vendors = await client.listVendors();

    assert.deepEqual(vendors, [{ id: 42, nome: 'Consultor Simulado' }]);
    assert.equal(
      requests.some((item) => item.path === '/ext/autenticacao'),
      true
    );
  });

  test('pagina associados preservando o escopo do consultor', async () => {
    const client = makeClient();
    const associates = await client.listAssociates({
      consultantId: 42,
      startDate: '01/11/2026',
      endDate: '30/11/2026'
    });

    assert.equal(associates.length, 2);
    const calls = requests.filter((item) => item.path === '/ext/associado');
    assert.equal(calls.at(-1)?.query.get('codConsultor'), '42');
    assert.equal(calls.at(-1)?.authorization, 'Bearer simulation-token');
  });

  test('pagina títulos por offset e aplica o período de vencimento', async () => {
    const client = makeClient();
    const titles = await client.listTitles({
      consultantId: 42,
      dateField: 'due',
      startDate: '01/01/2026',
      endDate: '03/11/2026'
    });

    assert.equal(titles.length, 3);
    const calls = requests.filter((item) => item.path === '/ext/financeiro/titulo');
    assert.equal(calls.at(-1)?.query.get('dataVencimentoInicial'), '01/01/2026');
    assert.equal(calls.at(-1)?.query.get('codConsultor'), '42');
  });

  test('usa codRepresentante sem misturar o escopo do consultor', async () => {
    const client = makeClient();
    await client.listAssociates({
      representativeId: 84,
      startDate: '01/11/2026',
      endDate: '30/11/2026'
    });
    await client.listTitles({
      representativeId: 84,
      dateField: 'emission',
      startDate: '01/11/2026',
      endDate: '30/11/2026'
    });

    const associateCall = requests.filter((item) => item.path === '/ext/associado').at(-1);
    const titleCall = requests.filter((item) => item.path === '/ext/financeiro/titulo').at(-1);
    assert.equal(associateCall?.query.get('codRepresentante'), '84');
    assert.equal(associateCall?.query.has('codConsultor'), false);
    assert.equal(titleCall?.query.get('codRepresentante'), '84');
    assert.equal(titleCall?.query.has('codConsultor'), false);
  });

  test('respeita rate limit transitório e repete a autenticação', async () => {
    const client = makeClient('/rate-limit');
    const vendors = await client.listVendors();

    assert.equal(vendors.length, 1);
    assert.equal(rateLimitAttempts, 2);
  });
});

function makeClient(path = '') {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste indisponível.');
  return new SiprovClient({
    baseUrl: `http://127.0.0.1:${address.port}${path}`,
    username: 'test-user',
    password: 'test-password',
    timeoutMs: 2_000
  });
}

function json(response, body, status = 200, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
}
