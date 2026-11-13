# Contrato Siprov necessário para o Portal do Consultor

O backend de diretoria atual não possui um escopo individual por consultor. A rota
`GET /v1/siprov/snapshot` contém métricas gerenciais agregadas e **não deve** ser
exposta ao portal.

## Identidade e isolamento

O backend do portal deve receber o usuário autenticado, resolver internamente o
`codConsultor` Siprov e sempre aplicar esse código no servidor. O cliente não pode
escolher ou enviar o código de outro consultor.

Mapeamento sugerido:

- `Clerk userId` -> `codConsultor` Siprov;
- papel obrigatório: `consultant`;
- administradores usam uma aplicação/rota separada;
- toda resposta inclui o período e `updatedAt`;
- nunca retornar CPF, telefone, placa completa ou endereço no resumo.

## Rotas necessárias

### `GET /v1/consultant/dashboard?start=YYYY-MM-DD&end=YYYY-MM-DD`

Retorna totais de vendas, vendas ativas, volume, meta, comissão prevista e série
mensal. O consultor é inferido do token autenticado.

### `GET /v1/consultant/sales?start=YYYY-MM-DD&end=YYYY-MM-DD&page=1`

Retorna apenas adesões do consultor autenticado, com código, nome abreviado do
associado, plano, veículo, data, situação, valor elegível e comissão.

### `GET /v1/consultant/commissions?start=YYYY-MM-DD&end=YYYY-MM-DD`

Retorna previsão, valores confirmados/pagos, pendências e memória de cálculo por
venda. A resposta precisa informar a versão da regra de comissão.

### `GET /v1/consultant/delinquency?referenceDate=YYYY-MM-DD`

Retorna somente títulos do consultor autenticado que estejam vencidos e não
liquidados na data de referência. Deve apresentar quantidade e valor inadimplente
junto dos respectivos totais vencidos, permitindo auditar os índices por quantidade
e por valor. A lista é agrupada por associado/benefício e inclui vencimento mais
antigo, dias em atraso, quantidade de títulos e faixa de atraso.

Na Siprov, a fonte é `GET /ext/financeiro/titulo` com `tipo=Crédito`,
`codConsultor`, intervalo de vencimento e paginação por `inicio`. O código do
consultor é sempre resolvido no servidor; ele nunca é aceito do navegador.

## Pendências funcionais

1. O consultor é obtido em `GET /ext/administracao/vendedor`; o portal usa o
   campo `id` como `codConsultor` nas consultas de associado e título.
2. Cada usuário Clerk deve receber `privateMetadata.siprovConsultantId` com esse
   identificador. Metadados privados nunca são enviados ao navegador.
3. Definir a regra de comissão por plano, faixa e situação.
4. Definir quando uma venda se torna elegível e como estornos são tratados.
5. Definir a origem e periodicidade das metas.
6. Confirmar se o nome completo do associado pode aparecer ao consultor.

Com `SIPROV_ENABLED=false`, o frontend mantém o selo `Modo demonstração`. Quando
ativado, usa exclusivamente as rotas oficiais escopadas pelo consultor e exibe o
selo `Dados oficiais Siprov`. O snapshot agregado da diretoria nunca é consultado.
