# Soul Hospedagem

Sistema de gestão para **pousadas e hotéis**: mapa de quartos, reservas, check-in, check-out,
consumo do frigobar, pagamentos e governança (limpeza).
Uma solução da [Soul Pellegrini](https://soulpellegrini.com.br/sistemas).

## Funcionalidades

- **Painel do dia**: ocupação, quartos livres, chegadas, saídas, hóspedes na casa, valores a receber,
  recebido no mês e previsão de ocupação para os próximos 7 dias
- **Mapa de quartos** em tempo real: livre, ocupado, chegada, saída hoje, saída atrasada, bloqueado
- **Agenda de ocupação** (quartos × 14 dias): clique num dia livre para reservar
- **Reservas** com busca de disponibilidade por datas e número de pessoas. O banco **impede reservas
  sobrepostas** no mesmo quarto (a saída de um hóspede pode ser no mesmo dia da entrada do próximo)
- **Check-in** só com o quarto liberado pela governança; **check-out** só com a conta paga
  - Saída antecipada cobra as diárias até o dia
  - Depois do check-out o quarto vai automaticamente para "Para limpar"
- **Troca de quarto** e prorrogação com o hóspede já na casa
- **Consumo**: frigobar, restaurante e serviços lançados na conta. A camareira confere o frigobar
  e lança vários itens de uma vez. O preço vem do cadastro e não muda o que já foi lançado
- **Pagamentos**: Pix, cartão, dinheiro e transferência. Aceita sinal antes da chegada; o saldo
  é calculado sozinho (diárias + consumo − pagamentos)
- **Extrato** da estadia pronto para imprimir ou salvar em PDF
- **Hóspedes**: cadastro, histórico de estadias, total gasto, selo de "recorrente" e atalho para o WhatsApp
- **Governança**: situação de limpeza de cada quarto, observações (ex.: "chuveiro com defeito") e
  prioridade para quartos com chegada no dia
- **Administração**: usuários, tipos de acomodação e diárias, quartos, produtos e dados do
  estabelecimento (pousada ou hotel, horários de check-in/out, endereço do extrato)

## Perfis de acesso

| Perfil | O que pode fazer |
|---|---|
| **Aguardando liberação** | Nada: acabou de se cadastrar e espera o administrador |
| **Governança** | Ver o mapa de quartos, mudar a situação de limpeza e lançar consumo. **Não vê dados pessoais dos hóspedes nem pagamentos** (LGPD) |
| **Recepção** | Tudo da governança + reservas, hóspedes, check-in/out, pagamentos e estornos de consumo |
| **Administrador** | Tudo + usuários, quartos, diárias, produtos, configurações e exclusão de pagamentos |

As regras ficam **dentro do banco** (Row Level Security + triggers): valem mesmo que alguém tente
acessar a API direto, sem passar pelas telas.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript |
| Front-end e back-end | Next.js 16 (App Router, Server Components e Server Actions) + React 19 |
| Estilo | Tailwind CSS 4 |
| Banco de dados | PostgreSQL no Supabase (com `btree_gist` para impedir reservas sobrepostas) |
| Login | Supabase Auth |
| Hospedagem | Vercel |

## Estrutura

```
supabase/migrations/0001_hospedagem.sql   Tabelas, regras (triggers), permissões (RLS) e dados de exemplo
scripts/test-db.mjs                       Testes do banco (rodam local, sem Supabase)
src/proxy.ts                              Renova a sessão e protege as páginas
src/lib/                                  Conexão com Supabase, tipos, datas e mapa de ocupação
src/app/(app)/painel/                     Painel do dia e mapa de quartos
src/app/(app)/agenda/                     Agenda de ocupação
src/app/(app)/reservas/                   Lista, nova reserva, ficha (check-in/out, consumo, pagamentos) e extrato
src/app/(app)/hospedes/                   Cadastro e histórico de hóspedes
src/app/(app)/quartos/                    Governança (limpeza)
src/app/(app)/consumo/                    Conferência do frigobar
src/app/(app)/admin/                      Usuários, quartos e tarifas, produtos, estabelecimento
```

## Como instalar

### 1. Banco de dados (Supabase)

1. Crie uma conta gratuita em <https://supabase.com> e um novo projeto (região **South America (São Paulo)**).
2. Abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/migrations/0001_hospedagem.sql` e clique em **Run**.
   O script já cria 3 tipos de quarto, 6 quartos e alguns produtos de frigobar como exemplo: edite depois em **Administração**.
3. Em **Project Settings → API Keys**, copie a **Project URL** e a **Publishable key**.
4. Em **Authentication → URL Configuration**, preencha **Site URL** com o endereço do sistema (no início, `http://localhost:3000`).

### 2. Rodar no computador

Requer Node.js 20 ou mais novo.

```bash
npm install
cp .env.example .env.local   # e preencha com a URL e a chave do passo anterior
npm run dev
```

Abra <http://localhost:3000> e crie sua conta. **O primeiro usuário cadastrado vira administrador.**
Os próximos ficam aguardando liberação; defina o perfil de cada um em **Administração → Usuários**.

### 3. Publicar (Vercel)

1. Envie o projeto para um repositório no GitHub (pode ser privado).
2. Na Vercel: **Add New → Project**, importe o repositório.
3. Em **Environment Variables**, cadastre `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Clique em **Deploy**.
5. No Supabase, troque a **Site URL** pelo endereço da Vercel (ex.: `https://hospedagem.suaempresa.com.br`)
   e adicione-o também em **Redirect URLs**.

### Confirmação de e-mail

Por padrão o Supabase exige que o usuário confirme o e-mail antes de entrar. O link de confirmação
aponta para `/auth/confirm`. Para testes, dá para desligar em **Authentication → Sign In / Providers → Email → Confirm email**.

## Testes do banco

```bash
npm run test:db
```

Roda a migração em um PostgreSQL local (PGlite) e verifica 59 regras: permissões de cada perfil,
reservas sobrepostas, capacidade, check-in/check-out, saldo, consumo e pagamentos.

## Regras de negócio

| Situação | O que acontece |
|---|---|
| Nova reserva | Situação **Confirmada**; diária sugerida pelo tipo de quarto (pode ajustar) |
| Quarto já reservado no período | O banco recusa a reserva |
| Mais pessoas que a capacidade | O banco recusa |
| Check-in | Só a partir da data de entrada e com o quarto **Limpo** |
| Check-out | Só com saldo zerado (ou crédito do hóspede). Saída antecipada cobra até hoje |
| Depois do check-out | Quarto vai para **Para limpar** automaticamente |
| Troca de quarto com hóspede na casa | Novo quarto precisa estar limpo; o anterior vai para a limpeza |
| Não compareceu / cancelada | Libera o período para outras reservas |
| Reserva encerrada | Não pode mais ser alterada (só observações) |
| Consumo | Só para hóspede com check-in feito; preço do cadastro |
| Pagamento | Só em reservas ativas (sinal antes da chegada ou durante a estadia) |

## Próximas ideias

- Motor de reservas no site do hotel (o hóspede reserva e paga sozinho)
- Sincronização com Booking.com e Airbnb (calendário iCal)
- Tarifas por temporada e feriados
- Envio automático de confirmação e lembrete por WhatsApp/e-mail
- Ficha Nacional de Registro de Hóspedes (FNRH) e emissão de nota fiscal
- Relatórios de ocupação, diária média (ADR) e RevPAR por período
