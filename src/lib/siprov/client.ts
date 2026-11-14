export type SiprovRecord = Record<string, unknown>;

export type SiprovSellerFilter =
  | { consultantId: number; representativeId?: never }
  | { consultantId?: never; representativeId: number };

export interface SiprovClientConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs?: number;
}

interface TokenCache {
  value: string;
  expiresAt: number;
}

export class SiprovClientError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SiprovClientError';
    this.status = status;
  }
}

export class SiprovClient {
  private token: TokenCache | null = null;
  private readonly responseCache = new Map<
    string,
    { expiresAt: number; value: Promise<SiprovRecord[]> }
  >();
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly config: SiprovClientConfig;

  constructor(config: SiprovClientConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 40_000;
  }

  async listVendors(): Promise<SiprovRecord[]> {
    return this.cachedRecords('vendors', 30 * 60_000, async () => {
      const response = await this.get('/ext/administracao/vendedor');
      return extractItems(response);
    });
  }

  async listAssociates(
    params: SiprovSellerFilter & {
      startDate: string;
      endDate: string;
    }
  ): Promise<SiprovRecord[]> {
    return this.cachedRecords(`associates:${JSON.stringify(params)}`, 5 * 60_000, async () => {
      const result: SiprovRecord[] = [];

      for (let page = 1; page <= 100; page += 1) {
        const response = await this.get('/ext/associado', {
          ...sellerFilterParams(params),
          dataCadastroInicial: params.startDate,
          dataCadastroFinal: params.endDate,
          pagina: page
        });
        const items = extractItems(response);
        result.push(...items);

        if (!hasNextPage(response, page, items.length)) break;
      }

      return result;
    });
  }

  async listTitles(
    params: SiprovSellerFilter & {
      dateField: 'emission' | 'due' | 'liquidation';
      startDate: string;
      endDate: string;
    }
  ): Promise<SiprovRecord[]> {
    return this.cachedRecords(`titles:${JSON.stringify(params)}`, 2 * 60_000, async () => {
      const result: SiprovRecord[] = [];
      const dateParams = titleDateParams(params.dateField, params.startDate, params.endDate);
      let offset = 0;

      for (let page = 0; page < 100; page += 1) {
        const response = await this.get('/ext/financeiro/titulo', {
          tipo: 'Crédito',
          ...sellerFilterParams(params),
          ...dateParams,
          inicio: offset
        });
        const items = extractItems(response);
        result.push(...items);

        if (!hasMoreByOffset(response, offset, items.length)) break;
        offset += items.length;
      }

      return result;
    });
  }

  private async cachedRecords(
    key: string,
    ttlMs: number,
    load: () => Promise<SiprovRecord[]>
  ): Promise<SiprovRecord[]> {
    const cached = this.responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const value = load().catch((error) => {
      this.responseCache.delete(key);
      throw error;
    });
    this.responseCache.set(key, { expiresAt: Date.now() + ttlMs, value });
    return value;
  }

  private async authenticate(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;

    const basic = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    const response = await this.fetchJson('/ext/autenticacao', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${basic}`
      }
    });
    const token = findString(response, 'authorizationToken');

    if (!token) throw new SiprovClientError('A autenticação Siprov não retornou um token válido.');

    this.token = {
      value: token.replace(/^Bearer\s+/i, ''),
      expiresAt: Date.now() + 11 * 60 * 60 * 1000
    };
    return this.token.value;
  }

  private async get(path: string, params?: Record<string, string | number>): Promise<unknown> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) query.set(key, String(value));
    const suffix = query.size ? `?${query.toString()}` : '';

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await this.authenticate();
      try {
        return await this.fetchJson(`${path}${suffix}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        if (error instanceof SiprovClientError && error.status === 401 && attempt === 0) {
          this.token = null;
          continue;
        }
        throw error;
      }
    }

    throw new SiprovClientError('Não foi possível autenticar na Siprov.');
  }

  private async fetchJson(path: string, init: RequestInit): Promise<unknown> {
    const retryableStatus = new Set([429, 500, 502, 503, 504]);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          cache: 'no-store',
          // A integração deve permanecer na API REST e nunca seguir um
          // redirecionamento para tela de login ou outra página web.
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs)
        });
      } catch (error) {
        if (attempt < 2) {
          await wait(750 * 2 ** attempt);
          continue;
        }
        const detail = error instanceof Error ? error.message : 'falha de conexão';
        throw new SiprovClientError(`Siprov indisponível em ${safePath(path)}: ${detail}`);
      }

      if (!response.ok && retryableStatus.has(response.status) && attempt < 2) {
        await wait(retryDelay(response.headers.get('retry-after'), attempt));
        continue;
      }

      if (!response.ok) {
        const errorBody = (await response.text().catch(() => '')).slice(0, 256);
        if (normalizeErrorText(errorBody).startsWith('permissao negada')) {
          throw new SiprovClientError(
            `A credencial Siprov não tem permissão para ${safePath(path)}.`,
            response.status
          );
        }
        throw new SiprovClientError(
          `Siprov respondeu HTTP ${response.status} em ${safePath(path)}.`,
          response.status
        );
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('json')) {
        throw new SiprovClientError(
          `Siprov retornou uma resposta em formato inesperado em ${safePath(path)}.`
        );
      }

      return response.json() as Promise<unknown>;
    }

    throw new SiprovClientError(`Siprov indisponível em ${safePath(path)}.`);
  }
}

function sellerFilterParams(filter: SiprovSellerFilter): Record<string, number> {
  if (typeof filter.representativeId === 'number') {
    return { codRepresentante: filter.representativeId };
  }
  return { codConsultor: filter.consultantId };
}

let sharedClient: SiprovClient | null = null;

export function isSiprovEnabled(): boolean {
  return process.env.SIPROV_ENABLED?.trim().toLowerCase() === 'true';
}

export function getSiprovClient(): SiprovClient {
  if (sharedClient) return sharedClient;

  const username = process.env.SIPROV_USERNAME?.trim();
  const password = process.env.SIPROV_PASSWORD;
  const baseUrl =
    process.env.SIPROV_API_BASE_URL?.trim() || 'https://acesso.siprov.com.br/siprov-api';

  if (!username || !password) {
    throw new SiprovClientError(
      'A integração Siprov está ativa, mas as credenciais não foram configuradas.'
    );
  }

  assertApiBaseUrl(baseUrl);

  sharedClient = new SiprovClient({
    baseUrl,
    username,
    password,
    timeoutMs: positiveInteger(process.env.SIPROV_TIMEOUT_MS, 40_000)
  });
  return sharedClient;
}

function assertApiBaseUrl(baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new SiprovClientError('A URL base da API Siprov é inválida.');
  }

  const path = url.pathname.replace(/\/+$/, '');
  if (
    url.protocol !== 'https:' ||
    Boolean(url.username || url.password) ||
    !path.endsWith('/siprov-api')
  ) {
    throw new SiprovClientError(
      'A URL base da Siprov deve usar HTTPS e apontar para o caminho /siprov-api.'
    );
  }
}

function extractItems(value: unknown): SiprovRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of ['itens', 'items', 'dados', 'data', 'content', 'registros']) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }
  return [];
}

function hasNextPage(response: unknown, page: number, itemCount: number): boolean {
  if (!isRecord(response)) return false;
  if (typeof response.proximaPagina === 'boolean') return response.proximaPagina;
  const total = firstNumber(response, 'quantidade', 'total', 'totalRegistros');
  const current = firstNumber(response, 'paginaAtual') ?? page;
  const pageSize = firstNumber(response, 'tamanhoPagina', 'porPagina') ?? itemCount;
  return total !== null && pageSize > 0 && current * pageSize < total;
}

function hasMoreByOffset(response: unknown, offset: number, itemCount: number): boolean {
  if (!isRecord(response) || itemCount === 0) return false;
  if (typeof response.proximaPagina === 'boolean') return response.proximaPagina;
  const total = firstNumber(response, 'quantidade', 'total', 'totalRegistros');
  return total !== null && offset + itemCount < total;
}

function titleDateParams(
  field: 'emission' | 'due' | 'liquidation',
  start: string,
  end: string
): Record<string, string | number> {
  if (field === 'due') return { dataVencimentoInicial: start, dataVencimentoFinal: end };
  if (field === 'liquidation') return { dataLiquidacaoInicial: start, dataLiquidacaoFinal: end };
  return { dataEmissaoInicial: start, dataEmissaoFinal: end };
}

function findString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
  for (const nested of Object.values(value)) {
    const found = findString(nested, key);
    if (found) return found;
  }
  return null;
}

function firstNumber(value: SiprovRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const number = Number(value[key]);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(20_000, seconds * 1000);
    const timestamp = Date.parse(retryAfter);
    if (Number.isFinite(timestamp)) return Math.min(20_000, Math.max(0, timestamp - Date.now()));
  }
  return 1_500 * 2 ** attempt;
}

function safePath(path: string): string {
  return path.split('?')[0];
}

function normalizeErrorText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRecord(value: unknown): value is SiprovRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
